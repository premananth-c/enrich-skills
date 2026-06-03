# Nivexa Launch Runbook — First White-Label Tenant

This is the step-by-step production guide to launch your **first** white-label
tenant, **Nivexa Talent Solutions**, alongside the existing **Rankership**
deployment.

## Goal

- `lms.nivexatalentsolutions.com` → **student** app
- `lmsadmin.nivexatalentsolutions.com` → **admin** app
- Nivexa starts from a **copy of the current data**, then builds independently.
- **Rankership** keeps the existing data and stays live on its own domains.
- Per-host branding (each domain shows its own name/logo/colours).

## Architecture decisions baked into this runbook

| Item | Decision |
|------|----------|
| Rankership data | Stays in the **legacy DB** (`enrich_skills`). No migration. |
| Rankership control-plane id | **Equals the existing legacy tenant id**, so existing JWTs and rows keep matching. It gets **no** `TenantDbConfig` row, so the API keeps using the legacy DB for it (built-in fallback). |
| Nivexa data | New **dedicated DB** (`tenant_<slug>`), **seeded** from the current data with every `tenantId` **rewritten** to Nivexa's id. |
| Tenant resolution | The SPA forwards its hostname as `X-Tenant-Host`; the API maps host → tenant via the control plane. |
| Branding | Data-driven, served by `GET /api/v1/branding`. |
| DNS / custom domains | See [Step 6](#step-6--point-the-nivexa-domains-at-the-apps). Recommended: move the zone to Cloudflare. Appendix A covers keeping DNS at Hostinger via Cloudflare for SaaS. |

> **This branch already contains the required code changes** (host forwarding,
> host-aware login, per-tenant email links, the seed/rewrite option, and two
> helper scripts). Merge it to `main` (or deploy it) before starting.

---

## Step 0 — Prerequisites & secrets

On your local machine generate the control-plane encryption key (32 random
bytes, base64):

```powershell
# PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))
```

or on the VPS:

```bash
openssl rand -base64 32
```

Save it — this becomes `TENANT_SECRETS_KEY`. **If you ever lose or change it,
all encrypted tenant DB connection strings and payment secrets become
unreadable.** Store it in your password manager.

`docker-compose.prod.yml` already builds the control-plane connection strings
from `host.docker.internal` (the Docker→host gateway, matching `DATABASE_URL`),
so the only values you add to `/opt/enrich-skills/.env` are the secrets:

```env
# Postgres SUPERUSER password (role used only while provisioning tenant DBs)
PG_SUPERUSER_PASSWORD="<postgres-superuser-password>"
# Master encryption key — base64-encoded 32 bytes. Generate ONCE, never change.
#   openssl rand -base64 32
TENANT_SECRETS_KEY="<the base64 key you generated>"
# Safety valve ON during rollout (Step 1)
WHITELABEL_LEGACY_FALLBACK="1"

# Cloudflare for SaaS (only if you keep DNS at Hostinger — Appendix A). Optional.
CF_API_TOKEN=""
CF_ZONE_ID=""
CF_FALLBACK_ORIGIN=""
```

`DB_PASSWORD` is already in your `.env`; compose reuses it for the control DB.

> **Host note:** the API runs in a container, so DB hosts use
> `host.docker.internal` (the host gateway) — never the VPS public IP and never
> `localhost`. This is already wired in `docker-compose.prod.yml`.
>
> **Postgres access for provisioning:** `TENANT_DB_ADMIN_URL` connects as the
> `postgres` superuser from the Docker subnet. Make sure the superuser has a
> password set and `pg_hba.conf` permits it, e.g. add:
> `host  all  postgres  172.17.0.0/16  scram-sha-256` and
> `sudo -u postgres psql -c "ALTER USER postgres PASSWORD '<PG_SUPERUSER_PASSWORD>';"`,
> then `systemctl restart postgresql`. (The existing `enrich`/`172.17.0.0/16`
> rule already covers `CONTROL_DATABASE_URL`.)

---

## Step 1 — Deploy the updated code

The control-plane scaffolding and these changes are in your feature branch.

1. Merge the feature branch into `main` (PR or fast-forward). Pushing `main`
   triggers `.github/workflows/deploy.yml`, which:
   - rebuilds & restarts the **API** + judge worker on the VPS, and
   - redeploys **student-web**, **admin-web**, **landing-web** to Cloudflare.
2. `superadmin-web` is now part of the deploy workflow. After CI completes,
   open the new Worker in Cloudflare → **Workers & Pages → `rankership-superadmin`
   → Settings → Domains & Routes → Add Custom Domain** → e.g.
   `superadmin.rankership.com`. Cloudflare auto-provisions SSL and DNS.
   From then on you can use the UI for every step below; `curl` examples are
   kept as an alternative.

> **ORDERING MATTERS — read this before merging.** Once the new API code serves
> traffic, **authenticated** routes call `request.getTenantPrisma()`, which
> needs the tenant to resolve. For Rankership that means the control plane must
> be reachable **and** a `Tenant` row must exist whose `id` equals the legacy
> tenant id (Step 4). If the new code goes live *before* that, logged-in
> Rankership users get `400 "Tenant context required"` on most pages until you
> finish provisioning (the login page and the legacy data itself are unaffected,
> and there is no destructive change).
>
> Choose one of:
> - **Safe ordering:** in a short maintenance window, do Steps 2–4 (create
>   `enrich_control`, run control migrations, register Rankership) and *then*
>   let the new API restart — or run Steps 2–4 against the control DB while the
>   OLD container is still serving, then restart into the new image.
> - **Legacy-fallback flag (recommended):** set `WHITELABEL_LEGACY_FALLBACK=1`
>   so `getTenantPrisma()` falls back to the legacy DB when no tenant resolves —
>   the new code then behaves exactly like today even with no control plane.
>   Deploy with it on, complete Steps 2–6, launch Nivexa, then remove the flag
>   for strict isolation. This flag is implemented (`WHITELABEL_LEGACY_FALLBACK`).
>
> **Rollback:** redeploy the previous `main` commit. The old code has no control
> plane dependency, so Rankership returns to normal instantly; the only pending
> migration (payments) is additive and harmless.

---

## Step 2 — Create the control-plane database

On the VPS:

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE enrich_control OWNER enrich;
\q
```

Add the env vars from Step 0 to `/opt/enrich-skills/.env`, then restart and
run the control-plane migrations from inside the API container:

```bash
cd /opt/enrich-skills
docker compose -f docker-compose.prod.yml up -d api

# Generate the control client + apply control migrations
docker compose -f docker-compose.prod.yml exec -T -w /app/apps/api api \
  npx prisma generate --schema ./prisma-control/schema.prisma
docker compose -f docker-compose.prod.yml exec -T -w /app/apps/api api \
  npx prisma migrate deploy --schema ./prisma-control/schema.prisma
```

Verify the tables exist:

```bash
sudo -u postgres psql enrich_control -c '\dt'
# Expect: Tenant, TenantDomain, TenantDbConfig, TenantBranding,
#         TenantPaymentCredential, SuperAdmin, Enquiry, ProvisionLog, AuditLog
```

---

## Step 3 — Create a super-admin

```bash
cd /opt/enrich-skills
docker compose -f docker-compose.prod.yml exec -T -w /app/apps/api api \
  npx tsx scripts/create-superadmin.ts \
    --email you@rankership.com --name "Your Name" --password '<strong-password>'
```

Get a super-admin token (used for the provisioning calls below):

```bash
curl -s -X POST https://api.rankership.com/api/v1/superadmin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@rankership.com","password":"<strong-password>"}'
# → copy the "token" from the response into SUPERADMIN_JWT
```

---

## Step 4 — Register Rankership as a control-plane tenant (no migration)

First find the existing (legacy) tenant id:

```bash
sudo -u postgres psql enrich_skills -c 'SELECT id, slug, name FROM "Tenant";'
# → copy the id, call it <LEGACY_ID>
```

Register Rankership in the control plane with **the same id** and **no
dedicated DB** (it keeps using the legacy DB via the built-in fallback):

```bash
docker compose -f docker-compose.prod.yml exec -T -w /app/apps/api api \
  npx tsx scripts/register-legacy-tenant.ts \
    --id <LEGACY_ID> \
    --slug rankership --name "Rankership" \
    --admin-host admin.rankership.com \
    --student-host student.rankership.com \
    --extra-host rankership.com \
    --product-name "Rankership" \
    --primary-color "#0f172a" --accent-color "#0ea5e9"
```

After this, requests from the Rankership domains resolve to this tenant and
keep reading/writing the legacy DB. Existing logins are unaffected.

---

## Step 5 — Provision and seed the Nivexa tenant

### 5a. Provision the dedicated DB

This creates the `tenant_nivexa` Postgres role + database, applies the tenant
schema, and stores the encrypted connection string. Requires
`TENANT_DB_ADMIN_URL` (superuser) to be set.

```bash
curl -s -X POST https://api.rankership.com/api/v1/superadmin/tenants \
  -H "Authorization: Bearer $SUPERADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nivexa Talent Solutions",
    "slug": "nivexa",
    "branding": { "primaryColor": "#1d4ed8", "secondaryColor": "#38bdf8" }
  }'
