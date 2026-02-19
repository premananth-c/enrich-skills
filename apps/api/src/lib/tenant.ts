import { FastifyRequest, FastifyReply } from 'fastify';

export function getTenantId(request: FastifyRequest): string | null {
  const header = request.headers['x-tenant-id'] as string | undefined;
  if (header) return header;
  const jwtPayload = request.user as { tenantId?: string } | undefined;
  return jwtPayload?.tenantId ?? null;
}

export function requireTenant(request: FastifyRequest): string {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    throw new Error('Tenant context required');
  }
  return tenantId;
}

export function requireAdmin(request: FastifyRequest): string {
  const payload = request.user as { tenantId?: string; role?: string } | undefined;
  if (!payload?.role || payload.role !== 'admin') {
    throw new Error('Admin access required');
  }
  return requireTenant(request);
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
}
