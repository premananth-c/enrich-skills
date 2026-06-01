import { Prisma, type PrismaClient } from '@prisma/client';

export async function createNotification(
  prisma: PrismaClient,
  params: {
    userId: string;
    tenantId: string;
    type: string;
    title: string;
    message: string;
    metadata?: Prisma.InputJsonValue;
  }
) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      tenantId: params.tenantId,
      type: params.type,
      title: params.title,
      message: params.message,
      metadata: params.metadata ?? Prisma.JsonNull,
    },
  });
}

export async function createBulkNotifications(
  prisma: PrismaClient,
  params: {
    userIds: string[];
    tenantId: string;
    type: string;
    title: string;
    message: string;
    metadata?: Prisma.InputJsonValue;
  }
) {
  return prisma.notification.createMany({
    data: params.userIds.map((userId) => ({
      userId,
      tenantId: params.tenantId,
      type: params.type,
      title: params.title,
      message: params.message,
      metadata: params.metadata ?? Prisma.JsonNull,
    })),
  });
}