# → copy the new tenant "id" → <NIVEXA_ID>
# (product name, logo, favicon, support email are set in Step 7)
```

Confirm provisioning succeeded:

```bash
sudo -u postgres psql enrich_control \
  -c "SELECT step, status, message FROM \"ProvisionLog\" WHERE \"tenantId\"='<NIVEXA_ID>' ORDER BY \"createdAt\";"
sudo -u postgres psql -lqt | grep tenant_nivexa
```

### 5b. Seed Nivexa from the current data

Dry-run first (reads from the legacy DB, rewrites `tenantId` → `<NIVEXA_ID>`):

```bash
docker compose -f docker-compose.prod.yml exec -T -w /app/apps/api api \
  npx tsx scripts/migrate-to-tenant-dbs.ts \
    --tenantId=<NIVEXA_ID> --source-tenant-id=<LEGACY_ID> --dry-run
```

Review the row counts, then run for real:

```bash
docker compose -f docker-compose.prod.yml exec -T -w /app/apps/api api \
  npx tsx scripts/migrate-to-tenant-dbs.ts \
    --tenantId=<NIVEXA_ID> --source-tenant-id=<LEGACY_ID>
```

This copies users, courses, tests, batches, attempts, etc. into the Nivexa DB.
Because users are copied, **the existing admin/student accounts work on Nivexa
with the same credentials** — Nivexa then diverges from here.

> Nivexa and Rankership now share nothing at the database level. New data
> created on either side stays isolated.

---

## Step 6 — Point the Nivexa domains at the apps

Both sites are served by the **same** Cloudflare Workers (`rankership-student`,
`rankership-admin`); the hostname is what tells them and the API apart. You need
`lms.nivexatalentsolutions.com` and `lmsadmin.nivexatalentsolutions.com` to be
served by those Workers over HTTPS.

There are two ways to do this. **Option 1 is strongly recommended** — it is the
same mechanism Rankership already uses and is far less fragile.

### Option 1 (recommended): move nivexatalentsolutions.com to Cloudflare

1. Cloudflare dashboard → **Add a site** → `nivexatalentsolutions.com` (Free plan).
2. Cloudflare scans existing DNS. **Recreate any records you rely on** (e.g.
   Hostinger email `MX`, `SPF`/`TXT`, website `A`/`CNAME`) so nothing breaks.
3. Cloudflare gives you two nameservers. In **Hostinger → Domains → DNS /
   Nameservers**, switch to **Custom nameservers** and paste them. Wait for
   activation (5–30 min).
4. **Workers & Pages** → `rankership-student` → **Settings → Domains & Routes →
   Add Custom Domain** → `lms.nivexatalentsolutions.com`.
5. `rankership-admin` → Add Custom Domain → `lmsadmin.nivexatalentsolutions.com`.
6. Cloudflare auto-creates the DNS records and provisions SSL.

> You keep using Hostinger only as the registrar. Email and other records keep
> working because you recreated them in Cloudflare in step 2.

### Option 2: keep DNS at Hostinger (Cloudflare for SaaS)

If you cannot move nameservers, use Cloudflare for SaaS custom hostnames — see
**Appendix A**. It's more moving parts (fallback origin + Worker route + DCV
records at Hostinger), so prefer Option 1 unless you have a hard constraint.

### Register the domains in the control plane

Whichever option you used, tell the platform about the hosts so it resolves the
tenant and allows CORS. Via the super-admin API:

```bash
# student LMS
curl -s -X POST https://api.rankership.com/api/v1/superadmin/tenants/<NIVEXA_ID>/domains \
  -H "Authorization: Bearer $SUPERADMIN_JWT" -H "Content-Type: application/json" \
  -d '{"host":"lms.nivexatalentsolutions.com","kind":"student"}'

