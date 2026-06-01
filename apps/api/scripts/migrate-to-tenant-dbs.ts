/* eslint-disable no-console */
/**
 * migrate-to-tenant-dbs.ts
 *
 * Copies one tenant's rows from the legacy shared database into that
 * tenant's dedicated tenant database. Used during M7 cutover.
 *
 * Pre-requisites:
 *   1. Control plane is provisioned (M1).
 *   2. The target tenant has a TenantDbConfig row (M4 provisionTenant
 *      has been run for this tenant).
 *   3. CONTROL_DATABASE_URL, DATABASE_URL (legacy), and TENANT_SECRETS_KEY
 *      are set.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-to-tenant-dbs.ts --tenantId=<uuid> [--dry-run]
 *   pnpm tsx scripts/migrate-to-tenant-dbs.ts --tenantId=<newId> \
 *        --source-tenant-id=<legacyId> [--dry-run]
 *
 * The script copies tables in dependency order (parents before children).
 *
 * - `--tenantId` is the TARGET control-plane tenant (whose dedicated DB we
 *   write into). Every copied row's `tenantId` is rewritten to this value so
 *   the rows belong to the new tenant and satisfy the tenant DB's FK to its
 *   own `Tenant` row.
 * - `--source-tenant-id` is the legacy tenant id to READ from. Defaults to
 *   `--tenantId` (same-id migration, e.g. a tenant whose control id already
 *   equals its legacy id). For a brand-new tenant seeded from existing data
 *   (e.g. Nivexa from the current single-tenant DB), pass the legacy id here
 *   and the new tenant id in `--tenantId`.
 */
import { PrismaClient as TenantPrisma } from '@prisma/client';
import { PrismaClient as ControlPrisma } from '../src/generated/prisma-control/index.js';
import { decryptSecret } from '../src/lib/crypto.js';

