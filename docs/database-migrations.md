# Database migrations (Prisma)

## Why you see `P3005` (schema is not empty)

That happens when PostgreSQL **already has tables** (e.g. from `prisma db push`, a SQL dump, or an old DB), but the **`_prisma_migrations`** table does not list the migration folders in `prisma/migrations/`. Prisma then refuses `migrate deploy` so it does not replay migrations on top of an unknown state.

## Local development

### Option A — Reset and reapply (simplest; **destroys local data**)

From `apps/api` with `DATABASE_URL` pointing at your local DB:

```bash
cd apps/api
pnpm exec prisma migrate reset
```

This drops the database (or schema, depending on config), recreates it, applies every migration in order, and can run the seed if configured.

### Option B — Keep existing data (baseline)

Use this only if your current schema **already matches** what the migration SQL would apply.

1. List migration folder names under `apps/api/prisma/migrations/` (e.g. `0_baseline`, `20260325134246_add_coding_test_support`, …).
2. From `apps/api`, mark each as already applied (no SQL run):

```bash
cd apps/api
pnpm exec prisma migrate resolve --applied "0_baseline"
pnpm exec prisma migrate resolve --applied "20260325134246_add_coding_test_support"
pnpm exec prisma migrate resolve --applied "20260325180000_add_attempt_question_order"
```

3. Check status:

```bash
pnpm exec prisma migrate status
```

If a column is missing (e.g. you baselined too aggressively), either run the missing migration SQL by hand or fix the DB and re-check.

### After Option A or B

```bash
pnpm exec prisma migrate deploy
```

should report that everything is applied (or apply only truly pending migrations).

## Hotfix: `500` on “Start test” / `Attempt` queries

If the Prisma schema has `Attempt.questionOrder` but your database was never migrated, **every query on `Attempt` can fail** with a 500 (Prisma expects the column to exist).

Apply the column manually (PostgreSQL):

```sql
ALTER TABLE "Attempt" ADD COLUMN IF NOT EXISTS "questionOrder" JSONB;
```

Or run the file `apps/api/prisma/manual-fix-question-order.sql`. Then record the migration as applied if you use Prisma Migrate history (see Option B above) or run `pnpm exec prisma migrate deploy` once the DB allows it.

## Production (smooth ongoing deploys)

**Goal:** Production should **only** need `prisma migrate deploy` on each release, with a **one-time** fix if the DB predates migrations.

1. **New database** (empty): run your app deploy; the first `migrate deploy` applies all migrations. No baseline needed.

2. **Existing database** (tables exist, no migration history): do a **one-time baseline** on the server (SSH), using the same `migrate resolve --applied "…"` sequence as in Option B above, **only** for migrations whose SQL already matches reality. Then every deploy runs:

   ```bash
   npx prisma migrate deploy --schema ./prisma/schema.prisma
   ```

3. **Never** rely on `prisma db push` in production if you use Migrate; it bypasses history and causes P3005-style drift.

The GitHub Action should run `migrate deploy` after the API image is up and fail the deploy if migrations fail.