# admin portal
curl -s -X POST https://api.rankership.com/api/v1/superadmin/tenants/<NIVEXA_ID>/domains \
  -H "Authorization: Bearer $SUPERADMIN_JWT" -H "Content-Type: application/json" \
  -d '{"host":"lmsadmin.nivexatalentsolutions.com","kind":"admin"}'
```

If `CF_API_TOKEN` is set, this also registers a Cloudflare-for-SaaS custom
hostname and returns the DCV record to publish (Appendix A). With Option 1 you
can ignore the DCV output — the Worker custom domain already handles TLS.

> Once these domain rows exist and the tenant is `active`, the API's dynamic
> CORS automatically allows `https://lms…` and `https://lmsadmin…`. No code
> change or env edit is required for CORS.

---

## Step 7 — Branding

Branding is data-driven and was seeded in Step 5a. To adjust it later:

```bash
curl -s -X PUT https://api.rankership.com/api/v1/superadmin/tenants/<NIVEXA_ID>/branding \
  -H "Authorization: Bearer $SUPERADMIN_JWT" -H "Content-Type: application/json" \
  -d '{
    "productName": "Nivexa LMS",
    "primaryColor": "#1d4ed8",
    "accentColor": "#38bdf8",
    "logoUrl": "https://.../nivexa-logo.png",
    "faviconUrl": "https://.../nivexa-favicon.png",
    "supportEmail": "support@nivexatalentsolutions.com"
  }'
```

