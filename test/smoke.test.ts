import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../src/server.ts'
import type { FastifyInstance } from 'fastify'

describe('screenshot-api smoke tests', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /health returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.status).toBe('ok')
  })

  it('GET /screenshot without url returns 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/screenshot' })
    expect(res.statusCode).toBe(400)
  })

  it('SSRF: metadata IP is blocked (regression)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/screenshot?url=http://169.254.169.254/',
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/private|internal/i)
  })

  it('SSRF: localhost is blocked', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/screenshot?url=http://localhost:3099/',
    })
    expect(res.statusCode).toBe(400)
  })

  it('auth: returns 401 when PROXY_SECRET set and header missing', async () => {
    const authApp = await buildApp({ proxySecret: 'test-secret' })
    await authApp.ready()
    try {
      const res = await authApp.inject({
        method: 'GET',
        url: '/screenshot?url=https://example.com',
      })
      expect(res.statusCode).toBe(401)
    } finally {
      await authApp.close()
    }
  })

  it(
    'GET /screenshot captures example.com as PNG',
    async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/screenshot?url=https://example.com&format=png',
      })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toContain('image/png')
      expect(res.rawPayload.length).toBeGreaterThan(1000)
    },
    60_000
  )
})
