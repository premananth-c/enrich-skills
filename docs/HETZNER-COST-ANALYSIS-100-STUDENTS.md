# Hetzner Infrastructure Cost Analysis — 100 Students Coding Test

> **Date:** March 7, 2026
> **Context:** Evaluating Hetzner server options for running RankerShip coding tests with 100 concurrent students over 3-day events (8 hours/day).

---

## 1. Workload Profile

The RankerShip platform for 100 students doing coding tests involves:

| Component | Role |
|-----------|------|
| **API server** (Node.js) | Handles HTTP requests, WebSocket connections |
| **PostgreSQL** | Database (runs natively on host) |
| **Redis** | Queue/cache (256 MB configured) |
| **Caddy** | Reverse proxy with TLS |
| **Judge worker** | Spawns isolated Docker containers per code submission (up to 512 MB RAM each, 5 s timeout) |

The judge worker is the heaviest component. Each student submission creates a short-lived Docker container. With 100 students, peak concurrency is estimated at **15–30 simultaneous containers** (students don't all submit at the exact same second, and containers only live ~5 s).

---

## 2. Resource Estimation

| Component | RAM Needed | CPU Needed |
|-----------|-----------|------------|
| API + Caddy + Redis | ~1–2 GB | 1–2 vCPU |
| PostgreSQL | ~1–2 GB | 1–2 vCPU |
| Judge containers (peak 20) | ~10 GB | 4–6 vCPU |
| OS + Docker overhead | ~1 GB | — |
| **Total** | **~14–16 GB** | **~6–10 vCPU** |

---

## 3. Hetzner Server Options

### Option 1: CCX33 (Dedicated vCPU) — Recommended

| Spec | Value |
|------|-------|
| vCPU | 8 (dedicated) |
| RAM | 32 GB |
| Disk | 240 GB NVMe |
| Traffic | 20 TB included |
| **Monthly Cost** | **~€35–45/month** |

Dedicated vCPUs ensure consistent performance during a test (no noisy neighbors). 32 GB RAM gives headroom for 20–30 concurrent Docker containers plus all services.

### Option 2: CCX23 (Dedicated vCPU) — Budget

| Spec | Value |
|------|-------|
| vCPU | 4 (dedicated) |
| RAM | 16 GB |
| Disk | 160 GB NVMe |
| Traffic | 20 TB included |
| **Monthly Cost** | **~€24.49/month** |

Works if a queue with concurrency limit is implemented (e.g., max 8–10 containers at once). Students would experience slightly longer wait times for results during peak load.

### Option 3: AX42 Dedicated Server — Best for Frequent Tests

| Spec | Value |
|------|-------|
| CPU | AMD Ryzen 7 PRO 8700GE (8 cores / 16 threads) |
| RAM | 64 GB DDR5 |
| Disk | 2× 512 GB NVMe SSD |
| Traffic | Unlimited |
| **Monthly Cost** | **~€46–52/month** |
| Setup Fee | €39 one-time |

Best value if tests are run frequently (weekly/monthly). 64 GB RAM handles 100+ concurrent containers easily. **Note:** dedicated servers cannot be snapshotted or deleted on demand like cloud servers.

---

## 4. Additional Hetzner Expenses

| Expense | Cost | Notes |
|---------|------|-------|
| **Primary IPv4** | €0.60/month | Required unless IPv6-only |
| **Backups** | 20% of server cost (~€5–10/month) | 7 backup slots |
| **Snapshots** | €0.011–0.012/GB/month | On-demand; compressed size only |
| **Extra volumes** | €0.044/GB/month | If more storage is needed |
| **Floating IP** | €3.57/month | Only for failover IPs |
| **Overage traffic** | €1.00/TB | Beyond included 20 TB (unlikely) |
| **Load Balancer** | from €5.49/month | Only for horizontal scaling |

### Non-Hetzner Recurring Costs

| Service | Purpose | Cost |
|---------|---------|------|
| **Cloudflare R2** | Asset storage | Free tier: 10 GB storage, 10M reads/month |
| **Resend** | Email invites | Free tier: 100 emails/day, 3000/month |
| **Domain** (rankership.com) | DNS | ~$10–15/year |
| **Gemini API** | AI features | Usage-based |

---

## 5. Event-Based Usage Strategy (Recommended)

Since the server is needed for only **~24 hours total** (8 hours × 3 days) per event, paying monthly is wasteful. Hetzner Cloud charges **by the hour** with a monthly price cap — if the server is deleted before month-end, only hours used are billed.

### Workflow: Snapshot + Spin Up on Demand

#### One-Time Setup (before the first event)

1. Create a **CCX33** cloud server
2. Install everything — Docker, PostgreSQL, app stack, pull all language images (`python:3.11-slim`, `node:18-slim`, etc.)
3. Configure everything, run a test, verify it works
4. **Create a snapshot** of the server
5. **Delete the server** — billing stops immediately

#### Before Each Event (day before or morning of)

1. **Create a new server from the snapshot** — takes ~30 seconds via Console or API
2. Restore the latest database from a PostgreSQL dump stored in R2
3. Start the Docker Compose stack
4. Run a quick smoke test
5. Live

#### After the Event (when done)

1. Export/backup the database (student submissions, scores)
2. **Delete the server** — billing stops immediately
3. Optionally update the snapshot if the environment changed

### Automation via hcloud CLI

**Spin up from snapshot:**

```bash
hcloud server create \
  --name rankership-event \
  --type ccx33 \
  --image <your-snapshot-id> \
  --location nbg1 \
  --ssh-key <your-key>
```

**Tear down after event:**

```bash
# Backup DB first
pg_dump enrich_skills > backup.sql
# Upload backup to R2 or download locally

# Delete the server
hcloud server delete rankership-event
```

**Create a fresh snapshot (if environment was updated):**

```bash
hcloud server create-image --type snapshot --description "rankership-v2" rankership-event
```

---

## 6. Cost Calculation — Per Event (3 Days)

### CCX33 (Recommended)

| Item | Cost |
|------|------|
| Server hourly rate | ~€0.065/hour |
| 3 days × 8 hours = 24 hours | **~€1.56** |
| Buffer (keep server up 12 h/day) = 36 hours | **~€2.34** |
| IPv4 address (prorated ~3 days) | ~€0.06 |
| Snapshot storage (~10–15 GB compressed, idle months) | ~€0.12–0.18/month |
| **Total for the event** | **~€2–3** |
| **Total per month (idle, just snapshot)** | **~€0.15–0.20** |

### CCX23 (Budget)

| Item | Cost |
|------|------|
| 36 hours of usage | **~€1.20** |
| Snapshot + IPv4 | ~€0.18 |
| **Total for the event** | **~€1.50** |

### Annual Estimate (3–4 events/year)

| | CCX33 | CCX23 |
|--|-------|-------|
| Events (4 × ~€2.50) | €10 | €6 |
| Snapshot storage (12 months) | €2 | €1.50 |
| **Annual total** | **~€12** | **~€7.50** |

---

## 7. Data Persistence Between Events

| Data | Storage Location | Cost |
|------|-----------------|------|
| **Server snapshot** (OS + app + Docker images) | Hetzner snapshots | €0.12–0.18/month |
| **Database backup** (PostgreSQL dump) | Cloudflare R2 (free tier) | Free (under 10 GB) |
| **Student submissions / files** | Already in R2 | Free / minimal |

---

## 8. Key Recommendations

1. **Use Hetzner Cloud, not dedicated servers** — dedicated servers have setup fees and cannot be snapshotted/deleted on demand.
2. **CCX33 is the sweet spot** — 32 GB RAM handles 100 students comfortably, costs ~€2–3 per 3-day event.
3. **Implement a concurrency limiter** in the judge worker (e.g., max 10–15 simultaneous containers via Redis queue) to prevent resource exhaustion if all 100 students submit at once.
4. **Pre-pull Docker images** before creating the snapshot — so the judge worker doesn't waste time downloading images during the event.
5. **Always backup the database to R2** before deleting the server — the snapshot preserves OS/app, but an explicit DB backup is safer.
6. **Don't pay monthly** — the event-based snapshot strategy reduces costs by 95%+.
