import { controlPrisma } from './controlPrisma.js';

const ENV_DOMAINS = (process.env.ALLOWED_STREAMING_DOMAINS ?? '')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

let tenantDomainCache: string[] = [];
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getTenantDomains(): Promise<string[]> {
  if (Date.now() < cacheExpiry) return tenantDomainCache;
  try {
    const domains = await controlPrisma.tenantDomain.findMany({
      select: { host: true },
      where: { tenant: { status: 'active' } },
    });
    tenantDomainCache = domains
      .map((d) => d.host?.toLowerCase() ?? '')
      .filter(Boolean);
    cacheExpiry = Date.now() + CACHE_TTL_MS;
  } catch {
    // Control plane may be unreachable during the early milestones (no
    // CONTROL_DATABASE_URL configured yet). Keep stale cache and let
    // ENV_DOMAINS continue to gate streaming.
  }
  return tenantDomainCache;
}

function extractHostname(value: string): string | null {
  try {
    const url = new URL(value);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export async function isAllowedDomain(
  origin: string | undefined,
  referer: string | undefined
): Promise<boolean> {
  // Same-origin requests (e.g. <video> element via proxy) send neither Origin
  // nor a cross-origin Referer. The signed stream token is the primary gate.
  if (!origin && !referer) return true;

  const tenantDomains = await getTenantDomains();
  const allowed = new Set([...ENV_DOMAINS, ...tenantDomains]);

  const originHost = origin ? extractHostname(origin) : null;
  if (originHost && allowed.has(originHost)) return true;

  const refererHost = referer ? extractHostname(referer) : null;
  if (refererHost && allowed.has(refererHost)) return true;

  return false;
}

export async function getAllAllowedOrigins(): Promise<string[]> {
  const tenantDomains = await getTenantDomains();
  const hosts = new Set([...ENV_DOMAINS, ...tenantDomains]);
  const origins: string[] = [];
  for (const host of hosts) {
    if (host === 'localhost') {
      origins.push('http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175');
    } else {
      origins.push(`https://${host}`);
    }
  }
  return origins;
}
