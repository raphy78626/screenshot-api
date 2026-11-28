import { chromium as chromiumExtra } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { type Browser, type Page } from 'playwright'
import {
  isAllowedUrl,
  SsrfBlockedError,
  type DnsResolver,
  type UrlCheckResult,
} from './ssrf.ts'

chromiumExtra.use(StealthPlugin())

const MAX_CAPTURES_BEFORE_RECYCLE = 100
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

let browser: Browser | null = null
let activeCaptures = 0
let capturesSinceLaunch = 0

export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = (await chromiumExtra.launch({
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    })) as unknown as Browser
    capturesSinceLaunch = 0
  }
  return browser
}

export function isBrowserConnected(): boolean {
  return browser?.isConnected() ?? false
}

export async function closeBrowser(): Promise<void> {
  const b = browser
  browser = null
  capturesSinceLaunch = 0
  await b?.close().catch(() => {})
}

export interface SafePageOptions {
  width?: number
  height?: number
  navTimeoutMs?: number
  /** Custom DNS resolver (primarily for tests). */
  resolver?: DnsResolver
  /** Custom URL validator (primarily for tests). Defaults to `isAllowedUrl`. */
  urlValidator?: (rawUrl: string) => Promise<UrlCheckResult>
}

/**
 * Opens an isolated Playwright BrowserContext with a network-level SSRF guard
 * that validates every HTTP(S) request — including 301/302/303/307/308 redirects,
 * iframes, and subresources — before it leaves Chromium.
 */
export async function withSafePage<T>(
  url: string,
  opts: SafePageOptions,
  fn: (page: Page) => Promise<T>
): Promise<T> {
  const validate =
    opts.urlValidator ?? ((raw: string) => isAllowedUrl(raw, { resolver: opts.resolver }))

  const initialGuard = await validate(url)
  if (!initialGuard.ok) {
    throw new SsrfBlockedError(initialGuard.reason ?? 'URL not allowed')
  }

  activeCaptures++
  const b = await getBrowser()
  const ctx = await b.newContext(
    opts.width && opts.height
      ? { viewport: { width: opts.width, height: opts.height } }
      : undefined
  )
  const page = await ctx.newPage()

  // Per-context origin cache to avoid redundant DNS lookups for subresources
  const originCheckCache = new Map<string, UrlCheckResult>()
  const checkCached = async (targetUrl: string): Promise<UrlCheckResult> => {
    let key: string | null = null
    try {
      const parsed = new URL(targetUrl)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        key = `${parsed.protocol}//${parsed.host.toLowerCase()}`
      }
    } catch {
      // Fall through to validator
    }
    if (key) {
      const hit = originCheckCache.get(key)
      if (hit) return hit
    }
    const res = await validate(targetUrl)
    if (key) originCheckCache.set(key, res)
    return res
  }

  let mainFrameBlockedReason: string | null = null

  await ctx.route('**/*', async (route) => {
    const req = route.request()
    const reqUrl = req.url()
    const isMainNav = req.isNavigationRequest() && req.frame() === page.mainFrame()

    // Allow inline data/blob/about URLs for non-main-frame subresources
    if (
      reqUrl.startsWith('data:') ||
      reqUrl.startsWith('blob:') ||
      reqUrl.startsWith('about:')
    ) {
      if (isMainNav && reqUrl !== 'about:blank') {
        mainFrameBlockedReason = 'Only http/https allowed'
        return route.abort('blockedbyclient')
      }
      return route.continue()
    }

    const check = await checkCached(reqUrl)
    if (!check.ok) {
      if (isMainNav) {
        mainFrameBlockedReason = check.reason ?? 'Blocked private/internal address'
      }
      return route.abort('blockedbyclient')
    }

    // Playwright's route.continue() does NOT fire ctx.route for server-side HTTP 3xx
    // redirect hops. For navigation requests (main frame & iframes), fetch with
    // maxRedirects: 0 so we can inspect and validate every Location header before
    // letting Chromium follow it.
    if (req.isNavigationRequest()) {
      try {
        const res = await route.fetch({ maxRedirects: 0 })
        if (REDIRECT_STATUSES.has(res.status())) {
          const location = res.headers()['location']
          if (location) {
            let nextUrl: string
            try {
              nextUrl = new URL(location, reqUrl).toString()
            } catch {
              if (isMainNav) mainFrameBlockedReason = 'Invalid redirect URL'
              return route.abort('blockedbyclient')
            }
            const redirectCheck = await checkCached(nextUrl)
            if (!redirectCheck.ok) {
              if (isMainNav) {
                mainFrameBlockedReason =
                  redirectCheck.reason ?? 'Blocked redirect to private/internal address'
              }
              return route.abort('blockedbyclient')
            }
          }
        }
        return route.fulfill({ response: res })
      } catch {
        return route.abort('failed')
      }
    }

    return route.continue()
  })

  try {
    try {
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: opts.navTimeoutMs ?? 20_000,
      })
    } catch (err) {
      if (mainFrameBlockedReason) {
        throw new SsrfBlockedError(mainFrameBlockedReason)
      }
      throw err
    }

    if (mainFrameBlockedReason) {
      throw new SsrfBlockedError(mainFrameBlockedReason)
    }

    return await fn(page)
  } finally {
    await ctx.close().catch(() => {})
    activeCaptures--
    capturesSinceLaunch++
    // Recycle Chromium periodically when idle to prevent long-running memory bloat
    if (activeCaptures === 0 && capturesSinceLaunch >= MAX_CAPTURES_BEFORE_RECYCLE) {
      await closeBrowser()
    }
  }
}

