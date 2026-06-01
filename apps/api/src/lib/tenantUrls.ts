// Resolve the public web URLs (student LMS + admin portal) for a tenant.
//
// White-label tenants serve their apps from their own custom domains
// (e.g. lms.acme.com / lmsadmin.acme.com), recorded in the control plane as
// `TenantDomain` rows with `kind` = 'student' | 'admin'. Email links (invites,
// admin credentials) must point at the tenant's own domain, not the global
// fallback. When a tenant has no matching domain (or the control plane is
// unreachable), we fall back to the process-level env defaults.

import { controlPrisma } from './controlPrisma.js';

export interface TenantWebUrls {
  studentUrl: string;
  adminUrl: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { value: TenantWebUrls; expiresAt: number }>();

function envDefaults(): TenantWebUrls {
  return {
    studentUrl: process.env.INVITE_BASE_URL || process.env.STUDENT_WEB_URL || 'http://localhost:5173',
    adminUrl: process.env.ADMIN_WEB_URL || 'http://localhost:5174',
  };
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Returns `{ studentUrl, adminUrl }` for the tenant. Pass `null` (no tenant
 * context) to get the env defaults. Cached per-tenant for 5 minutes.
 */
export async function getTenantWebUrls(tenantId: string | null | undefined): Promise<TenantWebUrls> {
  const defaults = envDefaults();
  if (!tenantId) return defaults;

  const cached = cache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const domains = await controlPrisma.tenantDomain.findMany({
      where: { tenantId },
      select: { host: true, kind: true },
    });
    const student = domains.find((d) => d.kind === 'student')?.host;
    const admin = domains.find((d) => d.kind === 'admin')?.host;
    const value: TenantWebUrls = {
      studentUrl: student ? `https://${student}` : defaults.studentUrl,
      adminUrl: admin ? `https://${admin}` : defaults.adminUrl,
    };
    value.studentUrl = stripTrailingSlash(value.studentUrl);
    value.adminUrl = stripTrailingSlash(value.adminUrl);
    cache.set(tenantId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  } catch {
    // Control plane unreachable — fall back to env defaults.
    return defaults;
  }
}
