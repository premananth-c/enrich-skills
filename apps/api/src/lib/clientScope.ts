import { FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { requireTenant } from './tenant.js';

export type ClientScope =
  | { mode: 'all' }
  | { mode: 'client'; clientId: string };

/**
 * Tenant-wide admins are never restricted to a single client.
 */
export function isUnrestrictedAdmin(request: FastifyRequest): boolean {
  const role = (request.user as { role?: string } | undefined)?.role;
  return role === 'admin' || role === 'super_admin';
}

/**
 * Resolve which client(s) the current admin user can access.
 * - super_admin and admin always see all clients (even if they have a ClientMember row).
 * - Custom-role users with a ClientMember row are scoped to that client.
 * - Everyone else sees everything.
 */
export async function resolveClientScope(
  request: FastifyRequest,
  prisma: PrismaClient
): Promise<ClientScope> {
  const payload = request.user as { sub?: string } | undefined;
  if (!payload?.sub) return { mode: 'all' };
  if (isUnrestrictedAdmin(request)) return { mode: 'all' };

  const tenantId = requireTenant(request);
  const membership = await (prisma as any).clientMember.findFirst({
    where: { userId: payload.sub },
    select: { clientId: true },
  });

  if (!membership) return { mode: 'all' };
  return { mode: 'client', clientId: membership.clientId };
}

/**
 * Returns a Prisma `where` fragment to filter by client scope.
 * For `mode: 'all'`, returns an empty object (no filter).
 */
export function clientWhere(scope: ClientScope): { clientId?: string } {
  if (scope.mode === 'all') return {};
  return { clientId: scope.clientId };
}

/**
 * Throws 403 if the requesting user's client scope doesn't include the
 * resource's clientId.
 */
export function assertClientAccess(scope: ClientScope, resourceClientId: string | null): void {
  if (scope.mode === 'all') return;
  if (resourceClientId && resourceClientId !== scope.clientId) {
    const err = new Error('You do not have access to this resource') as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  }
}
