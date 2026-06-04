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
 *
 * - `tenant-scoped`: row has its own `tenantId` column, filter on that.
 * - `fk-scoped`: row has no `tenantId`; filter rows whose `fk` is the id of a
 *   row we already copied from the parent model.
 *
 * Model identifiers must match Prisma client accessors (lowerCamelCase).
 */
type Step =
  | { kind: 'tenant-scoped'; model: string }
  | { kind: 'fk-scoped'; model: string; fk: string; parent: string };

const STEPS: Step[] = [
  // 1. Top-level tenant tables
  { kind: 'tenant-scoped', model: 'roleDefinition' },
  { kind: 'tenant-scoped', model: 'user' },

  // 2. Course hierarchy
  { kind: 'tenant-scoped', model: 'course' },
  { kind: 'fk-scoped', model: 'courseChapter', fk: 'courseId', parent: 'course' },
  { kind: 'fk-scoped', model: 'courseTopic', fk: 'chapterId', parent: 'courseChapter' },
  { kind: 'fk-scoped', model: 'courseMaterial', fk: 'topicId', parent: 'courseTopic' },
  { kind: 'fk-scoped', model: 'courseActivity', fk: 'topicId', parent: 'courseTopic' },

  // 3. Question bank
  { kind: 'tenant-scoped', model: 'question' },
  { kind: 'fk-scoped', model: 'testCase', fk: 'questionId', parent: 'question' },

  // 4. Tests (depend on questions; variants/questions depend on tests)
  { kind: 'tenant-scoped', model: 'test' },
  { kind: 'fk-scoped', model: 'testVariant', fk: 'testId', parent: 'test' },
  { kind: 'fk-scoped', model: 'testQuestion', fk: 'testId', parent: 'test' },

  // 5. Course evaluations (need topics + tests)
  { kind: 'fk-scoped', model: 'courseEvaluation', fk: 'topicId', parent: 'courseTopic' },

  // 6. Assignments (need courses + tests)
  { kind: 'fk-scoped', model: 'assignment', fk: 'courseId', parent: 'course' },
  { kind: 'fk-scoped', model: 'assignmentTest', fk: 'assignmentId', parent: 'assignment' },

  // 7. Test allocations (need tests + users)
  { kind: 'fk-scoped', model: 'testAllocation', fk: 'testId', parent: 'test' },

  // 8. Batches & related
  { kind: 'tenant-scoped', model: 'batch' },
  { kind: 'fk-scoped', model: 'batchMember', fk: 'batchId', parent: 'batch' },
  { kind: 'fk-scoped', model: 'batchTestAssignment', fk: 'batchId', parent: 'batch' },
  { kind: 'fk-scoped', model: 'batchScheduleEvent', fk: 'batchId', parent: 'batch' },
  { kind: 'fk-scoped', model: 'schedulerNote', fk: 'batchId', parent: 'batch' },
  { kind: 'fk-scoped', model: 'batchVideo', fk: 'batchId', parent: 'batch' },

  // 9. Course assignments to batches/users
  { kind: 'tenant-scoped', model: 'courseAssignment' },

  // 10. Live meetings + recordings
  { kind: 'tenant-scoped', model: 'liveMeeting' },
  { kind: 'fk-scoped', model: 'liveMeetingRecording', fk: 'liveMeetingId', parent: 'liveMeeting' },

  // 11. Attempts → submissions → test-case results
  { kind: 'fk-scoped', model: 'attempt', fk: 'testId', parent: 'test' },
  { kind: 'fk-scoped', model: 'submission', fk: 'attemptId', parent: 'attempt' },
  { kind: 'fk-scoped', model: 'testCaseResult', fk: 'submissionId', parent: 'submission' },

  // 12. Communication & audit
  { kind: 'tenant-scoped', model: 'invite' },
  { kind: 'tenant-scoped', model: 'notification' },
  { kind: 'fk-scoped', model: 'activitySubmission', fk: 'activityId', parent: 'courseActivity' },
  { kind: 'tenant-scoped', model: 'revisionLog' },

  // 13. Payments (M6)
  { kind: 'tenant-scoped', model: 'order' },
  { kind: 'fk-scoped', model: 'payment', fk: 'orderId', parent: 'order' },
  { kind: 'tenant-scoped', model: 'paymentEvent' },
];

async function copyTable(
  source: TenantPrisma,
  target: TenantPrisma,
  step: Step,
  tenantId: string,
  ids: Record<string, Set<string>>,
  args: CliArgs
): Promise<{ model: string; copied: number }> {
  const model = step.model;
  const sourceRepo = (source as unknown as Record<string, { findMany: (args: object) => Promise<unknown[]> }>)[model];
  const targetRepo = (target as unknown as Record<string, { createMany: (args: { data: unknown[]; skipDuplicates?: boolean }) => Promise<{ count: number }> }>)[model];
  if (!sourceRepo || !targetRepo) {
    throw new Error(`Unknown Prisma model: ${model}`);
  }

  let where: Record<string, unknown>;
  if (step.kind === 'tenant-scoped') {
    where = { tenantId };
  } else {
    const parentIds = ids[step.parent];
    if (!parentIds || parentIds.size === 0) {
      console.log(`  [skip] ${model} (no parent ${step.parent} rows copied)`);
      ids[model] = new Set();
      return { model, copied: 0 };
    }
    where = { [step.fk]: { in: [...parentIds] } };
  }

  const rows = (await sourceRepo.findMany({ where })) as Array<Record<string, unknown>>;

  // Track this model's IDs so any downstream fk-scoped step can filter on them.
  ids[model] = new Set(rows.map((r) => r.id as string));

  // Rewrite tenantId on every copied row to the TARGET tenant id, so rows
  // belong to the new tenant and satisfy the tenant DB's FK to its own
  // Tenant row. No-op when source and target ids are equal.
  for (const row of rows) {
    if ('tenantId' in row) row.tenantId = args.tenantId;
  }

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
      // For each model we copy, we record the ids of the rows we read from
      // the source. Subsequent `fk-scoped` steps filter their parent FK to
      // this set, so we only carry across children of rows we actually
      // copied (e.g. only attempts whose test belongs to the source tenant).
      const ids: Record<string, Set<string>> = {};

      const results: Array<{ model: string; copied: number }> = [];
      for (const step of STEPS) {
        // Read with the SOURCE (legacy) tenant id; copyTable rewrites each
        // row's tenantId to the TARGET tenant id (args.tenantId) on insert.
        const result = await copyTable(source, target, step, args.sourceTenantId, ids, args);
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
