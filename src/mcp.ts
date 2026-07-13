import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { chromium, type Browser } from 'playwright'
import { lookup } from 'node:dns/promises'
import { z } from 'zod'

// ── SSRF guard (same ruleset as HTTP API) ──────────────────────────────────────
const PRIVATE_IP = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|::1|fc00:|fd)/i
const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal', 'metadata', '169.254.169.254'])

async function isAllowedUrl(raw: string): Promise<{ ok: boolean; reason?: string }> {
  let parsed: URL
  try { parsed = new URL(raw) } catch { return { ok: false, reason: 'Invalid URL' } }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, reason: 'Only http/https allowed' }
  }
  const host = parsed.hostname.toLowerCase()
  if (BLOCKED_HOSTS.has(host) || PRIVATE_IP.test(host)) {
    return { ok: false, reason: 'Private/internal addresses not allowed' }
  }
  try {
    const { address } = await lookup(host)
    if (PRIVATE_IP.test(address) || address === '169.254.169.254') {
      return { ok: false, reason: 'Resolved to a private/internal address' }
    }
  } catch {
    return { ok: false, reason: 'Could not resolve hostname' }
  }
  return { ok: true }
}

// ── Playwright singleton ───────────────────────────────────────────────────────
let browser: Browser | null = null
async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  }
  return browser
}

// ── MCP server ─────────────────────────────────────────────────────────────────
const server = new McpServer({
  name: 'screenshot-api',
  version: '1.0.0',
})

server.registerTool(
  'take_screenshot',
  {
    title: 'Take Screenshot',
    description:
      'Capture a public URL and return it as an image. ' +
      'Use this to visually inspect a live webpage, verify a deployment, ' +
      'check UI layout, or capture evidence of page content.',
    inputSchema: {
      url: z.string().url().describe('The public URL to capture (http/https only)'),
      format: z.enum(['png', 'jpeg']).default('png').describe('Image format'),
      width: z.number().int().min(320).max(3840).default(1280).describe('Viewport width in pixels'),
      full_page: z.boolean().default(false).describe('Capture the full scrollable page, not just the visible viewport'),
    },
  },
  async ({ url, format, width, full_page }) => {
    const guard = await isAllowedUrl(url)
    if (!guard.ok) {
      return { content: [{ type: 'text' as const, text: `Error: ${guard.reason}` }], isError: true }
    }

    const b = await getBrowser()
    const ctx = await b.newContext({ viewport: { width, height: 800 } })
    const page = await ctx.newPage()

    try {
      const start = Date.now()
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20_000 })
      const buf = await page.screenshot({ type: format, fullPage: full_page, quality: format === 'jpeg' ? 85 : undefined })
      const elapsed = Date.now() - start

      return {
        content: [
          {
            type: 'image' as const,
            data: buf.toString('base64'),
            mimeType: format === 'jpeg' ? 'image/jpeg' : 'image/png',
          },
          {
            type: 'text' as const,
            text: `Captured ${url} in ${elapsed}ms (${width}px wide, full_page=${full_page})`,
          },
        ],
      }
    } finally {
      await ctx.close()
    }
  }
)

server.registerTool(
  'describe_page',
  {
    title: 'Describe Page',
    description:
      'Screenshot a URL and extract key text metadata (title, heading, meta description) ' +
      'in a single call. Returns both the visual screenshot and structured text so you can ' +
      'understand what a page is about without a separate vision pass.',
    inputSchema: {
      url: z.string().url().describe('The public URL to inspect'),
      width: z.number().int().min(320).max(3840).default(1280).describe('Viewport width in pixels'),
    },
  },
  async ({ url, width }) => {
    const guard = await isAllowedUrl(url)
    if (!guard.ok) {
      return { content: [{ type: 'text' as const, text: `Error: ${guard.reason}` }], isError: true }
    }

    const b = await getBrowser()
    const ctx = await b.newContext({ viewport: { width, height: 800 } })
    const page = await ctx.newPage()

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20_000 })

      const [title, h1, metaDesc, buf] = await Promise.all([
        page.title(),
        page.$eval('h1', (el) => el.textContent?.trim() ?? '').catch(() => ''),
        page.$eval('meta[name="description"]', (el) => el.getAttribute('content') ?? '').catch(() => ''),
        page.screenshot({ type: 'png' }),
      ])

      const summary = [
        `URL: ${url}`,
        `Title: ${title || '(none)'}`,
        `H1: ${h1 || '(none)'}`,
        `Meta description: ${metaDesc || '(none)'}`,
      ].join('\n')

      return {
        content: [
          { type: 'text' as const, text: summary },
          { type: 'image' as const, data: buf.toString('base64'), mimeType: 'image/png' },
        ],
      }
    } finally {
      await ctx.close()
    }
  }
)

server.registerTool(
  'capture_pdf',
  {
    title: 'Capture Page as PDF',
    description: 'Render a public URL as an A4 PDF. Useful for archiving, reports, or printing.',
    inputSchema: {
      url: z.string().url().describe('The public URL to render as PDF'),
    },
  },
  async ({ url }) => {
    const guard = await isAllowedUrl(url)
    if (!guard.ok) {
      return { content: [{ type: 'text' as const, text: `Error: ${guard.reason}` }], isError: true }
    }

    const b = await getBrowser()
    const ctx = await b.newContext()
    const page = await ctx.newPage()

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20_000 })
      const buf = Buffer.from(await page.pdf({ format: 'A4', printBackground: true }))

      return {
        content: [
          { type: 'text' as const, text: `PDF captured for ${url} (${(buf.length / 1024).toFixed(1)} KB)` },
          // PDF returned as base64 resource — agents can save or pass it along
          { type: 'resource' as const, resource: { uri: `data:application/pdf;base64,${buf.toString('base64')}`, mimeType: 'application/pdf', text: `PDF of ${url}` } },
        ],
      }
    } finally {
      await ctx.close()
    }
  }
)

// ── Startup ────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport()

process.on('SIGTERM', async () => { await browser?.close().catch(() => {}); process.exit(0) })
process.on('SIGINT',  async () => { await browser?.close().catch(() => {}); process.exit(0) })

await server.connect(transport)
