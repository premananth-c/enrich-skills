import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { controlPrisma } from '../lib/controlPrisma.js';
import { provisionTenant } from '../lib/provisionTenant.js';
import { encryptSecret, decryptSecret } from '../lib/crypto.js';
import {
  deleteCustomHostname,
  getCustomHostname,
  getFallbackOrigin,
  isCloudflareConfigured,
  registerCustomHostname,
} from '../lib/cloudflare.js';

interface SuperAdminTokenPayload {
  sub: string;
  scope: 'super_admin_global';
  email: string;
}

async function requireGlobalSuperAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<SuperAdminTokenPayload | null> {
  try {
    await request.jwtVerify();
    const user = request.user as SuperAdminTokenPayload | undefined;
    if (!user || user.scope !== 'super_admin_global') {
      reply.status(403).send({ error: 'Super-admin access required' });
      return null;
    }
    const row = await controlPrisma.superAdmin.findUnique({
      where: { id: user.sub },
      select: { isActive: true },
    });
    if (!row || !row.isActive) {
      reply.status(401).send({ error: 'Super-admin account is no longer active' });
      return null;
    }
    return user;
  } catch {
    reply.status(401).send({ error: 'Unauthorized' });
    return null;
  }
}

export async function superAdminAuthRoutes(app: FastifyInstance) {
  app.post('/login', async (request, reply) => {
    const body = request.body as { email?: string; password?: string };
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    if (!email || !password) {
      return reply.status(400).send({ error: 'email and password are required' });
    }
    const admin = await controlPrisma.superAdmin.findUnique({ where: { email } });
    if (!admin || !admin.isActive) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }
    await controlPrisma.superAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
    const token = app.jwt.sign(
      { sub: admin.id, scope: 'super_admin_global', email: admin.email } satisfies SuperAdminTokenPayload,
      { expiresIn: '8h' }
    );
    return reply.send({
      token,
      expiresIn: 28800,
      admin: { id: admin.id, email: admin.email, name: admin.name },
    });
  });

  app.get('/me', async (request, reply) => {
    const user = await requireGlobalSuperAdmin(request, reply);
    if (!user) return;
    const admin = await controlPrisma.superAdmin.findUnique({
      where: { id: user.sub },
      select: { id: true, email: true, name: true },
    });
    return reply.send(admin);
  });
}

