import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  let tenant = await prisma.tenant.findFirst({ where: { slug: 'default' } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Default Tenant',
        slug: 'default',
        status: 'active',
        featureFlags: { coding: true, mcq: true },
      },
    });
  }

  const passwordHash = await bcrypt.hash('admin123', 12);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@example.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@example.com',
      passwordHash,
      name: 'Admin User',
      role: 'admin',
    },
  });

  const studentHash = await bcrypt.hash('student123', 12);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'student@example.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'student@example.com',
      passwordHash: studentHash,
      name: 'Student User',
      role: 'student',
    },
  });

  const existingQ = await prisma.question.findFirst({
    where: { tenantId: tenant.id, type: 'coding' },
  });

  let q = existingQ;
  if (!q) {
    q = await prisma.question.create({
      data: {
        tenantId: tenant.id,
        type: 'coding',
        content: {
          title: 'Sum of Two Numbers',
          description: 'Write a function that returns the sum of two numbers a and b.',
          examples: [{ input: '2 3', output: '5' }],
          constraints: ['-1000 <= a, b <= 1000'],
        },
        difficulty: 'easy',
        tags: ['math', 'basic'],
        testCases: {
          create: [
            { input: '1 2', expectedOutput: '3', isPublic: true, weight: 1 },
            { input: '-1 1', expectedOutput: '0', isPublic: false, weight: 1 },
          ],
        },
      },
    });
  }

  const existingTest = await prisma.test.findFirst({
    where: { tenantId: tenant.id, title: 'Sample Coding Test' },
  });

  if (!existingTest) {
    await prisma.test.create({
      data: {
        tenantId: tenant.id,
        title: 'Sample Coding Test',
        type: 'coding',
        status: 'published',
        config: {
          durationMinutes: 60,
          attemptLimit: 3,
          shuffleQuestions: false,
          showResultsImmediately: true,
          partialScoring: true,
          proctoringEnabled: false,
          aiFeedbackEnabled: true,
        },
        testQuestions: {
          create: [{ questionId: q.id, order: 0 }],
        },
      },
    });
  }

  console.log('Seed complete. Login: admin@example.com / admin123 (admin), student@example.com / student123 (student)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
