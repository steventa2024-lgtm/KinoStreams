import dns from 'node:dns/promises';
import net from 'node:net';

export class SsrfBlockedError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = 'SsrfBlockedError';
    this.status = status;
  }
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata',
]);

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local & cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0 && parts[2] === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmark
  if (a >= 224) return true; // Multicast / reserved
  return false;
}

function isBlockedIpv6(rawIp: string): boolean {
  const ip = rawIp.toLowerCase().split('%')[0];
  if (ip === '::' || ip === '::1') return true;

  // Handle IPv4-mapped IPv6 addresses (::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (ip.startsWith('::ffff:')) {
    const rest = ip.slice('::ffff:'.length);
    if (net.isIPv4(rest)) {
      return isBlockedIpv4(rest);
    }
    const hexMatch = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(rest);
    if (hexMatch) {
      const hi = parseInt(hexMatch[1], 16);
      const lo = parseInt(hexMatch[2], 16);
      const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      return isBlockedIpv4(v4);
    }
    return true;
  }

  // Unique local addresses (fc00::/7), link-local (fe80::/10), multicast (ff00::/8)
  const firstSegment = ip.split(':')[0];
  if (firstSegment) {
    const firstWord = parseInt(firstSegment, 16);
    if (!Number.isNaN(firstWord)) {
      if ((firstWord & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
      if ((firstWord & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
      if ((firstWord & 0xff00) === 0xff00) return true; // ff00::/8 multicast
    }
  }

  return false;
}

export function isBlockedIpAddress(ip: string): boolean {
  const cleaned = ip.replace(/^\[|\]$/g, '').trim();
  const ipVersion = net.isIP(cleaned);
  if (ipVersion === 4) return isBlockedIpv4(cleaned);
  if (ipVersion === 6) return isBlockedIpv6(cleaned);
  return true;
}

export async function assertSafeExternalUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError('Invalid URL format', 400);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfBlockedError('Unsupported protocol; only http/https allowed', 400);
  }

  if (parsed.username || parsed.password) {
    // Allow credentials only if not targeting blocked hosts, still inspect hostname below
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname) {
    throw new SsrfBlockedError('Missing hostname', 400);
  }

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.localdomain')
  ) {
    throw new SsrfBlockedError('Target host is not permitted', 403);
  }

  if (net.isIP(hostname) !== 0) {
    if (isBlockedIpAddress(hostname)) {
      throw new SsrfBlockedError('Target IP address is not permitted', 403);
    }
    return parsed;
  }

  // Resolve DNS records and reject if any resolved address is private/loopback/metadata
  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!records || records.length === 0) {
      throw new SsrfBlockedError('Target host could not be resolved', 400);
    }
    for (const rec of records) {
      if (isBlockedIpAddress(rec.address)) {
        throw new SsrfBlockedError('Target host resolves to a restricted network', 403);
      }
    }
  } catch (err) {
    if (err instanceof SsrfBlockedError) throw err;
    throw new SsrfBlockedError('DNS resolution failed for target host', 502);
  }

  return parsed;
}

export async function safeFetchExternal(
  rawUrl: string,
  options?: {
    headers?: HeadersInit;
    timeoutMs?: number;
    maxRedirects?: number;
  }
): Promise<{ response: Response; finalUrl: URL }> {
  const timeoutMs = options?.timeoutMs ?? 12000;
  const maxRedirects = options?.maxRedirects ?? 4;

  // Strip sensitive incoming headers before forwarding externally
  const cleanHeaders = new Headers(options?.headers);
  cleanHeaders.delete('cookie');
  cleanHeaders.delete('authorization');
  cleanHeaders.delete('x-forwarded-for');
  cleanHeaders.delete('x-real-ip');

  let currentUrl = await assertSafeExternalUrl(rawUrl);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(currentUrl.toString(), {
        method: 'GET',
        headers: cleanHeaders,
        redirect: 'manual',
        cache: 'no-store',
        signal: controller.signal,
      });

      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.get('location')
      ) {
        if (hop === maxRedirects) {
          throw new SsrfBlockedError('Too many redirects', 502);
        }
        const nextRaw = new URL(
          response.headers.get('location')!,
          currentUrl
        ).toString();
        currentUrl = await assertSafeExternalUrl(nextRaw);
        continue;
      }

      return { response, finalUrl: currentUrl };
    } finally {
      clearTimeout(timer);
    }
  }

  throw new SsrfBlockedError('Too many redirects', 502);
}
