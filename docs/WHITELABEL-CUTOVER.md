# White-Label Cutover Runbook (M7)

This runbook walks the existing single-database production deployment through the
final cutover into the white-label, database-per-tenant architecture.

> **Important** — the cutover is destructive and one-way. Take a verified backup
> before starting and rehearse the entire procedure on a staging clone first.

## 0. Pre-flight

- API on `feature/whitelabel` is deployed (M1–M6 merged).
- Control plane DB is provisioned and migrations are up to date.
- `TENANT_SECRETS_KEY` is set and stored in the secrets manager (rotation-aware).
- `CF_API_TOKEN`, `CF_ZONE_ID`, `CF_FALLBACK_ORIGIN` are configured.
- Cloudflare zone is set up for SaaS (custom hostnames + fallback origin pointing
  at the API).
- A new Postgres user (`postgres` superuser) for `TENANT_DB_ADMIN_URL` is set; this
  role is only used during provisioning.

## 1. Freeze writes (~5 min)

- Put the API in maintenance mode (return `503` from a feature flag).
- Optionally take a fresh logical backup with `pg_dump` for safety.

## 2. Provision per-tenant DBs

For each existing tenant (today there is at least the default Rankership tenant):

```bash
# In apps/superadmin-web, run "Onboard tenant" with the tenant's existing
# slug, name, and existing primary domain. Or call the API directly:

curl -X POST https://api.rankership.com/api/v1/superadmin/tenants \
  -H "Authorization: Bearer <SUPERADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Rankership",
    "slug": "rankership",
    "primaryHost": "admin.rankership.com",
    "branding": { "primaryColor": "#0f172a", "secondaryColor": "#0ea5e9" }
  }'
```

