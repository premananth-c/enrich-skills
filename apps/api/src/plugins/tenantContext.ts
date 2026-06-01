// Fastify plugin that resolves the tenant for each request and exposes
// helpers for downstream handlers:
//
//   request.getTenant()        -> Promise<ResolvedTenant | null>
//   request.getTenantPrisma()  -> Promise<PrismaClient>
//
// Resolution order (first match wins):
//   1. `X-Tenant-Id` header (explicit override; gated to super-admin in M4).
//   2. `X-Tenant-Host` header — the white-label hostname forwarded by the SPA
//      (browser calls hit the shared API origin, so the real `Host` is the API
//      domain; the SPA forwards its own hostname here). Looked up in
//      `TenantDomain` (control plane), cached 5 min.
//   3. `Host` header looked up in `TenantDomain` (covers server-to-server or
//      requests made directly against a tenant's API hostname).
//   4. JWT `tenantId` claim (after authenticate hook has run).
//
// The plugin is purely additive — existing routes that import `prisma`
// directly continue to work. M3 migrates routes off `prisma` and onto
// `request.getTenantPrisma()`.

import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { PrismaClient } from '@prisma/client';
import { controlPrisma } from '../lib/controlPrisma.js';
import { getTenantPrisma } from '../lib/tenantPrisma.js';
import { prisma as legacyPrisma } from '../lib/prisma.js';

// Transition safety valve. When set, requests that resolve no tenant fall back
// to the legacy shared DB instead of failing with 400. This lets the
// white-label code deploy and behave exactly like the pre-white-label
// single-tenant app until the control plane is provisioned and tenants are
// registered. Turn OFF (unset) once every live host is a registered tenant,
// to enforce strict isolation.
const LEGACY_FALLBACK = ['1', 'true', 'yes'].includes(
  (process.env.WHITELABEL_LEGACY_FALLBACK ?? '').trim().toLowerCase()
);

export interface ResolvedTenant {
  id: string;
  slug: string;
  name: string;
  status: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Resolve the tenant for this request. Memoized per request.
     * Returns `null` for ambient requests with no tenant context (e.g. /health).
     */
    getTenant(): Promise<ResolvedTenant | null>;
    /**
     * Resolve the per-tenant PrismaClient. Throws if the request has no
     * tenant context. Pre-M7, falls back to the legacy shared DB when the
     * tenant has no dedicated DB provisioned yet.
     */
    getTenantPrisma(): Promise<PrismaClient>;
  }
}

interface HostCacheEntry {
  tenantId: string | null;
  expiresAt: number;
}

const HOST_CACHE_TTL_MS = 5 * 60 * 1000;
const hostCache = new Map<string, HostCacheEntry>();

function normalizeHost(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  // Strip optional port (e.g. localhost:5173)
  const colon = trimmed.indexOf(':');
  return colon === -1 ? trimmed : trimmed.slice(0, colon);
}

async function lookupTenantByHost(host: string): Promise<string | null> {
  const cached = hostCache.get(host);
  if (cached && cached.expiresAt > Date.now()) return cached.tenantId;
  try {
    const domain = await controlPrisma.tenantDomain.findUnique({
      where: { host },
      select: { tenantId: true },
    });
    const tenantId = domain?.tenantId ?? null;
    hostCache.set(host, { tenantId, expiresAt: Date.now() + HOST_CACHE_TTL_MS });
    return tenantId;
  } catch {
    return null;
  }
}

async function loadTenant(tenantId: string): Promise<ResolvedTenant | null> {
  try {
    const t = await controlPrisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true, name: true, status: true },
    });
    return t;
  } catch {
    return null;
  }
}

async function resolveTenant(request: FastifyRequest): Promise<ResolvedTenant | null> {
  const headerVal = request.headers['x-tenant-id'];
  const headerTenantId = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  if (headerTenantId) {
    const t = await loadTenant(headerTenantId);
    if (t) return t;
  }

  // Hostname forwarded by the SPA (the real `Host` is the shared API origin).
  const fwdVal = request.headers['x-tenant-host'];
  const fwdHost = normalizeHost(Array.isArray(fwdVal) ? fwdVal[0] : fwdVal);
  if (fwdHost) {
    const tenantId = await lookupTenantByHost(fwdHost);
    if (tenantId) {
      const t = await loadTenant(tenantId);
      if (t) return t;
    }
  }

  const host = normalizeHost(request.hostname ?? (request.headers.host as string | undefined));
  if (host) {
    const tenantId = await lookupTenantByHost(host);
    if (tenantId) {
      const t = await loadTenant(tenantId);
      if (t) return t;
    }
  }

  const jwtPayload = request.user as { tenantId?: string } | undefined;
  if (jwtPayload?.tenantId) {
    const t = await loadTenant(jwtPayload.tenantId);
    if (t) return t;
  }

  return null;
}

async function tenantContextPlugin(app: FastifyInstance): Promise<void> {
  // Per-request memoization slots. We use Symbols on the request object
  // rather than declaring them on the FastifyRequest type, since they are
  // implementation details of this plugin.
  const TENANT_KEY = Symbol('tenant');
  const TENANT_PRISMA_KEY = Symbol('tenantPrisma');

  app.decorateRequest('getTenant', async function (this: FastifyRequest) {
    const slot = (this as unknown as Record<symbol, Promise<ResolvedTenant | null>>);
    if (!slot[TENANT_KEY]) {
      slot[TENANT_KEY] = resolveTenant(this);
    }
    return slot[TENANT_KEY];
  });

  app.decorateRequest('getTenantPrisma', async function (this: FastifyRequest) {
    const slot = (this as unknown as Record<symbol, Promise<PrismaClient>>);
    if (!slot[TENANT_PRISMA_KEY]) {
      slot[TENANT_PRISMA_KEY] = (async () => {
        const tenant = await this.getTenant();
        if (!tenant) {
          if (LEGACY_FALLBACK) {
            // Transition mode: behave like the legacy single-tenant app.
            return legacyPrisma;
          }
          const err = new Error('Tenant context required') as Error & { statusCode?: number };
          err.statusCode = 400;
          throw err;
        }
        if (tenant.status !== 'active' && tenant.status !== 'trial') {
          const err = new Error(`Tenant is ${tenant.status}`) as Error & { statusCode?: number };
          err.statusCode = 403;
          throw err;
        }
        return getTenantPrisma(tenant.id);
      })();
    }
    return slot[TENANT_PRISMA_KEY];
  });
}

export default fp(tenantContextPlugin, {
  name: 'tenant-context',
});
