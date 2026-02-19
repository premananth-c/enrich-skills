import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { authRoutes } from './routes/auth.js';
import { tenantRoutes } from './routes/tenant.js';
import { testRoutes } from './routes/test.js';
import { questionRoutes } from './routes/question.js';
import { attemptRoutes } from './routes/attempt.js';
import { userRoutes } from './routes/users.js';
import { inviteRoutes } from './routes/invites.js';
import { prisma } from './lib/prisma.js';

const app = Fastify({ logger: true });

async function main() {
  await app.register(cors, { origin: true });
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  });

  // Health check
  app.get('/health', async () => ({ status: 'ok' }));

  // API routes
  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(tenantRoutes, { prefix: '/api/v1/tenants' });
  app.register(testRoutes, { prefix: '/api/v1/tests' });
  app.register(questionRoutes, { prefix: '/api/v1/questions' });
  app.register(attemptRoutes, { prefix: '/api/v1/attempts' });
  app.register(userRoutes, { prefix: '/api/v1/users' });
  app.register(inviteRoutes, { prefix: '/api/v1/invites' });

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen({ port, host: '0.0.0.0' });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
