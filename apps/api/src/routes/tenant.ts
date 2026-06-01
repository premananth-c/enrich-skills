import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { controlPrisma } from '../lib/controlPrisma.js';
import { createTenantSchema } from '@enrich-skills/shared';

export async function tenantRoutes(app: FastifyInstance) {
  // List active tenants (used by login page to populate the tenant picker).
  // Only public-safe fields are exposed; branding details now live in
  // TenantBranding and are served by GET /api/v1/branding (M5).
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenants = await controlPrisma.tenant.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        name: true,
        slug: true,
        domains: { select: { host: true, kind: true } },
      },
    });
    return reply.send(tenants);
  });

  app.get(
    '/:slug',
    async (request: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) => {
      const tenant = await controlPrisma.tenant.findFirst({
        where: { slug: request.params.slug, status: 'active' },
        select: {
          id: true,
          name: true,
          slug: true,
          domains: { select: { host: true, kind: true } },
          branding: true,
        },
      });
      if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });
      return reply.send(tenant);
    }
  );

  // Note: post-M4 the proper way to create a tenant is via the super-admin
  // app, which calls provisionTenant(). This handler stays for back-compat
  // and only writes registry rows; it does NOT provision a tenant DB.
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createTenantSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const data = parsed.data;

    const existing = await controlPrisma.tenant.findUnique({ where: { slug: data.slug } });
    if (existing) {
      return reply.status(409).send({ error: 'Slug already taken' });
    }

    const tenant = await controlPrisma.tenant.create({
      data: {
        name: data.name,
        slug: data.slug,
      },
    });

    return reply.status(201).send({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
    });
  });
}
