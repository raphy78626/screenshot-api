import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import rateLimit from '@fastify/rate-limit'
import { errors as playwrightErrors } from 'playwright'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { appendFile } from 'node:fs/promises'
import pLimit from 'p-limit'
import { config } from './config.ts'
import { isAllowedUrl, SsrfBlockedError } from './ssrf.ts'
import {
  capturePdf,
  captureScreenshot,
  closeBrowser,
  getBrowser,
  isBrowserConnected,
} from './capture.ts'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const PUBLIC_DIR = resolve(__dirname, '../docs')

// ── Response cache (5 min TTL, bounded size, skipped for PDF) ─────────────────
const CACHE_TTL = 5 * 60 * 1000
const CACHE_MAX_ENTRIES = 100
const cache = new Map<string, { buf: Buffer; mime: string; ts: number }>()

function cacheKey(url: string, fmt: string, w: number, h: number, full: boolean) {
  return `${url}|${fmt}|${w}|${h}|${full}`
}

function cacheGet(key: string) {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.ts > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  return hit
}

function cacheSet(key: string, entry: { buf: Buffer; mime: string; ts: number }) {
  if (cache.size >= CACHE_MAX_ENTRIES && !cache.has(key)) {
    const oldestKey = cache.keys().next().value
    if (oldestKey !== undefined) cache.delete(oldestKey)
  }
  cache.set(key, entry)
}

setInterval(() => {
  const now = Date.now()
  for (const [k, v] of cache) if (now - v.ts > CACHE_TTL) cache.delete(k)
}, CACHE_TTL).unref()

interface ScreenshotQuery {
  url?: string
  format?: string
  full_page?: string
  width?: string
  height?: string
}

export async function buildApp(overrides?: Partial<typeof config>) {
  const cfg = { ...config, ...overrides }

  const app = Fastify({
    logger: { level: cfg.logLevel },
    trustProxy: cfg.trustProxy,
  })

  await app.register(rateLimit, {
    max: cfg.rateLimitMax,
    timeWindow: '1 minute',
    keyGenerator: (req) => {
      const rapidUser = req.headers['x-rapidapi-user']
      return (rapidUser ? String(rapidUser) : null) ?? req.ip
    },
    allowList: (req) => req.url === '/health',
  })

  app.register(fastifyStatic, { root: PUBLIC_DIR, prefix: '/' })

  // Proxy-secret guard: keeps direct callers from bypassing billing
  app.addHook('onRequest', async (req, reply) => {
    if (!cfg.proxySecret) return
    const pub = ['/health', '/', '/waitlist']
    if (pub.some((p) => req.url === p || req.url.startsWith(p + '?'))) return
    const secret =
      req.headers['x-rapidapi-proxy-secret'] ?? req.headers['x-proxy-secret']
    if (secret !== cfg.proxySecret) {
      return reply.status(401).send({ error: 'unauthorized' })
    }
  })

  app.get('/health', async () => ({
    status: 'ok',
    browserConnected: isBrowserConnected(),
  }))

  app.get('/.well-known/mcp/server-card.json', async (_, reply) => {
    reply.header('Access-Control-Allow-Origin', '*')
    return reply.sendFile('.well-known/mcp/server-card.json')
  })

  app.post<{ Body: { email?: string } }>('/waitlist', {
    schema: { body: { type: 'object', properties: { email: { type: 'string' } } } },
  }, async (req, reply) => {
    const email = req.body?.email?.trim()
    if (!email || !email.includes('@')) {
      return reply.status(400).send({ error: 'valid email required' })
    }
    const line = JSON.stringify({ email, ts: new Date().toISOString() }) + '\n'
    await appendFile('waitlist.jsonl', line, 'utf8')
    req.log.info({ email }, 'waitlist signup')
    return reply.status(200).send({ ok: true })
  })

  const limit = pLimit(cfg.maxConcurrency)

  app.get<{ Querystring: ScreenshotQuery }>('/screenshot', async (req, reply) => {
    const { url, format = 'png', full_page = 'false', width = '1280', height = '800' } = req.query

    if (!url) return reply.status(400).send({ error: 'url param required' })

    const guard = await isAllowedUrl(url)
    if (!guard.ok) return reply.status(400).send({ error: guard.reason })

    const fmt = (['png', 'jpeg', 'pdf'] as const).includes(format as 'png' | 'jpeg' | 'pdf')
      ? (format as 'png' | 'jpeg' | 'pdf')
      : 'png'
    const fullPage = full_page === 'true'
    const vpWidth = Math.min(Math.max(parseInt(width) || 1280, 320), 3840)
    const vpHeight = Math.min(Math.max(parseInt(height) || 800, 200), 2160)

    // Cache hit — PDFs are not cached (they're large + rarely repeated)
    const key = fmt !== 'pdf' ? cacheKey(url, fmt, vpWidth, vpHeight, fullPage) : null
    if (key) {
      const hit = cacheGet(key)
      if (hit) {
        reply.header('Content-Type', hit.mime)
        reply.header('X-Cache', 'HIT')
        reply.header('Access-Control-Allow-Origin', '*')
        return reply.send(hit.buf)
      }
    }

    if (limit.pendingCount > 10) {
      return reply.status(503).send({ error: 'Server busy, try again shortly' })
    }

    return limit(async () => {
      const start = Date.now()
      const { data, mime } =
        fmt === 'pdf'
          ? await capturePdf({
              url,
              width: vpWidth,
              height: vpHeight,
              navTimeoutMs: cfg.navTimeoutMs,
            })
          : await captureScreenshot({
              url,
              format: fmt,
              width: vpWidth,
              height: vpHeight,
              fullPage,
              navTimeoutMs: cfg.navTimeoutMs,
            })

      if (key) cacheSet(key, { buf: data, mime, ts: Date.now() })

      reply.header('Content-Type', mime)
      reply.header('X-Capture-Ms', String(Date.now() - start))
      reply.header('X-Cache', 'MISS')
      reply.header('Access-Control-Allow-Origin', '*')
      return reply.send(data)
    })
  })

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof SsrfBlockedError) {
      return reply.status(400).send({ error: err.message })
    }
    req.log.error({ err }, 'request failed')
    if (err instanceof playwrightErrors.TimeoutError) {
      return reply.status(504).send({ error: 'Target page timed out' })
    }
    if (reply.statusCode < 400) reply.status(500)
    reply.send({ error: 'Internal error' })
  })

  return app
}

// Only listen when run directly (not when imported by tests)
const isMain = process.argv[1] === fileURLToPath(import.meta.url)
if (isMain) {
  const app = await buildApp()

  // Warm browser before accepting traffic
  await getBrowser()

  for (const sig of ['SIGTERM', 'SIGINT'] as const) {
    process.on(sig, async () => {
      app.log.info({ sig }, 'shutting down')
      await app.close()
      await closeBrowser()
      process.exit(0)
    })
  }

  await app.listen({ port: config.port, host: config.host })
}
