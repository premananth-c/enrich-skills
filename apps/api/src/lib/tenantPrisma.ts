// Resolve and cache per-tenant Prisma clients.
//
// Each tenant has its own Postgres database (post-M7 cutover). At request
// time we look up the tenant's encrypted connection string in the control
// plane (TenantDbConfig), decrypt it, and create a tenant-scoped PrismaClient.
// Clients are kept in a small LRU keyed by tenantId.
//
// Backwards-compat: if a tenant has no TenantDbConfig row (pre-cutover, or a
// tenant that was created before M7), we fall back to the legacy shared
// `prisma` client (apps/api/src/lib/prisma.ts) which still talks to the
// single DATABASE_URL. This lets every milestone before M7 ship without
// requiring any data migration.
//
// The PrismaClient type returned here is the TENANT client (from
// `@prisma/client`), not the control client. Tenant DBs share one schema so
// they all share one generated client class.

import { PrismaClient } from '@prisma/client';
import { controlPrisma } from './controlPrisma.js';
import { decryptSecret } from './crypto.js';
import { prisma as legacyPrisma } from './prisma.js';

interface CacheEntry {
  client: PrismaClient;
  lastUsedAt: number;
}

const MAX_ENTRIES = 50;
const IDLE_TTL_MS = 30 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<PrismaClient>>();

async function disconnectQuietly(client: PrismaClient): Promise<void> {
  try {
    await client.$disconnect();
  } catch {
    // best-effort — eviction must not throw
  }
}

function evictOldest(): void {
  let oldestKey: string | null = null;
  let oldestUsed = Infinity;
  for (const [k, v] of cache) {
    if (v.lastUsedAt < oldestUsed) {
      oldestUsed = v.lastUsedAt;
      oldestKey = k;
    }
  }
  if (oldestKey) {
    const entry = cache.get(oldestKey)!;
    cache.delete(oldestKey);
    void disconnectQuietly(entry.client);
  }
}

function startSweeper(): void {
  const timer = setInterval(() => {
    const cutoff = Date.now() - IDLE_TTL_MS;
    for (const [k, v] of cache) {
      if (v.lastUsedAt < cutoff) {
        cache.delete(k);
        void disconnectQuietly(v.client);
      }
    }
  }, SWEEP_INTERVAL_MS);
  timer.unref();
}

let sweeperStarted = false;
function ensureSweeper(): void {
  if (sweeperStarted) return;
  sweeperStarted = true;
  startSweeper();
}

async function buildTenantClient(tenantId: string): Promise<PrismaClient> {
  let config: { connectionUrlEnc: string } | null = null;
  try {
    config = await controlPrisma.tenantDbConfig.findUnique({
      where: { tenantId },
      select: { connectionUrlEnc: true },
    });
  } catch {
    // Control plane unreachable (e.g. CONTROL_DATABASE_URL not configured
    // yet during early milestones). Fall through to the legacy client.
    return legacyPrisma;
  }

  if (!config) {
    // Tenant exists but its dedicated DB hasn't been provisioned yet —
    // typical state pre-M7. Use the legacy shared DB.
    return legacyPrisma;
  }

  const url = decryptSecret(config.connectionUrlEnc);
  return new PrismaClient({ datasources: { db: { url } } });
}

/**
 * Get the PrismaClient for the given tenant. Cached per tenantId in an LRU.
 * Pre-cutover, returns the legacy shared client when no `TenantDbConfig`
 * row exists.
 */
export async function getTenantPrisma(tenantId: string): Promise<PrismaClient> {
  ensureSweeper();

  const existing = cache.get(tenantId);
  if (existing) {
    existing.lastUsedAt = Date.now();
    return existing.client;
  }

  const pending = inFlight.get(tenantId);
  if (pending) return pending;

  const promise = buildTenantClient(tenantId).then((client) => {
    inFlight.delete(tenantId);
    if (client === legacyPrisma) {
      // Don't take a slot in the LRU for the shared legacy fallback.
      return client;
    }
    if (cache.size >= MAX_ENTRIES) evictOldest();
    cache.set(tenantId, { client, lastUsedAt: Date.now() });
    return client;
  }).catch((err) => {
    inFlight.delete(tenantId);
    throw err;
  });

  inFlight.set(tenantId, promise);
  return promise;
}

/**
 * Disconnect every cached client. Call on graceful shutdown.
 */
export async function disconnectAllTenantClients(): Promise<void> {
  const entries = Array.from(cache.values());
  cache.clear();
  await Promise.all(entries.map((e) => disconnectQuietly(e.client)));
}