This creates:
- Control-plane `Tenant` row (id we'll call `<TID>`).
- `tenant_rankership` Postgres role + database.
- Tenant schema applied.
- Encrypted `TenantDbConfig.connectionUrlEnc`.

Repeat for every tenant in the legacy `Tenant` table.

## 3. Migrate data into per-tenant DBs

For each tenant, dry-run the migration first:

```bash
pnpm --filter @enrich-skills/api tsx scripts/migrate-to-tenant-dbs.ts \
  --tenantId=<TID> --dry-run
```

When the row counts look right, run for real:

```bash
pnpm --filter @enrich-skills/api tsx scripts/migrate-to-tenant-dbs.ts \
  --tenantId=<TID>
```

The script copies tables in topological order (`User`, `Course`, …) and respects
foreign keys. `tenantId` columns are preserved on the destination side; we drop
them in step 6.

Run it concurrently for multiple tenants only if your DB has headroom; otherwise
sequence them.

## 4. Cross-tenant data into the control plane

The legacy DB still owns:

- `Enquiry` rows (now served by `controlPrisma.enquiry`).

Copy them once:

```sql
\c enrich_control
INSERT INTO "Enquiry" (id, name, email, phone, category, message, status, "createdAt", "updatedAt")
SELECT id, name, email, phone, category, message, status, "createdAt", "updatedAt"
FROM dblink('dbname=enrich_legacy', 'SELECT id,name,email,phone,category,message,status,"createdAt","updatedAt" FROM "Enquiry"')
AS src(id text, name text, email text, phone text, category text, message text, status text,
       "createdAt" timestamp, "updatedAt" timestamp);
```

(Adjust connection string / use `pg_dump --table=Enquiry` + `psql` if `dblink` is unavailable.)

## 5. Switch DNS / Cloudflare for SaaS

In the super-admin app, for each tenant:

1. Open Domains.
2. Add their `admin.<tenant>` and `lms.<tenant>` (or whatever they prefer).
3. The API registers a Cloudflare for SaaS custom hostname and returns the DCV
   record. Send it to the tenant.
4. Once the tenant updates DNS and Cloudflare reports the hostname as `active`,
   click **Refresh** to mark `verifiedAt`.

For Rankership's own domains (`admin.rankership.com`, `student.rankership.com`),
flip them to point at the white-label fallback origin.

## 6. Decommission `tenantId` and the legacy `Tenant`/`Enquiry` tables

After all tenants are migrated and verified, apply this destructive migration to
each tenant DB. Save it as `apps/api/prisma/migrations/<ts>_decommission_tenant_id`:

```sql
-- Drop FK from each tenant-scoped table back to the (now-removed) Tenant table.
ALTER TABLE "User"               DROP CONSTRAINT IF EXISTS "User_tenantId_fkey";
ALTER TABLE "Test"               DROP CONSTRAINT IF EXISTS "Test_tenantId_fkey";
ALTER TABLE "Course"             DROP CONSTRAINT IF EXISTS "Course_tenantId_fkey";
ALTER TABLE "Question"           DROP CONSTRAINT IF EXISTS "Question_tenantId_fkey";
ALTER TABLE "Invite"             DROP CONSTRAINT IF EXISTS "Invite_tenantId_fkey";
ALTER TABLE "Batch"              DROP CONSTRAINT IF EXISTS "Batch_tenantId_fkey";
ALTER TABLE "CourseAssignment"   DROP CONSTRAINT IF EXISTS "CourseAssignment_tenantId_fkey";
ALTER TABLE "Notification"       DROP CONSTRAINT IF EXISTS "Notification_tenantId_fkey";
-- ... repeat for every model that had `tenant Tenant @relation`

-- Drop tenantId columns
ALTER TABLE "User"             DROP COLUMN "tenantId";
ALTER TABLE "Test"             DROP COLUMN "tenantId";
ALTER TABLE "Course"           DROP COLUMN "tenantId";
ALTER TABLE "Question"         DROP COLUMN "tenantId";
ALTER TABLE "Invite"           DROP COLUMN "tenantId";
ALTER TABLE "Batch"            DROP COLUMN "tenantId";
ALTER TABLE "CourseAssignment" DROP COLUMN "tenantId";
ALTER TABLE "Notification"     DROP COLUMN "tenantId";
ALTER TABLE "RevisionLog"      DROP COLUMN "tenantId";
ALTER TABLE "RoleDefinition"   DROP COLUMN "tenantId";
-- Payments tables added in M6 also carry tenantId — they're kept inside the
-- tenant DB only, so dropping the column is fine.
ALTER TABLE "Order"            DROP COLUMN "tenantId";
ALTER TABLE "Payment"          DROP COLUMN "tenantId";
ALTER TABLE "PaymentEvent"     DROP COLUMN "tenantId";

-- Drop the now-orphaned Tenant and Enquiry tables.
DROP TABLE "Tenant";
DROP TABLE "Enquiry";
```

Then update `apps/api/prisma/schema.prisma`:

- Remove the `Tenant` and `Enquiry` models.
- Remove every `tenantId String` and `tenant Tenant @relation` field from the
  remaining models.
- Remove `@@index([tenantId, …])` indexes.

After updating the schema, regenerate the client:

```bash
pnpm --filter @enrich-skills/api prisma generate
```

…and refactor the routes:

- Remove `where: { tenantId }` filters (the tenant DB is already isolated, so
  every row belongs to the tenant).
- Remove `tenantId` from `data: { … }` in `prisma.X.create({ data })` calls.
- Remove `requireTenant` calls that exist only to extract the id (the JWT still
  carries a tenantId, but it's no longer required for queries).
- `auth.ts` login: replace the cross-tenant `prisma.user.findFirst({ where: { email } })`
  with a per-tenant lookup using `request.getTenantPrisma()` (which now requires
  a Host or X-Tenant-Id header — fine, because login pages live on the tenant's
  custom domain).

This refactor pass should be done in a follow-up PR; until it's merged, the
code keeps `where: { tenantId }` for backwards compatibility (no-op once the
column is gone — Prisma will throw, so this section is the trigger to ship the
follow-up).

## 7. Decommission the legacy DB

Once every tenant is on its own DB and the schema trim is shipped:

- Remove `DATABASE_URL` from production secrets.
- Delete `apps/api/src/lib/prisma.ts` (and its single import).
- Remove the legacy fallback in `apps/api/src/lib/tenantPrisma.ts`
  (the `if (!config) return legacyPrisma;` branch).
- Drop the legacy database after a 30-day cool-off period.

## 8. Smoke tests

- `https://admin.<tenant>.com` → admin login → batch → invite → student.
- `https://lms.<tenant>.com` → student login → take a test → checkout a course.
- Razorpay/Stripe live webhook fires through and Order flips to `paid`.
- Super-admin dashboard shows all tenants and can edit branding/domains.

## 9. Rollback plan

- Keep the legacy DB online for the cool-off period.
- DNS revert to the legacy origin reverses the cutover for any single tenant.
- `TenantDbConfig` rows can be deleted to force tenants back onto the legacy DB
  (the fallback in `tenantPrisma.ts` will kick in).
