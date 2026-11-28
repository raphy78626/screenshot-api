import { describe, it, expect, afterAll } from 'vitest'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { isAllowedUrl, isPrivateIp, SsrfBlockedError, type DnsResolver } from '../src/ssrf.ts'
import { withSafePage, closeBrowser } from '../src/capture.ts'

describe('SSRF IP classification (isPrivateIp)', () => {
  it('blocks private, loopback, link-local, CGNAT, multicast, and reserved IPv4', () => {
    const blocked = [
      '0.0.0.0',
      '0.1.2.3',
      '10.0.0.1',
      '10.255.255.255',
      '100.64.0.1',       // CGNAT / Tailscale / Fly
      '100.127.255.254',
      '127.0.0.1',
      '127.255.255.254',
      '169.254.0.1',      // link-local
      '169.254.169.254',  // AWS/GCP/Azure metadata
      '172.16.0.1',
      '172.31.255.255',
      '192.0.0.1',
      '192.0.2.1',
      '192.168.0.1',
      '192.168.255.255',
      '198.18.0.1',
      '224.0.0.1',
      '255.255.255.255',
    ]
    for (const ip of blocked) {
      expect(isPrivateIp(ip), `expected ${ip} to be blocked`).toBe(true)
    }
  })

  it('allows public IPv4 addresses', () => {
    const allowed = [
      '1.1.1.1',
      '8.8.8.8',
      '93.184.216.34',
      '100.63.255.255',
      '172.15.255.255',
      '172.32.0.1',
    ]
    for (const ip of allowed) {
      expect(isPrivateIp(ip), `expected ${ip} to be allowed`).toBe(false)
    }
  })

  it('blocks loopback, ULA, link-local, NAT64, and IPv4-mapped private IPv6', () => {
    const blocked = [
      '::',
      '::1',
      '[::1]',
      'fc00::1',
      'fd00::1',
      'fdaa:0:1234::1',           // Fly.io 6PN internal mesh
      'fe80::1',
      'fe80::1%en0',
      'ff02::1',
      '::ffff:127.0.0.1',         // IPv4-mapped loopback
      '::ffff:169.254.169.254',   // IPv4-mapped cloud metadata
      '::ffff:10.0.0.1',
      '::ffff:7f00:1',            // hex form of ::ffff:127.0.0.1
      '64:ff9b::10.0.0.1',        // NAT64
      '2001:db8::1',
    ]
    for (const ip of blocked) {
      expect(isPrivateIp(ip), `expected ${ip} to be blocked`).toBe(true)
    }
  })

  it('allows public IPv6 addresses', () => {
    const allowed = [
      '2606:2800:220:1:248:1893:25c8:1946',
      '2001:4860:4860::8888',
      '::ffff:1.1.1.1',
    ]
    for (const ip of allowed) {
      expect(isPrivateIp(ip), `expected ${ip} to be allowed`).toBe(false)
    }
  })
})

describe('SSRF URL validation (isAllowedUrl)', () => {
  it('blocks non-http(s) schemes', async () => {
    for (const bad of ['file:///etc/passwd', 'ftp://example.com', 'javascript:alert(1)', 'data:text/html,hi']) {
      const res = await isAllowedUrl(bad)
      expect(res.ok, `expected ${bad} to be blocked`).toBe(false)
    }
  })

  it('blocks bracketed IPv6 literals and internal suffixes', async () => {
    const blocked = [
      'http://[::1]/',
      'http://[::ffff:127.0.0.1]/',
      'http://[::ffff:169.254.169.254]/latest/meta-data/',
      'http://[fdaa:0:1234::1]/',
      'http://app.localhost/',
      'http://printer.local/',
      'http://redis.internal/',
      'http://metadata.google.internal/',
    ]
    for (const bad of blocked) {
      const res = await isAllowedUrl(bad)
      expect(res.ok, `expected ${bad} to be blocked`).toBe(false)
      expect(res.reason).toMatch(/private|internal/i)
    }
  })

  it('blocks dual-homed DNS if ANY returned record is private', async () => {
    const resolver: DnsResolver = async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]
    const res = await isAllowedUrl('https://dual-homed.example', { resolver })
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/private|internal/i)
  })

  it('allows hostname when all DNS records are public', async () => {
    const resolver: DnsResolver = async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ]
    const res = await isAllowedUrl('https://public.example/path', { resolver })
    expect(res.ok).toBe(true)
    expect(res.addresses).toEqual(['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946'])
  })
})

