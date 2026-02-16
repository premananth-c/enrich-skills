import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { createTenantSchema } from '@enrich-skills/shared';

export async function tenantRoutes(app: FastifyInstance) {
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenants = await prisma.tenant.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, slug: true, domain: true, brandingConfig: true },
    });
    return reply.send(tenants);
  });

  app.get('/:slug', async (request: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) => {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: request.params.slug, status: 'active' },
      select: { id: true, name: true, slug: true, domain: true, brandingConfig: true },
    });
    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });
    return reply.send(tenant);
  });

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createTenantSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const data = parsed.data;

    const existing = await prisma.tenant.findUnique({ where: { slug: data.slug } });
    if (existing) {
      return reply.status(409).send({ error: 'Slug already taken' });
    }

    const tenant = await prisma.tenant.create({
      data: {
        name: data.name,
        slug: data.slug,
        domain: data.domain,
        brandingConfig: data.brandingConfig ?? {},
      },
    });

    return reply.status(201).send({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      domain: tenant.domain,
      brandingConfig: tenant.brandingConfig,
    });
  });
}
