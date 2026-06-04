/**
 * provisionTenant.ts
 *
 * Provisions a new tenant: creates a dedicated Postgres role + database,
 * applies the tenant Prisma schema migrations on it, and stores the
 * encrypted connection URL in the control plane.
 *
 * Pre-requisites:
 *   - TENANT_DB_ADMIN_URL points at a Postgres superuser able to CREATE ROLE/DB.
 *   - CONTROL_DATABASE_URL is set.
 *   - TENANT_SECRETS_KEY is set.
 *   - Working `prisma` CLI on PATH (we shell out for migrations).
 */
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client as PgClient } from 'pg';
import { PrismaClient as TenantPrisma } from '@prisma/client';
import { controlPrisma } from './controlPrisma.js';
import { encryptSecret } from './crypto.js';

// Resolve the API package root regardless of how the code is invoked:
//   - dev (tsx): apps/api/src/lib/provisionTenant.ts  → ../../ = apps/api/
//   - prod:    apps/api/dist/lib/provisionTenant.js → ../../ = apps/api/
const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const execP = promisify(exec);

export interface ProvisionTenantInput {
  name: string;
  slug: string;
  primaryHost?: string;
  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    logoUrl?: string;
    faviconUrl?: string;
  };
  createdByEmail?: string;
}

export interface ProvisionTenantResult {
  tenantId: string;
  slug: string;
  dbName: string;
  dbRole: string;
}

function sanitizeSlug(slug: string): string {
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(`Invalid slug "${slug}" (must match /^[a-z0-9-]+$/)`);
  }
  return slug.replace(/-/g, '_');
}

function genPassword(): string {
  return randomBytes(24).toString('base64url');
}

function parseAdminUrl(url: string): { host: string; port: number; user: string; password: string } {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 5432,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
  };
}