interface CliArgs {
  tenantId: string;
  sourceTenantId: string;
  dryRun: boolean;
  batchSize: number;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const tenantId = args.find((a) => a.startsWith('--tenantId='))?.split('=')[1];
  const sourceTenantId = args.find((a) => a.startsWith('--source-tenant-id='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');
  const batchSizeRaw = args.find((a) => a.startsWith('--batch-size='))?.split('=')[1];
  const batchSize = batchSizeRaw ? parseInt(batchSizeRaw, 10) : 500;
  if (!tenantId) {
    throw new Error('Usage: tsx scripts/migrate-to-tenant-dbs.ts --tenantId=<uuid> [--source-tenant-id=<legacyId>] [--dry-run] [--batch-size=500]');
  }
  return { tenantId, sourceTenantId: sourceTenantId || tenantId, dryRun, batchSize };
}

/**
 * Tables are listed in topological order so foreign keys resolve.
 * Each entry names a Prisma model and (for joins) tells us how to
 * filter rows for the target tenant.
 *
 * Models that don't carry `tenantId` are filtered indirectly by joining
 * on a parent that does.
 */
type Step =
  | { kind: 'tenant-scoped'; model: string }
  | { kind: 'batch-scoped'; model: string; parentModel: 'batch' }
  | { kind: 'test-scoped'; model: string; parentModel: 'test' }
  | { kind: 'course-scoped'; model: string; parentModel: 'course' | 'chapter' | 'topic' }
  | { kind: 'attempt-scoped'; model: string; parentModel: 'attempt' };

const STEPS: Step[] = [
  { kind: 'tenant-scoped', model: 'roleDefinition' },
  { kind: 'tenant-scoped', model: 'user' },

  { kind: 'tenant-scoped', model: 'course' },
  { kind: 'course-scoped', model: 'chapter', parentModel: 'course' },
  { kind: 'course-scoped', model: 'topic', parentModel: 'chapter' },
  { kind: 'course-scoped', model: 'courseEvaluation', parentModel: 'topic' },
  { kind: 'course-scoped', model: 'courseMaterial', parentModel: 'topic' },

  { kind: 'tenant-scoped', model: 'question' },
  { kind: 'tenant-scoped', model: 'testCase' },

  { kind: 'tenant-scoped', model: 'test' },
  { kind: 'test-scoped', model: 'testVariant', parentModel: 'test' },
  { kind: 'test-scoped', model: 'testQuestion', parentModel: 'test' },
  { kind: 'tenant-scoped', model: 'testAllocation' },

  { kind: 'tenant-scoped', model: 'batch' },
  { kind: 'batch-scoped', model: 'batchMember', parentModel: 'batch' },
  { kind: 'batch-scoped', model: 'batchTestAssignment', parentModel: 'batch' },
  { kind: 'batch-scoped', model: 'batchScheduleEvent', parentModel: 'batch' },
  { kind: 'batch-scoped', model: 'schedulerNote', parentModel: 'batch' },
  { kind: 'batch-scoped', model: 'batchVideo', parentModel: 'batch' },

  { kind: 'tenant-scoped', model: 'courseAssignment' },

  { kind: 'tenant-scoped', model: 'attempt' },
  { kind: 'attempt-scoped', model: 'submission', parentModel: 'attempt' },

  { kind: 'tenant-scoped', model: 'invite' },
  { kind: 'tenant-scoped', model: 'notification' },
  { kind: 'tenant-scoped', model: 'revisionLog' },

  { kind: 'tenant-scoped', model: 'meeting' },
  { kind: 'tenant-scoped', model: 'meetingParticipant' },
];

async function copyTable(
  source: TenantPrisma,
  target: TenantPrisma,
  step: Step,
  tenantId: string,
  ctx: { batchIds: Set<string>; courseIds: Set<string>; chapterIds: Set<string>; topicIds: Set<string>; testIds: Set<string>; attemptIds: Set<string> },
  args: CliArgs
): Promise<{ model: string; copied: number }> {
  const model = step.model;
  const sourceRepo = (source as unknown as Record<string, { findMany: (args: object) => Promise<unknown[]> }>)[model];
  const targetRepo = (target as unknown as Record<string, { createMany: (args: { data: unknown[]; skipDuplicates?: boolean }) => Promise<{ count: number }> }>)[model];
  if (!sourceRepo || !targetRepo) {
    throw new Error(`Unknown Prisma model: ${model}`);
  }

  let where: Record<string, unknown> = {};
  if (step.kind === 'tenant-scoped') {
    where = { tenantId };
  } else if (step.kind === 'batch-scoped') {
    where = { batchId: { in: [...ctx.batchIds] } };
  } else if (step.kind === 'test-scoped') {
    where = { testId: { in: [...ctx.testIds] } };
  } else if (step.kind === 'attempt-scoped') {
    where = { attemptId: { in: [...ctx.attemptIds] } };
  } else if (step.kind === 'course-scoped') {
    if (step.parentModel === 'course') where = { courseId: { in: [...ctx.courseIds] } };
    else if (step.parentModel === 'chapter') where = { chapterId: { in: [...ctx.chapterIds] } };
    else if (step.parentModel === 'topic') where = { topicId: { in: [...ctx.topicIds] } };
  }

  const rows = (await sourceRepo.findMany({ where })) as Array<Record<string, unknown>>;

  // Rewrite tenantId on every copied row to the TARGET tenant id, so the rows
  // belong to the new tenant and satisfy the tenant DB's FK to its own Tenant
  // row. No-op when source and target ids are equal.
  for (const row of rows) {
    if ('tenantId' in row) row.tenantId = args.tenantId;
  }

  if (model === 'batch') ctx.batchIds = new Set(rows.map((r) => r.id as string));
  if (model === 'course') ctx.courseIds = new Set(rows.map((r) => r.id as string));
  if (model === 'chapter') ctx.chapterIds = new Set(rows.map((r) => r.id as string));
  if (model === 'topic') ctx.topicIds = new Set(rows.map((r) => r.id as string));
  if (model === 'test') ctx.testIds = new Set(rows.map((r) => r.id as string));
  if (model === 'attempt') ctx.attemptIds = new Set(rows.map((r) => r.id as string));

  if (rows.length === 0) {
    console.log(`  [skip] ${model} (0 rows)`);
    return { model, copied: 0 };
  }

  if (args.dryRun) {
    console.log(`  [dry] ${model}: would copy ${rows.length} rows`);
    return { model, copied: rows.length };
  }

  let copied = 0;
  for (let i = 0; i < rows.length; i += args.batchSize) {
    const slice = rows.slice(i, i + args.batchSize);
    const result = await targetRepo.createMany({ data: slice, skipDuplicates: true });
    copied += result.count;
  }
  console.log(`  [ok ] ${model}: copied ${copied} of ${rows.length}`);
  return { model, copied };
}

async function main() {
  const args = parseArgs();
  console.log(`Migrating into tenant ${args.tenantId} (reading source tenant ${args.sourceTenantId}, dry-run=${args.dryRun})`);

  const control = new ControlPrisma({ datasources: { db: { url: process.env.CONTROL_DATABASE_URL } } });
  try {
    const tenant = await control.tenant.findUnique({
      where: { id: args.tenantId },
      include: { dbConfig: true },
    });
    if (!tenant) throw new Error(`Tenant ${args.tenantId} not found in control plane`);
    if (!tenant.dbConfig) throw new Error(`Tenant ${args.tenantId} has no TenantDbConfig (run provisionTenant first)`);

    const targetUrl = decryptSecret(tenant.dbConfig.connectionUrlEnc);
    console.log(`Source: legacy DB at DATABASE_URL`);
    console.log(`Target: tenant DB ${tenant.slug}`);

    const source = new TenantPrisma({ datasources: { db: { url: process.env.DATABASE_URL } } });
    const target = new TenantPrisma({ datasources: { db: { url: targetUrl } } });

    try {
      const ctx = {
        batchIds: new Set<string>(),
        courseIds: new Set<string>(),
        chapterIds: new Set<string>(),
        topicIds: new Set<string>(),
        testIds: new Set<string>(),
        attemptIds: new Set<string>(),
      };

      const results: Array<{ model: string; copied: number }> = [];
      for (const step of STEPS) {
        // Read with the SOURCE (legacy) tenant id; copyTable rewrites each
        // row's tenantId to the TARGET tenant id (args.tenantId) on insert.
        const result = await copyTable(source, target, step, args.sourceTenantId, ctx, args);
        results.push(result);
      }

      console.log('\nSummary:');
      let total = 0;
      for (const r of results) {
        if (r.copied > 0) console.log(`  ${r.model}: ${r.copied}`);
        total += r.copied;
      }
      console.log(`Total rows ${args.dryRun ? 'would be ' : ''}copied: ${total}`);
    } finally {
      await source.$disconnect();
      await target.$disconnect();
    }
  } finally {
    await control.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