The student/admin apps fetch `GET /api/v1/branding` on load (sending
`X-Tenant-Host`), apply the colours via CSS variables, set the page title and
favicon, and inject any custom CSS — so the Nivexa domains show Nivexa branding
and the Rankership domains show Rankership branding, from the same build.

---

## Step 8 — (Optional) Payments

If Nivexa takes payments, add their own Razorpay/Stripe credentials:

```bash
curl -s -X PUT https://api.rankership.com/api/v1/superadmin/tenants/<NIVEXA_ID>/payment-credentials/razorpay \
  -H "Authorization: Bearer $SUPERADMIN_JWT" -H "Content-Type: application/json" \
  -d '{"mode":"live","publicKey":"rzp_live_...","secretKey":"...","webhookSecret":"...","currency":"INR"}'
```

Set the webhook URL in the provider dashboard to:

- Razorpay: `https://api.rankership.com/api/v1/payments/webhook/razorpay/<NIVEXA_ID>`
- Stripe: `https://api.rankership.com/api/v1/payments/webhook/stripe/<NIVEXA_ID>`

---

## Step 9 — Verify

1. Open `https://lmsadmin.nivexatalentsolutions.com` → confirm Nivexa branding
   (title/colours), log in with a copied admin account.
2. Open `https://lms.nivexatalentsolutions.com` → student login, confirm a
   course/test from the seeded data is visible.
3. Create a new student/batch on Nivexa, then confirm it does **not** appear on
   Rankership (`admin.rankership.com`) — proves DB isolation.
4. Send an invite from the Nivexa admin → confirm the email link points to
   `https://lms.nivexatalentsolutions.com/invite?...` (per-tenant URL).
5. Confirm Rankership (`admin.rankership.com` / `student.rankership.com`) still
   works and shows Rankership branding.

---

## Rollback / safety

- **Nivexa only:** to back out Nivexa, delete its `TenantDomain` rows (DNS will
  stop resolving to it) and optionally drop `tenant_nivexa`. Rankership is
  untouched throughout.
- **Branding/host resolution issue:** if a domain isn't recognised, the API
  falls back to default branding and the legacy DB; it won't crash.
- **Backups:** take a fresh `pg_dump` of `enrich_skills` before Step 5 so you
  can re-run the seed if needed.
- The legacy DB remains the source of truth for Rankership; nothing in this
  runbook drops `tenantId` columns or legacy tables (that destructive trim is a
  separate future PR — see `docs/WHITELABEL-CUTOVER.md`).

---

## Appendix A — Cloudflare for SaaS (keeping DNS at Hostinger)

Use this only if you can't move the zone to Cloudflare (Option 1 in Step 6).

**Prerequisites:** a Cloudflare zone you control (e.g. `rankership.com`) with
*Cloudflare for SaaS* enabled, and these API env vars set:

- `CF_API_TOKEN` — token with *SSL and Certificates: Edit* on the zone.
- `CF_ZONE_ID` — the zone id.
- `CF_FALLBACK_ORIGIN` — a hostname in your zone that resolves to the app you're
  fronting (e.g. `lms-origin.rankership.com`), proxied through Cloudflare.

**Flow:**

1. Registering the domain in the control plane (Step 6) calls Cloudflare and
   creates a **custom hostname**; the API returns a **DCV** record (a `TXT` or
   `CNAME`) for domain-control validation.
2. At **Hostinger DNS**, for each host add:
   - the **DCV** record exactly as returned, and
   - a `CNAME` from `lms.nivexatalentsolutions.com` (and `lmsadmin…`) to your
     `CF_FALLBACK_ORIGIN`.
3. Cloudflare validates and issues a certificate for each custom hostname.
4. **Serving the Worker on the custom hostname:** add a **Worker route** for the
   custom hostnames (or set the custom hostname's origin to the Worker) so
   `rankership-student` / `rankership-admin` handle those hosts. Verify in the
   Cloudflare dashboard that requests to the custom hostnames hit the right
   Worker. This Worker-on-custom-hostname wiring is the fiddly part — confirm
   against the current Cloudflare for SaaS + Workers docs for your plan.
5. Once Cloudflare reports each custom hostname as **active**, click **Refresh**
   in the super-admin Domains tab (or re-`GET` the domains) to record
   `verifiedAt`.

If `CF_API_TOKEN` is blank, Step 6 still records the domain locally; you'd then
create the custom hostname and certificate manually in the Cloudflare dashboard.