async function withAdminClient<T>(fn: (client: PgClient) => Promise<T>): Promise<T> {
  const url = process.env.TENANT_DB_ADMIN_URL;
  if (!url) throw new Error('TENANT_DB_ADMIN_URL is not set');
  const client = new PgClient({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function logProvisionStep(
  tenantId: string,
  step: string,
  status: 'pending' | 'succeeded' | 'failed',
  metadata?: unknown
) {
  try {
    await controlPrisma.provisionLog.create({
      data: {
        tenantId,
        step,
        status,
        metadata: metadata === undefined ? undefined : JSON.parse(JSON.stringify(metadata)),
      },
    });
  } catch {
    // best-effort logging only
  }
}

export async function provisionTenant(input: ProvisionTenantInput): Promise<ProvisionTenantResult> {
  const safeSlug = sanitizeSlug(input.slug);
  const dbName = `tenant_${safeSlug}`;
  const dbRole = `tenant_${safeSlug}`;
  const dbPassword = genPassword();

  // 1) Reserve a tenant row in the control plane (status=trial until DB is ready)
  const existing = await controlPrisma.tenant.findUnique({ where: { slug: input.slug } });
  if (existing) {
    throw new Error(`Tenant slug "${input.slug}" already exists (id=${existing.id})`);
  }

  const tenant = await controlPrisma.tenant.create({
    data: {
      name: input.name,
      slug: input.slug,
      status: 'trial',
    },
  });
  await logProvisionStep(tenant.id, 'tenant.created', 'succeeded', { slug: input.slug });

  try {
    // 2) Create the Postgres role and database
    await logProvisionStep(tenant.id, 'create_role', 'pending');
    await withAdminClient(async (admin) => {
      await admin.query(`CREATE ROLE "${dbRole}" WITH LOGIN PASSWORD '${dbPassword.replace(/'/g, "''")}'`);
      await admin.query(`CREATE DATABASE "${dbName}" OWNER "${dbRole}"`);
      await admin.query(`GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO "${dbRole}"`);
    });
    await logProvisionStep(tenant.id, 'create_database', 'succeeded', { dbName, dbRole });

    // 3) Build the tenant-specific connection string
    const adminParts = parseAdminUrl(process.env.TENANT_DB_ADMIN_URL!);
    const tenantUrl = `postgresql://${dbRole}:${encodeURIComponent(dbPassword)}@${adminParts.host}:${adminParts.port}/${dbName}?schema=public`;

    // 4) Apply tenant schema migrations.
    //    `npx --no-install` runs the locally-installed prisma (no network fetch,
    //    no pnpm needed in the runtime image). `cwd: API_DIR` and an explicit
    //    --schema make this work regardless of the process's working directory.
    await logProvisionStep(tenant.id, 'run_migrations', 'pending');
    try {
      await execP(`npx --no-install prisma migrate deploy --schema ./prisma/schema.prisma`, {
        cwd: API_DIR,
        env: { ...process.env, DATABASE_URL: tenantUrl },
      });
      await logProvisionStep(tenant.id, 'run_migrations', 'succeeded');
    } catch (err) {
      await logProvisionStep(tenant.id, 'run_migrations', 'failed', { error: String(err) });
      throw err;
    }

    // 4b) Seed the tenant DB's own Tenant row. The tenant schema has FKs from
    //     User/Test/Course/Batch/… → Tenant(id), so without this row the very
    //     first insert into the new DB hits a P2003 FK violation. Use the same
    //     id as the control-plane tenant so JWT `tenantId` claims match.
    await logProvisionStep(tenant.id, 'seed_tenant_row', 'pending');
    try {
      const tenantClient = new TenantPrisma({ datasources: { db: { url: tenantUrl } } });
      try {
        await tenantClient.tenant.upsert({
          where: { id: tenant.id },
          update: { name: input.name, slug: input.slug, status: 'active' },
          create: {
            id: tenant.id,
            name: input.name,
            slug: input.slug,
            status: 'active',
          },
        });
      } finally {
        await tenantClient.$disconnect();
      }
      await logProvisionStep(tenant.id, 'seed_tenant_row', 'succeeded');
    } catch (err) {
      await logProvisionStep(tenant.id, 'seed_tenant_row', 'failed', { error: String(err) });
      throw err;
    }

    // 5) Store the encrypted connection URL + db identifiers
    await controlPrisma.tenantDbConfig.create({
      data: {
        tenantId: tenant.id,
        dbName,
        dbRole,
        connectionUrlEnc: encryptSecret(tenantUrl),
        provisionedAt: new Date(),
      },
    });
    await logProvisionStep(tenant.id, 'save_db_config', 'succeeded');

    // 6) Default branding row
    await controlPrisma.tenantBranding.create({
      data: {
        tenantId: tenant.id,
        productName: input.name,
        primaryColor: input.branding?.primaryColor ?? '#0f172a',
        accentColor: input.branding?.secondaryColor ?? '#0ea5e9',
        logoUrl: input.branding?.logoUrl,
        faviconUrl: input.branding?.faviconUrl,
      },
    });

    // 7) Optional primary domain (defaults kind=admin; M5 will add the
    //    student domain via a separate API call).
    if (input.primaryHost) {
      await controlPrisma.tenantDomain.create({
        data: {
          tenantId: tenant.id,
          host: input.primaryHost.toLowerCase(),
          kind: 'admin',
        },
      });
    }

    // 8) Mark active
    await controlPrisma.tenant.update({
      where: { id: tenant.id },
      data: { status: 'active' },
    });
    await logProvisionStep(tenant.id, 'activate_tenant', 'succeeded');

    return { tenantId: tenant.id, slug: tenant.slug, dbName, dbRole };
  } catch (err) {
    // Rollback: drop the newly-created DB/role; mark tenant cancelled so it
    // doesn't sit half-provisioned in the control plane.
    await logProvisionStep(tenant.id, 'rollback', 'pending', { error: String(err) });
    try {
      await withAdminClient(async (admin) => {
        await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`).catch(() => undefined);
        await admin.query(`DROP ROLE IF EXISTS "${dbRole}"`).catch(() => undefined);
      });
    } catch {
      // ignore — best effort cleanup
    }
    await controlPrisma.tenant.update({
      where: { id: tenant.id },
      data: { status: 'cancelled' },
    }).catch(() => undefined);
    throw err;
  }
}
