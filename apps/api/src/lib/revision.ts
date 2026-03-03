import { prisma } from './prisma.js';
import type { Prisma } from '@prisma/client';

type RevisionModule = 'tests' | 'students' | 'courses' | 'questions';
type RevisionAction = 'created' | 'updated' | 'archived';

interface LogRevisionInput {
  tenantId: string;
  module: RevisionModule;
  entityId: string;
  action: RevisionAction;
  userId?: string;
  details?: Record<string, unknown>;
}

export async function logRevision(input: LogRevisionInput) {
  let userName: string | null = null;
  if (input.userId) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { name: true },
    });
    userName = user?.name ?? null;
  }

  await prisma.revisionLog.create({
    data: {
      tenantId: input.tenantId,
      module: input.module,
      entityId: input.entityId,
      action: input.action,
      userId: input.userId ?? null,
      userName,
      details: (input.details ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
