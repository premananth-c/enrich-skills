import { FastifyRequest } from 'fastify';

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
