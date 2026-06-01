import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { controlPrisma } from '../lib/controlPrisma.js';

const HOST_TENANT_TTL_MS = 5 * 60 * 1000;
const hostCache = new Map<string, { tenantId: string | null; expiresAt: number }>();

function normalizeHost(host: string | undefined): string | null {
  if (!host) return null;
  const trimmed = host.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.split(':')[0];
}

async function resolveTenantIdByHost(host: string | undefined): Promise<string | null> {
  const norm = normalizeHost(host);
  if (!norm) return null;
  const cached = hostCache.get(norm);
  if (cached && cached.expiresAt > Date.now()) return cached.tenantId;

  const domain = await controlPrisma.tenantDomain.findUnique({
    where: { host: norm },
    select: { tenantId: true, tenant: { select: { status: true } } },
  });
  const tenantId = domain && domain.tenant.status === 'active' ? domain.tenantId : null;
  hostCache.set(norm, { tenantId, expiresAt: Date.now() + HOST_TENANT_TTL_MS });
  return tenantId;
}

export async function brandingRoutes(app: FastifyInstance) {
  // Public endpoint: returns the branding for the tenant inferred from
  // the Host header (custom domain) or X-Tenant-Id (override). Used by
  // admin-web and student-web to skin the app at runtime — including the
  // login page, where there is no JWT yet.
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const override = (request.headers['x-tenant-id'] as string)?.trim();
    let tenantId: string | null = override || null;

    // SPA-forwarded hostname takes priority over the real Host (which is the
    // shared API origin when the page is served from a white-label domain).
    if (!tenantId) {
      const fwdHost = (request.headers['x-tenant-host'] as string)?.trim();
      tenantId = await resolveTenantIdByHost(fwdHost || request.headers.host);
    }

    if (!tenantId) {
      return reply.send({
        tenantId: null,
        branding: null,
        productName: 'Rankership',
      });
    }

    const [tenant, branding] = await Promise.all([
      controlPrisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, slug: true, status: true },
      }),
      controlPrisma.tenantBranding.findUnique({
        where: { tenantId },
      }),
    ]);

    if (!tenant || tenant.status !== 'active') {
      return reply.send({ tenantId: null, branding: null, productName: 'Rankership' });
    }

    return reply.send({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      productName: branding?.productName ?? tenant.name,
      branding: branding
        ? {
            primaryColor: branding.primaryColor ?? '#0f172a',
            accentColor: branding.accentColor ?? '#0ea5e9',
            logoUrl: branding.logoUrl ?? null,
            faviconUrl: branding.faviconUrl ?? null,
            supportEmail: branding.supportEmail ?? null,
            customCss: branding.customCss ?? null,
            featureFlags: branding.featureFlags ?? {},
          }
        : null,
    });
  });
}
