/* eslint-disable no-console */
/**
 * register-legacy-tenant.ts
 *
 * Registers an EXISTING tenant in the control plane WITHOUT provisioning a new
 * database. The tenant keeps using the legacy shared DB, because it gets no
 * TenantDbConfig row and `tenantPrisma` falls back to the legacy client when
 * no config exists.
 *
 * This is used for the original Rankership tenant during the white-label
 * rollout: its control-plane id is set equal to its existing legacy tenant id
 * so already-issued JWTs and existing rows (which carry that tenantId) keep
 * matching.
 *
 * Requires CONTROL_DATABASE_URL.
 *
 * Usage:
 *   pnpm tsx scripts/register-legacy-tenant.ts \
 *     --id <legacyTenantId> \
 *     --slug rankership --name "Rankership" \
 *     --admin-host admin.rankership.com \
 *     --student-host student.rankership.com \
 *     [--extra-host rankership.com] \
 *     [--product-name "Rankership"] \
 *     [--primary-color "#0f172a"] [--accent-color "#0ea5e9"]
 */
import { PrismaClient as ControlPrisma } from '../src/generated/prisma-control/index.js';

function arg(name: string): string | undefined {
  return process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
}

async function main() {
  const id = arg('id');
  const slug = arg('slug');
  const name = arg('name');
  const adminHost = arg('admin-host')?.trim().toLowerCase();
  const studentHost = arg('student-host')?.trim().toLowerCase();
  const extraHost = arg('extra-host')?.trim().toLowerCase();
  const productName = arg('product-name') ?? name;
  const primaryColor = arg('primary-color') ?? '#0f172a';
  const accentColor = arg('accent-color') ?? '#0ea5e9';

  if (!id || !slug || !name) {
    throw new Error('Usage: tsx scripts/register-legacy-tenant.ts --id <legacyId> --slug <slug> --name <name> [--admin-host ...] [--student-host ...] [--extra-host ...]');
  }

  const control = new ControlPrisma({ datasources: { db: { url: process.env.CONTROL_DATABASE_URL } } });
  try {
    const tenant = await control.tenant.upsert({
      where: { id },
      update: { slug, name, status: 'active' },
      create: { id, slug, name, status: 'active' },
    });
    console.log(`Tenant ready: ${tenant.name} (${tenant.id}) — uses legacy DB (no TenantDbConfig)`);

    const now = new Date();
    const domains: Array<{ host: string; kind: string }> = [];
    if (adminHost) domains.push({ host: adminHost, kind: 'admin' });
    if (studentHost) domains.push({ host: studentHost, kind: 'student' });
    if (extraHost) domains.push({ host: extraHost, kind: 'student' });

    for (const d of domains) {
      await control.tenantDomain.upsert({
        where: { host: d.host },
        update: { tenantId: tenant.id, kind: d.kind, verifiedAt: now },
        create: { tenantId: tenant.id, host: d.host, kind: d.kind, verifiedAt: now },
      });
      console.log(`  domain: ${d.host} (${d.kind})`);
    }

    await control.tenantBranding.upsert({
      where: { tenantId: tenant.id },
      update: { productName, primaryColor, accentColor },
      create: { tenantId: tenant.id, productName, primaryColor, accentColor },
    });
    console.log(`  branding: ${productName} ${primaryColor}/${accentColor}`);
  } finally {
    await control.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
