function int(key: string, fallback: number): number {
  const v = process.env[key]
  if (!v) return fallback
  const n = parseInt(v, 10)
  return isNaN(n) ? fallback : n
}

export const config = Object.freeze({
  port: int('PORT', 3099),
  host: process.env.HOST ?? '0.0.0.0',
  navTimeoutMs: int('NAV_TIMEOUT_MS', 20_000),
  maxConcurrency: int('MAX_CONCURRENCY', 2),
  rateLimitMax: int('RATE_LIMIT_MAX', 60),
  proxySecret: process.env.PROXY_SECRET ?? '',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  trustProxy: process.env.TRUST_PROXY !== 'false',
})
