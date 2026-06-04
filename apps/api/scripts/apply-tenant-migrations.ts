/* eslint-disable no-console */
/**
 * apply-tenant-migrations.ts
 *
 * Runs `prisma migrate deploy` against one or every active tenant database
 * recorded in the control plane. Use this whenever a new tenant Prisma
 * migration is added — provisionTenant runs migrations on *new* DBs, but
 * existing tenants need this helper to pick the migration up.
 *
 * Requires CONTROL_DATABASE_URL and TENANT_SECRETS_KEY. Reads the encrypted
 * connection URL from TenantDbConfig.
 *
 * Usage:
 *   pnpm tsx scripts/apply-tenant-migrations.ts --tenantId=<uuid>
 *   pnpm tsx scripts/apply-tenant-migrations.ts --all
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient as ControlPrisma } from '../src/generated/prisma-control/index.js';
import { decryptSecret } from '../src/lib/crypto.js';

const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const i = args.indexOf(`--${name}`);
  if (i !== -1) return args[i + 1] ?? '';
  return args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
}

async function main() {
  const tenantId = arg('tenantId');
  const all = process.argv.includes('--all');
  if (!tenantId && !all) {
    throw new Error('Usage: tsx scripts/apply-tenant-migrations.ts --tenantId=<uuid> | --all');
  }

  const control = new ControlPrisma({
    datasources: { db: { url: process.env.CONTROL_DATABASE_URL } },
  });
  try {
    const tenants = await control.tenant.findMany({
      where: {
        ...(tenantId ? { id: tenantId } : {}),
        dbConfig: { isNot: null },
      },
      include: { dbConfig: true },
    });
    if (tenants.length === 0) {
      console.log('No tenants with a TenantDbConfig found.');
      return;
    }

    let failures = 0;
    for (const t of tenants) {
      if (!t.dbConfig) continue;
      const url = decryptSecret(t.dbConfig.connectionUrlEnc);
      console.log(`\n=== Applying migrations to ${t.slug} (${t.id}) ===`);
      try {
        execSync('npx --no-install prisma migrate deploy --schema ./prisma/schema.prisma', {
          cwd: API_DIR,
          env: { ...process.env, DATABASE_URL: url },
          stdio: 'inherit',
        });
      } catch (err) {
        failures++;
        console.error(`Failed to apply migrations to ${t.slug}:`, err);
      }
    }

    if (failures > 0) {
      console.error(`\n${failures} tenant(s) failed migration. See logs above.`);
      process.exit(1);
    }
    console.log('\nAll tenant migrations applied.');
  } finally {
    await control.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
