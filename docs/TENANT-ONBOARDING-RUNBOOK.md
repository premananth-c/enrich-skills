# Tenant Onboarding Runbook

This runbook covers the day-to-day process of onboarding a new white-label tenant
to the Rankership platform after the initial cutover (see `WHITELABEL-CUTOVER.md`)
has been completed.

## Prerequisites

- A Postgres cluster reachable from the API.
- Control-plane DB provisioned (one-time): `pnpm --filter @enrich-skills/api db:control:migrate:deploy`.
- Required environment variables on the API:
  - `CONTROL_DATABASE_URL` — control-plane connection.
  - `TENANT_DB_ADMIN_URL` — Postgres superuser used only by `provisionTenant`.
  - `TENANT_SECRETS_KEY` — base64-encoded 32-byte key for AES-256-GCM encryption of secrets.
  - `CF_API_TOKEN`, `CF_ZONE_ID`, `CF_FALLBACK_ORIGIN` — Cloudflare for SaaS (optional but recommended).
- A super-admin account in the control plane (`SuperAdmin` table).

## 1. Sign in to the super-admin app

Open `https://superadmin.rankership.com` (or `pnpm --filter @enrich-skills/superadmin-web dev`
locally on `:5176`). Log in with your super-admin credentials.

## 2. Onboard the tenant

1. Click **Onboard tenant**.
2. Enter:
   - **Name** — display name (e.g. *Acme Learning*).
   - **Slug** — URL-safe identifier (e.g. `acme-learning`); used for the Postgres role and DB.
   - **Primary host** *(optional)* — the tenant's custom hostname (e.g. `lms.acme.com`).
   - **Primary / accent colour** — initial branding palette.
3. Click **Onboard tenant**. The API will:
   1. Create a `Tenant` row in the control plane with status `trial`.
   2. `CREATE ROLE tenant_<slug>` and `CREATE DATABASE tenant_<slug>` on the cluster.
   3. Run `prisma migrate deploy` against the new database (using the tenant role).
   4. Encrypt the connection string and persist it as a `TenantDbConfig` row.
   5. Seed default branding and (optionally) the primary domain.
   6. Flip the tenant's status to `active`.

   This typically takes 10–30 seconds. Provisioning is logged step-by-step in the
   `ProvisionLog` table; check it if anything fails.

## 3. Configure custom domains

1. Open the new tenant.
2. Go to the **Domains** tab.
3. Add at least one domain (`kind=admin` for the admin portal, `kind=student` for the LMS).
4. If `CF_API_TOKEN` is configured, the API will register a Cloudflare for SaaS custom hostname
   automatically and return the DCV record (CNAME or HTTP) the tenant must publish.
5. Share the DCV instructions with the tenant. After they publish DNS, click **Refresh** on the
   row to update the verified-at timestamp.

## 4. Configure payment providers

1. Open the tenant's **Payments** tab.
2. Click **+ Razorpay** or **+ Stripe**.
3. Paste the tenant's public key, secret key, and (recommended) webhook secret.
4. Select **mode** = `live` (production) or `test`.
5. Configure the webhook URL in the provider's dashboard:
   - Razorpay: `https://api.rankership.com/api/v1/payments/webhook/razorpay/<tenantId>`
   - Stripe: `https://api.rankership.com/api/v1/payments/webhook/stripe/<tenantId>`

## 5. Seed the tenant's first admin user

The tenant DB starts empty. To seed the first admin:

```bash
DATABASE_URL=$(pnpm --filter @enrich-skills/api tsx -e '
  import { controlPrisma } from "./apps/api/src/lib/controlPrisma.ts";
  import { decryptSecret } from "./apps/api/src/lib/crypto.ts";
  const cfg = await controlPrisma.tenantDbConfig.findFirst({ where: { tenant: { slug: "acme-learning" } } });
  console.log(decryptSecret(cfg!.connectionUrlEnc));
') \
pnpm --filter @enrich-skills/api tsx scripts/seed-tenant-admin.ts \
  --email admin@acme.com --name "Acme Admin" --password '<temporary>'
```

(Or use `pnpm db:migrate:deploy && pnpm prisma studio` against the tenant URL and insert manually.)

The tenant admin can then sign in at the tenant's admin domain and start
inviting students, creating courses, etc.

## 6. Verify the new tenant

1. Open the tenant's primary host in a browser.
2. Confirm the branding (colours, logo, product name, favicon, custom CSS) is applied.
3. Sign in as the tenant admin.
4. Smoke test:
   - Create a batch.
   - Invite a student.
   - Run a payment with the test mode credentials.
5. Switch the tenant's payments to `live` mode.

## 7. Decommissioning

To decommission a tenant:

1. In the super-admin app, set the tenant's status to `cancelled`.
2. Run `pnpm --filter @enrich-skills/api tsx scripts/archive-tenant.ts --tenantId=<id>`
   to dump the tenant DB to long-term storage.
3. Drop the Postgres role and database (`DROP DATABASE tenant_<slug>; DROP ROLE tenant_<slug>;`).
4. Delete the `TenantDbConfig` and `TenantBranding` rows in the control plane (the cascade
   will clear domains, payment credentials, etc.).