describe('Playwright runtime SSRF protection', () => {
  afterAll(async () => {
    await closeBrowser()
  })

  it('blocks HTTP 302 redirect from an allowed host to a private/internal host', async () => {
    let secretHit = false

    // Simulated internal secret service (e.g. cloud metadata or internal admin API)
    const secretServer = createServer((_req, res) => {
      secretHit = true
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('INTERNAL_SECRET_DATA')
    })
    await new Promise<void>((resolve) => secretServer.listen(0, '127.0.0.1', resolve))
    const secretPort = (secretServer.address() as AddressInfo).port

    // Simulated "public" attacker server that returns 302 -> internal secret service
    const attackerServer = createServer((req, res) => {
      if (req.url === '/redirect-to-internal') {
        res.writeHead(302, { Location: `http://127.0.0.1:${secretPort}/secret` })
        res.end()
        return
      }
      if (req.url === '/good-redirect') {
        res.writeHead(302, { Location: '/landing' })
        res.end()
        return
      }
      if (req.url === '/landing') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<!doctype html><html><head><title>Landed OK</title></head><body>OK</body></html>')
        return
      }
      if (req.url === '/subresource-ssrf') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`
          <!doctype html>
          <html>
            <head><title>Safe Page</title></head>
            <body>
              <h1>Loaded</h1>
              <img src="http://127.0.0.1:${secretPort}/pixel" />
              <iframe src="http://127.0.0.1:${secretPort}/frame"></iframe>
            </body>
          </html>
        `)
        return
      }
      res.writeHead(404)
      res.end()
    })
    await new Promise<void>((resolve) => attackerServer.listen(0, '127.0.0.1', resolve))
    const attackerPort = (attackerServer.address() as AddressInfo).port

    // Treat ONLY attackerServer as "public"; everything else uses the real isAllowedUrl()
    const testValidator = async (rawUrl: string) => {
      const parsed = new URL(rawUrl)
      if (parsed.hostname === '127.0.0.1' && parsed.port === String(attackerPort)) {
        return { ok: true }
      }
      return isAllowedUrl(rawUrl)
    }

    try {
      // 1. Main-frame 302 redirect to internal IP must throw SsrfBlockedError and NEVER hit secretServer
      await expect(
        withSafePage(
          `http://127.0.0.1:${attackerPort}/redirect-to-internal`,
          { navTimeoutMs: 10_000, urlValidator: testValidator },
          async (page) => page.content()
        )
      ).rejects.toThrow(SsrfBlockedError)
      expect(secretHit).toBe(false)

      // 2. Legitimate 302 redirect to an allowed host must still succeed
      const landedTitle = await withSafePage(
        `http://127.0.0.1:${attackerPort}/good-redirect`,
        { navTimeoutMs: 10_000, urlValidator: testValidator },
        async (page) => page.title()
      )
      expect(landedTitle).toBe('Landed OK')

      // 3. Subresource <img> and <iframe> pointing to internal IP must be aborted without crashing the page
      const title = await withSafePage(
        `http://127.0.0.1:${attackerPort}/subresource-ssrf`,
        { navTimeoutMs: 10_000, urlValidator: testValidator },
        async (page) => page.title()
      )
      expect(title).toBe('Safe Page')
      expect(secretHit).toBe(false)
    } finally {
      attackerServer.close()
      secretServer.close()
    }
  }, 30_000)
})
