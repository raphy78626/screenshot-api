import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SsrfBlockedError'
  }
}

const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
  'metadata',
  'instance-data',
])

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal']

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let out = 0
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null
    const n = Number(part)
    if (n < 0 || n > 255) return null
    out = (out << 8) | n
  }
  return out >>> 0
}

function inCidr4(ipInt: number, baseInt: number, prefixLen: number): boolean {
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0
  return (ipInt & mask) === (baseInt & mask)
}

const BLOCKED_V4_CIDRS: Array<[number, number]> = [
  [0x00000000, 8],  // 0.0.0.0/8 (unspecified / "this" network)
  [0x0a000000, 8],  // 10.0.0.0/8 (RFC 1918)
  [0x64400000, 10], // 100.64.0.0/10 (CGNAT / Tailscale / Fly)
  [0x7f000000, 8],  // 127.0.0.0/8 (loopback)
  [0xa9fe0000, 16], // 169.254.0.0/16 (link-local + cloud metadata)
  [0xac100000, 12], // 172.16.0.0/12 (RFC 1918)
  [0xc0000000, 24], // 192.0.0.0/24 (IETF protocol assignments)
  [0xc0000200, 24], // 192.0.2.0/24 (TEST-NET-1)
  [0xc0a80000, 16], // 192.168.0.0/16 (RFC 1918)
  [0xc6120000, 15], // 198.18.0.0/15 (benchmarking)
  [0xc6336400, 24], // 198.51.100.0/24 (TEST-NET-2)
  [0xcb007100, 24], // 203.0.113.0/24 (TEST-NET-3)
  [0xe0000000, 4],  // 224.0.0.0/4 (multicast)
  [0xf0000000, 4],  // 240.0.0.0/4 (reserved + broadcast)
]

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip)
  if (n === null) return true
  return BLOCKED_V4_CIDRS.some(([base, prefix]) => inCidr4(n, base, prefix))
}

function expandIpv6(raw: string): number[] | null {
  // Handle embedded dotted-quad IPv4 suffix (e.g. ::ffff:127.0.0.1 or 64:ff9b::10.0.0.1)
  let ip = raw.toLowerCase()
  const lastColon = ip.lastIndexOf(':')
  if (lastColon !== -1 && ip.includes('.')) {
    const v4Part = ip.slice(lastColon + 1)
    const v4Int = ipv4ToInt(v4Part)
    if (v4Int === null) return null
    const hi = ((v4Int >>> 16) & 0xffff).toString(16)
    const lo = (v4Int & 0xffff).toString(16)
    ip = `${ip.slice(0, lastColon)}:${hi}:${lo}`
  }

  const halves = ip.split('::')
  if (halves.length > 2) return null

  const parseGroups = (s: string): number[] | null => {
    if (!s) return []
    const parts = s.split(':')
    const nums: number[] = []
    for (const p of parts) {
      if (!/^[0-9a-f]{1,4}$/.test(p)) return null
      nums.push(parseInt(p, 16))
    }
    return nums
  }

  const left = parseGroups(halves[0])
  if (!left) return null

  if (halves.length === 1) {
    return left.length === 8 ? left : null
  }

  const right = parseGroups(halves[1])
  if (!right) return null
  const missing = 8 - (left.length + right.length)
  if (missing < 0) return null
  return [...left, ...Array<number>(missing).fill(0), ...right]
}

function isPrivateIpv6(ip: string): boolean {
  const g = expandIpv6(ip)
  if (!g) return true

  const allZeroExceptLast =
    g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0

  // :: (unspecified) and ::1 (loopback)
  if (allZeroExceptLast && g[6] === 0 && (g[7] === 0 || g[7] === 1)) return true

  // ::ffff:0:0/96 (IPv4-mapped IPv6)
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0xffff) {
    const v4Int = ((g[6] << 16) | g[7]) >>> 0
    return BLOCKED_V4_CIDRS.some(([base, prefix]) => inCidr4(v4Int, base, prefix))
  }

  // 64:ff9b::/96 and 64:ff9b:1::/48 (NAT64 well-known / local-use prefixes)
  if (g[0] === 0x0064 && g[1] === 0xff9b && (g[2] === 0 || g[2] === 1)) return true

  // 100::/64 (discard-only)
  if (g[0] === 0x0100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return true

  // 2001:db8::/32 (documentation)
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true

  // fc00::/7 (unique local, includes Fly 6PN fdaa::/16)
  if ((g[0] & 0xfe00) === 0xfc00) return true

  // fe80::/10 (link-local)
  if ((g[0] & 0xffc0) === 0xfe80) return true

  // ff00::/8 (multicast)
  if ((g[0] & 0xff00) === 0xff00) return true

  return false
}

/**
 * Returns true if the given IPv4 or IPv6 address belongs to a private,
 * loopback, link-local, metadata, CGNAT, multicast, or otherwise non-public range.
 */
export function isPrivateIp(rawIp: string): boolean {
  // Strip optional brackets [::1] and IPv6 zone identifier %eth0
  const cleaned = rawIp.trim().replace(/^\[|\]$/g, '').split('%')[0]
  const family = isIP(cleaned)
  if (family === 4) return isPrivateIpv4(cleaned)
  if (family === 6) return isPrivateIpv6(cleaned)
  return true
}

export type DnsResolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>

const defaultResolver: DnsResolver = (hostname) =>
  lookup(hostname, { all: true, verbatim: true })

export interface UrlCheckResult {
  ok: boolean
  reason?: string
  addresses?: string[]
}

/**
 * Validates that a URL uses http/https and resolves exclusively to public IP addresses.
 */
export async function isAllowedUrl(
  raw: string,
  opts?: { resolver?: DnsResolver }
): Promise<UrlCheckResult> {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { ok: false, reason: 'Invalid URL' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Only http/https allowed' }
  }

  // Node's URL.hostname retains brackets for IPv6 literals (e.g. "[::1]")
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!host) {
    return { ok: false, reason: 'Invalid hostname' }
  }

  if (BLOCKED_HOSTS.has(host) || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, reason: 'Private/internal addresses not allowed' }
  }

  if (isIP(host) !== 0) {
    if (isPrivateIp(host)) {
      return { ok: false, reason: 'Private/internal addresses not allowed' }
    }
    return { ok: true, addresses: [host] }
  }

  const resolver = opts?.resolver ?? defaultResolver
  try {
    const records = await resolver(host)
    if (!records.length) {
      return { ok: false, reason: 'Could not resolve hostname' }
    }
    for (const rec of records) {
      if (isPrivateIp(rec.address)) {
        return { ok: false, reason: 'Resolved to a private/internal address' }
      }
    }
    return { ok: true, addresses: records.map((r) => r.address) }
  } catch {
    return { ok: false, reason: 'Could not resolve hostname' }
  }
}
