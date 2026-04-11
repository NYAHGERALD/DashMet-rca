import { URL } from 'url';
import dns from 'dns';
import { promisify } from 'util';

const dnsResolve = promisify(dns.resolve4);

// Private/internal IP ranges that must never be fetched
const BLOCKED_CIDRS = [
  { prefix: '127.', label: 'loopback' },
  { prefix: '10.', label: 'private-A' },
  { prefix: '192.168.', label: 'private-C' },
  { prefix: '169.254.', label: 'link-local' },
  { prefix: '0.', label: 'unspecified' },
];

const BLOCKED_RANGES_172 = { min: 16, max: 31 }; // 172.16.0.0 – 172.31.255.255

function isPrivateIP(ip: string): boolean {
  for (const cidr of BLOCKED_CIDRS) {
    if (ip.startsWith(cidr.prefix)) return true;
  }
  // 172.16.0.0/12
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1], 10);
    if (second >= BLOCKED_RANGES_172.min && second <= BLOCKED_RANGES_172.max) return true;
  }
  // IPv6 loopback
  if (ip === '::1' || ip === '::') return true;
  return false;
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',        // GCP metadata
  'metadata.google',
]);

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:']);

/**
 * Validates a URL is safe to fetch (no SSRF).
 * Checks protocol, hostname blocklist, and resolves DNS to block private IPs.
 */
export async function validateFetchUrl(urlString: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error('SSRF_BLOCKED: Invalid URL format');
  }

  // Protocol check
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`SSRF_BLOCKED: Protocol "${parsed.protocol}" not allowed`);
  }

  // Hostname blocklist
  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(`SSRF_BLOCKED: Hostname "${hostname}" is blocked`);
  }

  // AWS/GCP/Azure metadata IPs
  if (hostname === '169.254.169.254' || hostname === '100.100.100.200') {
    throw new Error('SSRF_BLOCKED: Cloud metadata endpoint blocked');
  }

  // IP literal check
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (isPrivateIP(hostname)) {
      throw new Error(`SSRF_BLOCKED: Private IP "${hostname}" is blocked`);
    }
    return; // IP literal is safe
  }

  // DNS resolution check — block if resolves to private IP
  try {
    const addresses = await dnsResolve(hostname);
    for (const addr of addresses) {
      if (isPrivateIP(addr)) {
        throw new Error(`SSRF_BLOCKED: "${hostname}" resolves to private IP ${addr}`);
      }
    }
  } catch (err: any) {
    if (err.message?.startsWith('SSRF_BLOCKED')) throw err;
    // DNS resolution failure — allow (might be CDN with non-A records)
  }
}
