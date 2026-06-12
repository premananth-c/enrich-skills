import type { PrismaClient } from '@prisma/client';
import type { ClientScope } from './clientScope.js';

export async function getClientBatchIds(
  prisma: PrismaClient,
  tenantId: string,
  clientId: string
): Promise<string[]> {
  const batches = await prisma.batch.findMany({
    where: { tenantId, clientId },
    select: { id: true },
  });
  return batches.map((b) => b.id);
}

/** Students who are members of at least one batch belonging to the client. */
export async function getStudentIdsInClientBatches(
  prisma: PrismaClient,
  tenantId: string,
  clientId: string
): Promise<string[]> {
  const batchIds = await getClientBatchIds(prisma, tenantId, clientId);
  if (batchIds.length === 0) return [];
  const members = await prisma.batchMember.findMany({
    where: { batchId: { in: batchIds } },
    select: { userId: true },
    distinct: ['userId'],
  });
  return members.map((m) => m.userId);
}

export async function assertStudentInClientScope(
  prisma: PrismaClient,
  tenantId: string,
  scope: ClientScope,
  studentId: string
): Promise<void> {
  if (scope.mode === 'all') return;
  const allowed = await getStudentIdsInClientBatches(prisma, tenantId, scope.clientId);
  if (!allowed.includes(studentId)) {
    const err = new Error('You do not have access to this student') as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  }
}

/** Test IDs assigned to any batch owned by the client. */
export async function getTestIdsForClientBatches(
  prisma: PrismaClient,
  tenantId: string,
  clientId: string
): Promise<string[]> {
  const batchIds = await getClientBatchIds(prisma, tenantId, clientId);
  if (batchIds.length === 0) return [];
  const assignments = await prisma.batchTestAssignment.findMany({
    where: { batchId: { in: batchIds } },
    select: { testId: true },
    distinct: ['testId'],
  });
  return assignments.map((a) => a.testId);
}

export async function resolveStudentClientIds(
  prisma: PrismaClient,
  tenantId: string,
  scope: ClientScope,
  requestedIds?: string[]
): Promise<{ clientIds: string[]; primaryClientId: string | null }> {
  if (scope.mode === 'client') {
    return { clientIds: [scope.clientId], primaryClientId: scope.clientId };
  }
  const unique = [...new Set((requestedIds ?? []).filter(Boolean))];
  if (unique.length > 0) {
    const valid = await prisma.client.findMany({
      where: { tenantId, id: { in: unique }, isArchived: false },
      select: { id: true },
    });
    const ids = valid.map((c) => c.id);
    if (ids.length === 0) {
      const err = new Error('No valid clients selected') as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }
    return { clientIds: ids, primaryClientId: ids[0] ?? null };
  }
  const general = await prisma.client.findFirst({
    where: { tenantId, isGeneral: true },
    select: { id: true },
  });
  const id = general?.id ?? null;
  return { clientIds: id ? [id] : [], primaryClientId: id };
}

export function effectiveClientIds(user: { clientId: string | null; clientIds?: string[] }): string[] {
  if (user.clientIds && user.clientIds.length > 0) return user.clientIds;
  return user.clientId ? [user.clientId] : [];
}

export async function enrichStudentsWithClients<T extends { clientId: string | null; clientIds?: string[] }>(
  prisma: PrismaClient,
  users: T[]
): Promise<Array<T & { clients: { id: string; name: string }[]; client?: { id: string; name: string } | null }>> {
  const idSet = new Set<string>();
  for (const u of users) {
    for (const id of effectiveClientIds(u)) idSet.add(id);
  }
  const clientRows =
    idSet.size > 0
      ? await prisma.client.findMany({
          where: { id: { in: [...idSet] } },
          select: { id: true, name: true },
        })
      : [];
  const byId = new Map(clientRows.map((c) => [c.id, c]));
  return users.map((u) => {
    const ids = effectiveClientIds(u);
    const clients = ids.map((id) => byId.get(id)).filter((c): c is { id: string; name: string } => !!c);
    return {
      ...u,
      clients,
      client: clients[0] ?? (u.clientId ? byId.get(u.clientId) ?? null : null),
    };
  });
}
