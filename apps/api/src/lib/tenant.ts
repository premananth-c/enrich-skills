import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from './prisma.js';

export const MODULE_KEYS = [
  'courses',
  'batches',
  'tests',
  'questions',
  'students',
  'reports',
  'manage_users',
  'meetings',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
export type PermissionLevel = 'none' | 'view' | 'edit';

type UserTokenPayload = { sub?: string; tenantId?: string; role?: string };

const DEFAULT_ADMIN_PERMISSIONS: Record<ModuleKey, PermissionLevel> = {
  courses: 'edit',
  batches: 'edit',
  tests: 'edit',
  questions: 'edit',
  students: 'edit',
  reports: 'edit',
  manage_users: 'none',
  meetings: 'edit',
};

function hasLevel(granted: PermissionLevel, required: 'view' | 'edit') {
  if (required === 'view') return granted === 'view' || granted === 'edit';
  return granted === 'edit';
}

export function getTenantId(request: FastifyRequest): string | null {
  const header = request.headers['x-tenant-id'] as string | undefined;
  if (header) return header;
  const jwtPayload = request.user as { tenantId?: string } | undefined;
  return jwtPayload?.tenantId ?? null;
}

export function requireTenant(request: FastifyRequest): string {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    const err = new Error('Tenant context required') as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }
  return tenantId;
}

export function requireAdmin(request: FastifyRequest): string {
  const payload = request.user as UserTokenPayload | undefined;
  if (!payload?.role || (payload.role !== 'admin' && payload.role !== 'super_admin')) {
    const err = new Error('Admin access required') as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  }
  return requireTenant(request);
}

export function isSuperAdmin(request: FastifyRequest): boolean {
  const payload = request.user as UserTokenPayload | undefined;
  return payload?.role === 'super_admin';
}

export async function getResolvedPermissions(request: FastifyRequest): Promise<Record<ModuleKey, PermissionLevel>> {
  const payload = request.user as UserTokenPayload | undefined;
  const role = payload?.role ?? '';
  const tenantId = requireTenant(request);

  if (role === 'super_admin') {
    return {
      courses: 'edit',
      batches: 'edit',
      tests: 'edit',
      questions: 'edit',
      students: 'edit',
      reports: 'edit',
      manage_users: 'edit',
      meetings: 'edit',
    };
  }

  if (role === 'admin') {
    return { ...DEFAULT_ADMIN_PERMISSIONS };
  }

  const roleDefinition = await prisma.roleDefinition.findFirst({
    where: { tenantId, roleKey: role, isActive: true },
    select: { permissions: true },
  });
  const base = { ...DEFAULT_ADMIN_PERMISSIONS };
  for (const key of MODULE_KEYS) base[key] = 'none';
  if (!roleDefinition?.permissions || typeof roleDefinition.permissions !== 'object') return base;
  const permissionObj = roleDefinition.permissions as Record<string, unknown>;
  for (const key of MODULE_KEYS) {
    const raw = permissionObj[key];
    if (raw === 'view' || raw === 'edit') base[key] = raw;
  }
  return base;
}

export async function requireModuleAccess(
  request: FastifyRequest,
  moduleKey: ModuleKey,
  access: 'view' | 'edit'
): Promise<string> {
  const tenantId = requireTenant(request);
  const permissions = await getResolvedPermissions(request);
  const granted = permissions[moduleKey] ?? 'none';
  if (!hasLevel(granted, access)) {
    const err = new Error('You dont have permission to view this page.') as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  }
  return tenantId;
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const payload = request.user as UserTokenPayload | undefined;
  if (payload?.sub) {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isActive: true },
    });
    if (!user || !user.isActive) {
      return reply.status(401).send({ error: 'Your account has been deactivated' });
    }
  }
}