export async function superAdminTenantRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request, reply) => {
    const ok = await requireGlobalSuperAdmin(request, reply);
    if (!ok) return;
  });

  app.get('/', async (_request, reply) => {
    const tenants = await controlPrisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        domains: { select: { id: true, host: true, kind: true, verifiedAt: true } },
        dbConfig: { select: { provisionedAt: true, dbName: true } },
      },
    });
    return reply.send(tenants);
  });

  app.post('/', async (request, reply) => {
    const body = request.body as {
      name: string;
      slug: string;
      primaryHost?: string;
      branding?: {
        primaryColor?: string;
        secondaryColor?: string;
        fontFamily?: string;
        logoUrl?: string;
        faviconUrl?: string;
      };
    };
    if (!body.name || !body.slug) {
      return reply.status(400).send({ error: 'name and slug are required' });
    }
    try {
      const result = await provisionTenant({
        name: body.name,
        slug: body.slug,
        primaryHost: body.primaryHost,
        branding: body.branding,
      });
      return reply.status(201).send(result);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Provisioning failed' });
    }
  });

  app.get('/:id', async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const tenant = await controlPrisma.tenant.findUnique({
      where: { id },
      include: {
        domains: true,
        branding: true,
        dbConfig: { select: { provisionedAt: true } },
      },
    });
    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });
    return reply.send(tenant);
  });

  app.patch('/:id', async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const body = request.body as { name?: string; status?: 'active' | 'suspended' | 'trial' | 'cancelled' };
    const tenant = await controlPrisma.tenant.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.status && { status: body.status }),
      },
    });
    return reply.send(tenant);
  });

  // ---- Branding ----
  app.get('/:id/branding', async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const branding = await controlPrisma.tenantBranding.findUnique({ where: { tenantId: id } });
    return reply.send(branding ?? null);
  });

  app.put('/:id/branding', async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const body = request.body as {
      productName?: string;
      logoUrl?: string;
      faviconUrl?: string;
      primaryColor?: string;
      accentColor?: string;
      supportEmail?: string;
      customCss?: string;
    };
    const branding = await controlPrisma.tenantBranding.upsert({
      where: { tenantId: id },
      update: body,
      create: { tenantId: id, ...body },
    });
    return reply.send(branding);
  });

  // ---- Domains ----
  app.get('/:id/domains', async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const domains = await controlPrisma.tenantDomain.findMany({
      where: { tenantId: id },
      orderBy: { createdAt: 'asc' },
    });
    return reply.send(domains);
  });

  app.post('/:id/domains', async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const body = request.body as { host: string; kind?: 'admin' | 'student' };
    if (!body.host) return reply.status(400).send({ error: 'host is required' });
    const host = body.host.trim().toLowerCase();

    let cloudflareHostnameId: string | null = null;
    let cloudflareDcv: { type: string; name: string; value: string } | null = null;
    if (isCloudflareConfigured()) {
      try {
        const cf = await registerCustomHostname(host);
        cloudflareHostnameId = cf.id;
        cloudflareDcv = cf.ownership_verification ?? null;
      } catch (err) {
        request.log.error({ err }, 'cloudflare custom hostname registration failed');
        return reply.status(502).send({ error: err instanceof Error ? err.message : 'Cloudflare API error' });
      }
    }

    try {
      const domain = await controlPrisma.tenantDomain.create({
        data: {
          tenantId: id,
          host,
          kind: body.kind ?? 'admin',
          cloudflareHostnameId,
        },
      });
      return reply.status(201).send({
        ...domain,
        fallbackOrigin: getFallbackOrigin(),
        ownershipVerification: cloudflareDcv,
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        return reply.status(409).send({ error: 'Host already registered to a tenant' });
      }
      throw err;
    }
  });

  // Refresh DCV/TLS status from Cloudflare for one domain.
  app.post('/:id/domains/:domainId/refresh', async (request, reply) => {
    const { id, domainId } = request.params as { id: string; domainId: string };
    const domain = await controlPrisma.tenantDomain.findFirst({
      where: { id: domainId, tenantId: id },
    });
    if (!domain) return reply.status(404).send({ error: 'Domain not found' });
    if (!domain.cloudflareHostnameId || !isCloudflareConfigured()) {
      return reply.send(domain);
    }
    try {
      const cf = await getCustomHostname(domain.cloudflareHostnameId);
      const verifiedAt = cf.status === 'active' ? new Date() : null;
      const updated = await controlPrisma.tenantDomain.update({
        where: { id: domainId },
        data: { verifiedAt },
      });
      return reply.send({
        ...updated,
        cloudflareStatus: cf.status,
        cloudflareSslStatus: cf.ssl?.status ?? null,
        ownershipVerification: cf.ownership_verification ?? null,
      });
    } catch (err) {
      request.log.error({ err }, 'cloudflare hostname refresh failed');
      return reply.status(502).send({ error: err instanceof Error ? err.message : 'Cloudflare API error' });
    }
  });

  app.delete('/:id/domains/:domainId', async (request, reply) => {
    const { id, domainId } = request.params as { id: string; domainId: string };
    const domain = await controlPrisma.tenantDomain.findFirst({
      where: { id: domainId, tenantId: id },
    });
    if (domain?.cloudflareHostnameId && isCloudflareConfigured()) {
      try {
        await deleteCustomHostname(domain.cloudflareHostnameId);
      } catch (err) {
        request.log.warn({ err }, 'cloudflare delete failed; continuing with local delete');
      }
    }
    await controlPrisma.tenantDomain.deleteMany({ where: { id: domainId, tenantId: id } });
    return reply.status(204).send();
  });

  // ---- Payment credentials (M6) ----
  app.get('/:id/payment-credentials', async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const creds = await controlPrisma.tenantPaymentCredential.findMany({
      where: { tenantId: id },
      select: {
        id: true,
        provider: true,
        publicKey: true,
        mode: true,
        currency: true,
        isActive: true,
        updatedAt: true,
      },
    });
    return reply.send(creds);
  });

  app.put('/:id/payment-credentials/:provider', async (request, reply) => {
    const { id, provider } = request.params as { id: string; provider: 'razorpay' | 'stripe' };
    const body = request.body as {
      publicKey: string;
      secretKey: string;
      webhookSecret?: string;
      mode?: 'live' | 'test';
      currency?: string;
      isActive?: boolean;
    };
    if (!body.publicKey || !body.secretKey) {
      return reply.status(400).send({ error: 'publicKey and secretKey are required' });
    }
    const cred = await controlPrisma.tenantPaymentCredential.upsert({
      where: { tenantId_provider: { tenantId: id, provider } },
      update: {
        publicKey: body.publicKey,
        secretKeyEnc: encryptSecret(body.secretKey),
        webhookSecretEnc: body.webhookSecret ? encryptSecret(body.webhookSecret) : '',
        mode: body.mode ?? 'live',
        currency: body.currency ?? 'INR',
        isActive: body.isActive ?? true,
      },
      create: {
        tenantId: id,
        provider,
        publicKey: body.publicKey,
        secretKeyEnc: encryptSecret(body.secretKey),
        webhookSecretEnc: body.webhookSecret ? encryptSecret(body.webhookSecret) : '',
        mode: body.mode ?? 'live',
        currency: body.currency ?? 'INR',
        isActive: body.isActive ?? true,
      },
    });
    return reply.send({
      id: cred.id,
      provider: cred.provider,
      publicKey: cred.publicKey,
      mode: cred.mode,
      currency: cred.currency,
      isActive: cred.isActive,
    });
  });

  // Reveal a decrypted secret on demand (for super-admin troubleshooting).
  // Audited via AuditLog.
  app.post('/:id/payment-credentials/:provider/reveal', async (request, reply) => {
    const { id, provider } = request.params as { id: string; provider: string };
    const cred = await controlPrisma.tenantPaymentCredential.findUnique({
      where: { tenantId_provider: { tenantId: id, provider } },
    });
    if (!cred) return reply.status(404).send({ error: 'Credential not found' });
    const actor = request.user as SuperAdminTokenPayload;
    await controlPrisma.auditLog.create({
      data: {
        superAdminId: actor.sub,
        tenantId: id,
        action: 'payment_credential.reveal',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
        metadata: { provider, credentialId: cred.id },
      },
    });
    return reply.send({
      secretKey: decryptSecret(cred.secretKeyEnc),
      webhookSecret: cred.webhookSecretEnc ? decryptSecret(cred.webhookSecretEnc) : null,
    });
  });
}
