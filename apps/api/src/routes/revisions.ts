import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireModuleAccess, authenticate } from '../lib/tenant.js';

export async function revisionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get(
    '/',
    async (
      request: FastifyRequest<{ Querystring: { module?: string; entityId?: string } }>,
      reply: FastifyReply
    ) => {
      const tenantId = await requireModuleAccess(request, 'reports', 'view');
      const { module, entityId } = request.query;
      const logs = await prisma.revisionLog.findMany({
        where: {
          tenantId,
          ...(module ? { module } : {}),
          ...(entityId ? { entityId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return reply.send(logs);
    }
  );
}
