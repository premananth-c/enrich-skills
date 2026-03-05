import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { createEnquirySchema, updateEnquiryStatusSchema } from '@enrich-skills/shared';
import { authenticate, isSuperAdmin } from '../lib/tenant.js';

export async function enquiryRoutes(app: FastifyInstance) {
  // Public: submit enquiry (no auth required)
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createEnquirySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { name, email, phone, category, message } = parsed.data;
    const enquiry = await prisma.enquiry.create({
      data: { name, email, phone, category, message },
    });
    return reply.status(201).send({ id: enquiry.id, message: 'Thank you. We will get in touch soon.' });
  });

  // Super Admin only: list enquiries
  app.get(
    '/',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!isSuperAdmin(request)) {
        return reply.status(403).send({ error: "You don't have permission to view enquiries." });
      }
      const { status, limit = '50', offset = '0' } = request.query as { status?: string; limit?: string; offset?: string };
      const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
      const skip = Math.max(0, parseInt(offset, 10) || 0);
      const where = status && ['new', 'contacted', 'closed'].includes(status) ? { status } : {};
      const [enquiries, total] = await Promise.all([
        prisma.enquiry.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        prisma.enquiry.count({ where }),
      ]);
      return reply.send({ enquiries, total });
    }
  );

  // Super Admin only: update enquiry status
  app.patch(
    '/:id/status',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!isSuperAdmin(request)) {
        return reply.status(403).send({ error: "You don't have permission to update enquiries." });
      }
      const parsed = updateEnquiryStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      try {
        const id = (request.params as { id?: string }).id;
        if (!id) return reply.status(400).send({ error: 'Enquiry ID required' });
        const enquiry = await prisma.enquiry.update({
          where: { id },
          data: { status: parsed.data.status },
        });
        return reply.send(enquiry);
      } catch (err: unknown) {
        if (err && typeof err === 'object' && (err as { code?: string }).code === 'P2025') {
          return reply.status(404).send({ error: 'Enquiry not found' });
        }
        throw err;
      }
    }
  );
}
