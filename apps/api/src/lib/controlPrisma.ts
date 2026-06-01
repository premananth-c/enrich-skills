// Singleton Prisma client for the Rankership control-plane DB.
//
// The control-plane DB holds tenant metadata: registry, custom domains,
// encrypted DB connection strings, branding, payment credentials,
// super-admin users, audit logs and cross-tenant landing-page enquiries.
//
// All tenant business data lives in per-tenant DBs accessed via
// `request.tenantPrisma` from the `tenantContext` Fastify plugin (added
// in M2). NEVER use this client to read tenant business data.

import { PrismaClient } from '../generated/prisma-control/index.js';

declare global {
  // Reuse a single client across hot reloads in dev (tsx watch).
  // eslint-disable-next-line no-var
  var __controlPrisma: PrismaClient | undefined;
}

export const controlPrisma: PrismaClient =
  globalThis.__controlPrisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.CONTROL_DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__controlPrisma = controlPrisma;
}