export async function captureScreenshot(opts: {
  url: string
  format: 'png' | 'jpeg'
  width: number
  height: number
  fullPage: boolean
  navTimeoutMs?: number
  resolver?: DnsResolver
}): Promise<{ data: Buffer; mime: string }> {
  return withSafePage(
    opts.url,
    {
      width: opts.width,
      height: opts.height,
      navTimeoutMs: opts.navTimeoutMs,
      resolver: opts.resolver,
    },
    async (page) => {
      const data = Buffer.from(
        await page.screenshot({
          type: opts.format,
          fullPage: opts.fullPage,
          quality: opts.format === 'jpeg' ? 85 : undefined,
        })
      )
      return {
        data,
        mime: opts.format === 'jpeg' ? 'image/jpeg' : 'image/png',
      }
    }
  )
}

export async function capturePdf(opts: {
  url: string
  width?: number
  height?: number
  navTimeoutMs?: number
  resolver?: DnsResolver
}): Promise<{ data: Buffer; mime: string }> {
  return withSafePage(
    opts.url,
    {
      width: opts.width,
      height: opts.height,
      navTimeoutMs: opts.navTimeoutMs,
      resolver: opts.resolver,
    },
    async (page) => {
      const data = Buffer.from(
        await page.pdf({ format: 'A4', printBackground: true })
      )
      return { data, mime: 'application/pdf' }
    }
  )
}

export async function describePage(opts: {
  url: string
  width: number
  height?: number
  navTimeoutMs?: number
  resolver?: DnsResolver
}): Promise<{
  title: string
  h1: string
  metaDesc: string
  screenshot: Buffer
}> {
  return withSafePage(
    opts.url,
    {
      width: opts.width,
      height: opts.height ?? 800,
      navTimeoutMs: opts.navTimeoutMs,
      resolver: opts.resolver,
    },
    async (page) => {
      const [title, h1, metaDesc, screenshot] = await Promise.all([
        page.title(),
        page.$eval('h1', (el) => el.textContent?.trim() ?? '').catch(() => ''),
        page
          .$eval('meta[name="description"]', (el) => el.getAttribute('content') ?? '')
          .catch(() => ''),
        page.screenshot({ type: 'png' }),
      ])
      return { title, h1, metaDesc, screenshot: Buffer.from(screenshot) }
    }
  )
}
