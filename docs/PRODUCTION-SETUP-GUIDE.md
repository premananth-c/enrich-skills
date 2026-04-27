# Production Setup Guide — RankerShip (Enrich Skills)

**Document ID:** PROD-SETUP-GUIDE  
**Version:** 1.0  
**Date:** 2026-04-27  
**Status:** Ready  
**Related Documents:** [Deployment Plan v2.0](./DEPLOYMENT-AND-INFRASTRUCTURE-PLAN-v2.0.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Phase 0: Accounts & Prerequisites](#2-phase-0-accounts--prerequisites)
3. [Phase 1: Provision the Hetzner VPS](#3-phase-1-provision-the-hetzner-vps)
4. [Phase 2: Install PostgreSQL 16 (Native)](#4-phase-2-install-postgresql-16-native)
5. [Phase 3: Install Docker Engine](#5-phase-3-install-docker-engine)
6. [Phase 4: Deploy the API](#6-phase-4-deploy-the-api)
7. [Phase 5: Configure DNS (Cloudflare)](#7-phase-5-configure-dns-cloudflare)
8. [Phase 6: Deploy Frontends to Cloudflare Workers](#8-phase-6-deploy-frontends-to-cloudflare-workers)
9. [Phase 7: Set Up Automated Backups](#9-phase-7-set-up-automated-backups)
10. [Phase 8: Set Up Monitoring](#10-phase-8-set-up-monitoring)
11. [Phase 9: Set Up CI/CD (GitHub Actions)](#11-phase-9-set-up-cicd-github-actions)
12. [Phase 10: Campaign Scaling (Scale Up/Down)](#12-phase-10-campaign-scaling-scale-updown)
13. [Coding Test (Judge Worker) — Complete Setup](#13-coding-test-judge-worker--complete-setup)
14. [Quick Reference: Common Operations](#14-quick-reference-common-operations)
15. [Summary Checklist](#15-summary-checklist)

---

## 1. Overview

This guide walks through every step to take the RankerShip monorepo from local development to a live production environment. The infrastructure follows the **Primary Approach** from the Deployment Plan v2.0: a single Hetzner VPS running Docker Compose (API, Redis, Caddy, Judge Worker) with PostgreSQL installed natively on the host, frontends deployed to Cloudflare Workers, and files stored on Cloudflare R2.

**Architecture summary:**

```
Cloudflare (Free Plan)
  ├── student.rankership.com  → Cloudflare Workers (Static Assets)
  ├── admin.rankership.com    → Cloudflare Workers (Static Assets)
  ├── rankership.com          → Cloudflare Workers (Static Assets)
  └── api.rankership.com      → Hetzner VPS (proxied)

Hetzner VPS — CX32 (4 vCPU, 8 GB RAM, 80 GB SSD)
  ├── PostgreSQL 16 (native, apt-installed)
  └── Docker Compose
      ├── Caddy (reverse proxy + auto HTTPS)
      ├── API (Fastify + Node 20)
      ├── Judge Worker (BullMQ + Dockerode)
      └── Redis 7 (job queues)

External Services (Free Tiers)
  ├── Cloudflare R2      → File storage (PDFs, videos, backups)
  ├── Resend             → Email notifications
  ├── Google Gemini API  → AI answer analysis
  ├── Sentry             → Error tracking
  └── BetterStack        → Uptime monitoring
```

---

## 2. Phase 0: Accounts & Prerequisites

### 2.1 — Create All Required Accounts

| # | Account | URL | Why | Cost |
|---|---------|-----|-----|------|
| 1 | **Hetzner Cloud** | https://console.hetzner.cloud | VPS server | ~€14/mo |
| 2 | **Cloudflare** | https://dash.cloudflare.com | DNS, CDN, R2 storage, frontend hosting | Free |
| 3 | **Resend** | https://resend.com | Sending emails | Free (100/day) |
| 4 | **Sentry** | https://sentry.io | Error tracking | Free (5K events/mo) |
| 5 | **BetterStack** | https://betterstack.com | Uptime monitoring | Free (5 monitors) |
| 6 | **GitHub** | https://github.com | Code hosting + CI/CD | Free |
| 7 | **Google AI Studio** | https://aistudio.google.com | Gemini API key for AI analysis | Free |

### 2.2 — Buy & Configure Your Domain

1. Buy `rankership.com` (or your preferred domain) from any registrar (Cloudflare Registrar is cheapest at ~$10/year).
2. Transfer DNS to Cloudflare:
   - In Cloudflare dashboard, click **"Add a site"** → enter `rankership.com`.
   - Cloudflare gives you 2 nameservers (e.g., `ada.ns.cloudflare.com`, `bob.ns.cloudflare.com`).
   - Go to your domain registrar → update nameservers to the Cloudflare ones.
   - Wait 5–30 minutes for propagation.

### 2.3 — Create Cloudflare R2 Bucket

1. Cloudflare dashboard → **R2 Object Storage** → **Create bucket**.
2. Bucket name: `rankership`.
3. Location hint: Auto (or closest to your users).
4. Go to **R2** → **Manage R2 API Tokens** → **Create API Token**:
   - Permission: Object Read & Write.
   - Specify bucket: `rankership`.
   - Click **Create** → Save these 3 values:
     - **Account ID** (shown at top of R2 page)
     - **Access Key ID**
     - **Secret Access Key**

### 2.4 — Get a Resend API Key

1. Go to https://resend.com → Sign up.
2. Go to **Domains** → **Add domain** → enter `rankership.com`.
3. Resend gives you DNS records (TXT, MX, CNAME) → add them in Cloudflare DNS.
4. Wait for verification (usually 5–10 minutes).
5. Go to **API Keys** → **Create API Key** → Save the key (starts with `re_`).

### 2.5 — Get a Gemini API Key

1. Go to https://aistudio.google.com/apikey.
2. Click **Create API Key** → Select or create a Google Cloud project.
3. Copy the key.

### 2.6 — Install Tools on Your Local PC

Open PowerShell and install:

```powershell
# Install Node.js 20 (if not already)
winget install OpenJS.NodeJS.LTS

# Install pnpm
npm install -g pnpm@10.29.3

# Install Wrangler (Cloudflare CLI)
npm install -g wrangler

# Login to Cloudflare (opens browser)
wrangler login

# Install Hetzner CLI (optional but helpful for scaling)
winget install hetznercloud.cli
```

### 2.7 — Generate Your Secrets Locally

```powershell
# Generate a JWT secret (copy the output)
openssl rand -hex 32

# Generate a database password (copy the output)
openssl rand -hex 16
```

Save both values somewhere safe (a password manager is ideal).

---

## 3. Phase 1: Provision the Hetzner VPS

### 3.1 — Create the Server

1. Go to https://console.hetzner.cloud.
2. Create a new **Project** → name it `RankerShip`.
3. Click **Add Server**:
   - **Location:** Ashburn (US East) — or Falkenstein (EU) if your users are in Europe/India.
   - **Image:** Ubuntu 24.04.
   - **Type:** Shared vCPU → **CX32** (4 vCPU, 8 GB RAM, 80 GB SSD) — ~€14/mo.
   - **SSH Key:** Click "Add SSH Key".
     - If you don't have one, generate it on your PC:

```powershell
ssh-keygen -t ed25519 -C "your-email@example.com"
# Press Enter for default location, set a passphrase if you want
# Copy the public key:
cat ~/.ssh/id_ed25519.pub
```

   - Paste the public key into Hetzner.
   - **Firewall:** Create one with rules:
     - Inbound: TCP 22 (SSH), TCP 80 (HTTP), TCP 443 (HTTPS)
     - Outbound: Allow all
   - **Name:** `rankership-prod`
   - Click **Create & Buy Now**

4. Note the server's **IPv4 address** (e.g., `65.21.xxx.xxx`).

### 3.2 — Connect to Your Server

```powershell
ssh root@YOUR_SERVER_IP
```

### 3.3 — Initial Server Setup

```bash
# Update the system
apt update && apt upgrade -y

# Set timezone
timedalctl set-timezone Asia/Kolkata

# Enable automatic security updates
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
# Select "Yes" when prompted

# Install essential tools
apt install -y curl git ufw fail2ban
```

### 3.4 — Configure Firewall (UFW)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
# Type "y" when prompted

ufw status
# Should show: 22, 80, 443 ALLOW
```

---

## 4. Phase 2: Install PostgreSQL 16 (Native)

### 4.1 — Install PostgreSQL

```bash
apt install -y postgresql-16 postgresql-client-16
```

### 4.2 — Create Database & User

```bash
sudo -u postgres psql
```

Inside the psql shell:

```sql
CREATE USER enrich WITH PASSWORD 'YOUR_DB_PASSWORD';
CREATE DATABASE enrich_skills OWNER enrich;
GRANT ALL PRIVILEGES ON DATABASE enrich_skills TO enrich;
\q
```

Replace `YOUR_DB_PASSWORD` with the password generated in Step 2.7.

### 4.3 — Allow Docker Containers to Connect

Edit `pg_hba.conf`:

```bash
nano /etc/postgresql/16/main/pg_hba.conf
```

Add at the end:

```
# Allow Docker containers to connect
host    enrich_skills    enrich    172.17.0.0/16    scram-sha-256
```

Edit `postgresql.conf`:

```bash
nano /etc/postgresql/16/main/postgresql.conf
```

Find `#listen_addresses = 'localhost'` and change to:

```
listen_addresses = 'localhost,172.17.0.1'
```

Restart PostgreSQL:

```bash
systemctl restart postgresql
systemctl status postgresql
# Should show: active (running)
```

---

## 5. Phase 3: Install Docker Engine

```bash
curl -fsSL https://get.docker.com | sh

# Verify
docker --version
docker compose version

# Test
docker run --rm hello-world
```

---

## 6. Phase 4: Deploy the API

### 6.1 — Clone the Repository

```bash
mkdir -p /opt
cd /opt
git clone https://github.com/YOUR_USERNAME/enrich-skills.git
cd enrich-skills
```

### 6.2 — Create the Production `.env` File

```bash
nano /opt/enrich-skills/.env
```

Paste and fill in your real values:

```env
# Database
DB_PASSWORD=your_password_from_step_2.7

# JWT
JWT_SECRET=your_jwt_secret_from_step_2.7

# Cloudflare R2
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=rankership
R2_PUBLIC_URL=

# Resend Email
RESEND_API_KEY=re_your_key_here
EMAIL_FROM=invite@rankership.com

# AI Analysis
GEMINI_API_KEY=your_gemini_key

# Frontend URLs
INVITE_BASE_URL=https://student.rankership.com
STUDENT_WEB_URL=https://student.rankership.com
ADMIN_WEB_URL=https://admin.rankership.com

# Streaming
ALLOWED_STREAMING_DOMAINS=rankership.com,www.rankership.com,student.rankership.com,admin.rankership.com

# Sentry (get DSN from sentry.io after creating a project)
SENTRY_DSN=
```

### 6.3 — Build & Start the Stack

```bash
cd /opt/enrich-skills

# Build and start all services (Caddy, API, Judge Worker, Redis)
docker compose -f docker-compose.prod.yml up -d --build

# Wait ~2–5 minutes, then check status
docker compose -f docker-compose.prod.yml ps
# All 4 services should show "Up" / "running"

# Check API logs for errors
docker compose -f docker-compose.prod.yml logs api --tail 50
```

### 6.4 — Run Database Migrations

```bash
docker compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy
```

### 6.5 — Seed the Database (Optional — First Time Only)

```bash
docker compose -f docker-compose.prod.yml exec -T api npx prisma db seed
```

### 6.6 — Verify the API

```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"..."}

curl http://localhost:3000/ready
# {"status":"ready","db":"ok","redis":"ok"}
```

---

## 7. Phase 5: Configure DNS (Cloudflare)

### 7.1 — Add DNS Records

Cloudflare Dashboard → `rankership.com` → **DNS** → **Records**:

| Type | Name | Content | Proxy | TTL |
|------|------|---------|:-----:|-----|
| **A** | `api` | `YOUR_SERVER_IP` | Proxied (orange) | Auto |
| **CNAME** | `student` | `rankership-student.YOUR_CF_SUBDOMAIN.workers.dev` | Proxied | Auto |
| **CNAME** | `admin` | `rankership-admin.YOUR_CF_SUBDOMAIN.workers.dev` | Proxied | Auto |
| **A** or CNAME | `@` (root) | Points to landing page worker | Proxied | Auto |

> Note: The CNAME for student/admin workers will be configured through Wrangler custom domains (Step 8.4).

### 7.2 — SSL Settings

Cloudflare → **SSL/TLS** → set mode to **Full (Strict)**.

---

## 8. Phase 6: Deploy Frontends to Cloudflare Workers

Run these from **your local PC** (not the VPS).

### 8.1 — Deploy Student Web

```powershell
cd d:\projects\enrich-skills\code\enrich-skills

pnpm --filter @enrich-skills/shared build
pnpm --filter @enrich-skills/student-web build

cd apps/student-web
npx wrangler deploy
```

### 8.2 — Deploy Admin Web

```powershell
cd d:\projects\enrich-skills\code\enrich-skills

pnpm --filter @enrich-skills/admin-web build

cd apps/admin-web
npx wrangler deploy
```

### 8.3 — Deploy Landing Web

```powershell
cd d:\projects\enrich-skills\code\enrich-skills

pnpm --filter @enrich-skills/landing-web build

cd apps/landing-web
npx wrangler deploy
```

### 8.4 — Set Custom Domains for Workers

Cloudflare Dashboard → **Workers & Pages** → click each worker → **Settings** → **Domains & Routes** → **Add Custom Domain**:

| Worker | Custom Domain |
|--------|---------------|
| `rankership-student` | `student.rankership.com` |
| `rankership-admin` | `admin.rankership.com` |
| `rankership-landing` | `rankership.com` |

Cloudflare automatically provisions SSL and updates DNS.

---

## 9. Phase 7: Set Up Automated Backups

### 9.1 — Install rclone (on VPS)

```bash
curl https://rclone.org/install.sh | bash

rclone config
# n (new remote)
# Name: r2
# Storage type: Amazon S3 Compliant
# Provider: Cloudflare
# Access Key ID: YOUR_R2_ACCESS_KEY_ID
# Secret Access Key: YOUR_R2_SECRET_ACCESS_KEY
# Endpoint: https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
# Leave other settings default, confirm and quit
```

### 9.2 — Create Backup Script

```bash
nano /opt/enrich-skills/backup.sh
```

Paste:

```bash
#!/bin/bash
set -euo pipefail
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/tmp/backup_${TIMESTAMP}.sql.gz"

pg_dump -U enrich enrich_skills | gzip > "$BACKUP_FILE"
rclone copy "$BACKUP_FILE" r2:rankership/backups/postgres/
rm "$BACKUP_FILE"

rclone delete --min-age 7d r2:rankership/backups/postgres/

echo "[$(date)] Backup completed: backup_${TIMESTAMP}.sql.gz"
```

```bash
chmod +x /opt/enrich-skills/backup.sh
```

### 9.3 — Set Up Daily Cron

```bash
crontab -e
```

Add:

```
0 2 * * * /opt/enrich-skills/backup.sh >> /var/log/enrich-backup.log 2>&1
```

### 9.4 — Test Backup

```bash
/opt/enrich-skills/backup.sh
rclone ls r2:rankership/backups/postgres/
```

---

## 10. Phase 8: Set Up Monitoring

### 10.1 — Sentry (Error Tracking)

1. Go to https://sentry.io → Create account → Create a **Node.js** project.
2. Copy the **DSN**.
3. Update the VPS `.env`:

```bash
nano /opt/enrich-skills/.env
# Set: SENTRY_DSN=https://your-sentry-dsn-here
```

4. Restart the API:

```bash
cd /opt/enrich-skills
docker compose -f docker-compose.prod.yml up -d api
```

### 10.2 — BetterStack (Uptime Monitoring)

1. Go to https://betterstack.com → Create account.
2. **Monitors** → **Create Monitor**:
   - URL: `https://api.rankership.com/health`
   - Check every: 3 minutes
   - Alert via: Email
3. Create a second monitor:
   - URL: `https://student.rankership.com`
   - Check every: 5 minutes

---

## 11. Phase 9: Set Up CI/CD (GitHub Actions)

### 11.1 — Push Code to GitHub

```powershell
cd d:\projects\enrich-skills\code\enrich-skills
git remote add origin https://github.com/YOUR_USERNAME/enrich-skills.git
git push -u origin main
```

### 11.2 — Add GitHub Secrets

GitHub → repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret Name | Value |
|-------------|-------|
| `VPS_HOST` | Your server IP (e.g., `65.21.xxx.xxx`) |
| `VPS_SSH_KEY` | Content of `~/.ssh/id_ed25519` (the **private** key) |
| `CF_API_TOKEN` | Cloudflare API token (create at https://dash.cloudflare.com/profile/api-tokens with "Edit Workers" permission) |

### 11.3 — Workflow File

The workflow is already at `.github/workflows/deploy.yml`. It auto-deploys the API + Judge Worker to the VPS and all frontends to Cloudflare whenever you push to `main`.

---

## 12. Phase 10: Campaign Scaling (Scale Up/Down)

### 12.1 — Install hcloud CLI

```powershell
winget install hetznercloud.cli

hcloud context create rankership
# Enter your Hetzner API token (Cloud Console → Security → API Tokens → Generate)
```

### 12.2 — Scale UP Before a Campaign

Run **1 day before** the campaign:

```powershell
hcloud server change-type rankership-prod cx42 --keep-disk
```

Takes ~1–2 minutes (server reboots). Upgrades to 8 vCPU, 16 GB RAM.

### 12.3 — Scale DOWN After the Campaign

Run **the day after** the campaign ends:

```powershell
hcloud server change-type rankership-prod cx32 --keep-disk
```

### 12.4 — Quick Reference

| When | Command | VPS Specs | Hourly Rate |
|------|---------|-----------|------------|
| Normal days | `hcloud server change-type rankership-prod cx32 --keep-disk` | 4 vCPU, 8 GB | €0.0224/hr |
| Before campaign | `hcloud server change-type rankership-prod cx42 --keep-disk` | 8 vCPU, 16 GB | €0.0408/hr |
| Heavy campaign | `hcloud server change-type rankership-prod ccx23 --keep-disk` | 4 dedicated vCPU, 16 GB | €0.0584/hr |

**Cost:** A 5-day campaign at CX42 costs only ~€4.90 extra (~$5.40).

---

## 13. Coding Test (Judge Worker) — Complete Setup

### 13.1 — How It Works

```
Student writes code in browser (Monaco Editor)
        │
        ├── "Run Code" button ──→ API ──→ HTTP POST to judge-worker:4000/run
        │                                  (runs against PUBLIC test cases only)
        │                                  ← returns stdout/stderr/pass/fail immediately
        │
        └── "Submit" button ───→ API ──→ Saves code to DB
                                       ──→ Adds job to Redis queue "judge"
                                              │
                                              ▼
                                     Judge Worker (BullMQ)
                                       ├── Runs code against ALL test cases
                                       ├── Each test case = one Docker container
                                       │   (network=none, memory=256MB, timeout=5s)
                                       ├── Compares output, calculates score
                                       └── Updates Submission + TestCaseResult in DB
```

Two paths:
- **Run Code** = synchronous, public test cases only, for the student to test before submitting.
- **Submit** = async via BullMQ queue, runs ALL test cases (public + hidden), scores the submission.

### 13.2 — Docker Socket Access

The judge-worker creates sibling Docker containers (Docker-out-of-Docker) via the shared socket. Already configured in `docker-compose.prod.yml`:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

Verify on the VPS:

```bash
ls -la /var/run/docker.sock
# Should show: srw-rw---- 1 root docker ...
```

### 13.3 — Pre-Pull Language Runtime Images

**This is critical.** Without pre-pulling, the first submission per language takes 30–60 seconds (downloading the image). After pulling, containers start in <1 second.

```bash
# Pull all supported language images (~1.3 GB total)
docker pull python:3.12-slim
docker pull node:22-bookworm-slim
docker pull eclipse-temurin:21-jdk
docker pull gcc:13

# Verify
docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"
```

Expected output:

```
REPOSITORY:TAG                       SIZE
python:3.12-slim                     ~150MB
node:22-bookworm-slim                ~200MB
eclipse-temurin:21-jdk               ~250MB
gcc:13                               ~400MB
```

### 13.4 — Deploy the Judge Worker

```bash
cd /opt/enrich-skills
git pull origin main

docker compose -f docker-compose.prod.yml up -d --build
```

### 13.5 — Verify All Services

```bash
docker compose -f docker-compose.prod.yml ps
```

Expected — **4 services** all "Up":

```
NAME              STATUS          PORTS
caddy             Up              0.0.0.0:80->80, 0.0.0.0:443->443
api               Up              3000/tcp
judge-worker      Up              4000/tcp
redis             Up              6379/tcp
```

### 13.6 — Verify Judge Worker Health

```bash
docker compose -f docker-compose.prod.yml logs judge-worker --tail 20
# Should show:
# [Judge] Worker started, listening for jobs on queue "judge"
# [Judge] HTTP server listening on port 4000
```

### 13.7 — Test Code Execution End-to-End

```bash
# Test Python execution
docker compose -f docker-compose.prod.yml exec api \
  curl -s -X POST http://judge-worker:4000/run \
    -H "Content-Type: application/json" \
    -d '{"code":"print(\"Hello, World!\")","language":"python","input":""}' \
  | python3 -m json.tool
```

Expected:

```json
{
    "stdout": "Hello, World!\n",
    "stderr": "",
    "exitCode": 0,
    "executionTimeMs": 450,
    "timedOut": false
}
```

Test JavaScript:

```bash
docker compose -f docker-compose.prod.yml exec api \
  curl -s -X POST http://judge-worker:4000/run \
    -H "Content-Type: application/json" \
    -d '{"code":"console.log(\"Hello from Node!\")","language":"javascript","input":""}' \
  | python3 -m json.tool
```

Test API → Judge connectivity:

```bash
docker compose -f docker-compose.prod.yml exec api \
  curl -s http://judge-worker:4000/health
# {"status":"ok"}
```

### 13.8 — Security Model

Each student code submission creates a **throwaway Docker container** with these safety measures:

| Security Layer | Setting | What It Prevents |
|---|---|---|
| **No network** | `NetworkMode: 'none'` | Can't make API calls, download files, or exfiltrate data |
| **Memory cap** | `Memory: 256MB` | Prevents infinite memory allocation from crashing the server |
| **Timeout** | Kill after 5 seconds | Prevents infinite loops from hogging resources |
| **Non-root** | `User: 1000:1000` | Code runs as unprivileged user |
| **No privilege escalation** | `SecurityOpt: ['no-new-privileges']` | Prevents sudo/setuid abuse |
| **Isolated filesystem** | Fresh container per run | Nothing persists between submissions |
| **Auto-cleanup** | `container.remove({ force: true })` | Containers destroyed after execution |

### 13.9 — Supported Languages

| Language | Docker Image | File | Compile Step |
|---|---|---|---|
| **Python** | `python:3.12-slim` | `solution.py` | None |
| **JavaScript** | `node:22-bookworm-slim` | `solution.js` | None |
| **TypeScript** | `node:22-bookworm-slim` | `solution.ts` | Via `tsx` |
| **React (TSX)** | `node:22-bookworm-slim` | `solution.tsx` | Via `tsx` |
| **Angular (TS)** | `node:22-bookworm-slim` | `solution.ts` | Via `tsx` |
| **Java** | `eclipse-temurin:21-jdk` | `Main.java` | `javac Main.java` |
| **C++** | `gcc:13` | `solution.cpp` | `g++ -std=c++17 -O2` |
| **C** | `gcc:13` | `solution.c` | `gcc -std=c17 -O2` |

### 13.10 — Scaling for Campaigns

**Normal days (20 students):** BullMQ concurrency of 2. Even if all 20 submit at once, queue clears in ~30 seconds. CX32 handles this easily.

**Campaign days (500 students):**

```bash
# Day before: scale up
hcloud server change-type rankership-prod cx42 --keep-disk
# 8 vCPU, 16 GB RAM — handles ~24 concurrent containers

# Day after: scale down
hcloud server change-type rankership-prod cx32 --keep-disk
```

### 13.11 — Troubleshooting

**"Judge service unavailable" error:**

```bash
docker compose -f docker-compose.prod.yml ps judge-worker
docker compose -f docker-compose.prod.yml logs judge-worker --tail 50
docker compose -f docker-compose.prod.yml restart judge-worker
```

**"Unsupported language" error:**

```bash
docker images | grep -E "python|node|temurin|gcc"
# If missing:
docker pull python:3.12-slim
docker pull node:22-bookworm-slim
docker pull eclipse-temurin:21-jdk
docker pull gcc:13
```

**Submissions stuck in "pending" or "running":**

```bash
docker compose -f docker-compose.prod.yml exec redis redis-cli ping
# PONG

docker compose -f docker-compose.prod.yml exec redis redis-cli LLEN bull:judge:wait
# Number of waiting jobs
```

**Docker socket permission denied:**

```bash
ls -la /var/run/docker.sock
systemctl restart docker
docker compose -f docker-compose.prod.yml up -d
```

---

## 14. Quick Reference: Common Operations

### Restart the API

```bash
ssh root@YOUR_SERVER_IP
cd /opt/enrich-skills
docker compose -f docker-compose.prod.yml restart api
```

### View API Logs

```bash
docker compose -f docker-compose.prod.yml logs api --tail 100 -f
```

### View Judge Worker Logs

```bash
docker compose -f docker-compose.prod.yml logs judge-worker --tail 100 -f
```

### Check Everything Is Running

```bash
docker compose -f docker-compose.prod.yml ps
systemctl status postgresql
```

### Full Redeploy (API + Judge Worker)

```bash
cd /opt/enrich-skills
git pull origin main
docker compose -f docker-compose.prod.yml build --no-cache api judge-worker
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy
docker system prune -f
```

### Redeploy Frontend Only (from local PC)

```powershell
cd d:\projects\enrich-skills\code\enrich-skills
pnpm --filter @enrich-skills/shared build
pnpm --filter @enrich-skills/student-web build
cd apps/student-web && npx wrangler deploy
```

### Restore a Database Backup

```bash
rclone ls r2:rankership/backups/postgres/
rclone copy r2:rankership/backups/postgres/backup_20260323_020000.sql.gz /tmp/
gunzip /tmp/backup_20260323_020000.sql.gz
sudo -u postgres psql enrich_skills < /tmp/backup_20260323_020000.sql
```

### Manual Deploy Script

From your local PC:

```bash
bash scripts/deploy.sh YOUR_VPS_IP
```

---

## 15. Summary Checklist

| # | Step | Where | Time |
|---|------|-------|------|
| 1 | Create accounts (Hetzner, Cloudflare, Resend, Sentry, BetterStack) | Browser | 30 min |
| 2 | Buy domain + move DNS to Cloudflare | Browser | 15 min |
| 3 | Create R2 bucket + API tokens | Cloudflare dashboard | 10 min |
| 4 | Get Resend API key + verify domain | Resend dashboard | 10 min |
| 5 | Get Gemini API key | Google AI Studio | 5 min |
| 6 | Provision Hetzner CX32 VPS | Hetzner dashboard | 5 min |
| 7 | SSH in, update OS, configure firewall | VPS terminal | 20 min |
| 8 | Install PostgreSQL 16, create user/db | VPS terminal | 15 min |
| 9 | Configure pg_hba.conf for Docker | VPS terminal | 10 min |
| 10 | Install Docker Engine | VPS terminal | 5 min |
| 11 | Clone repo, create `.env` | VPS terminal | 10 min |
| 12 | Pre-pull language Docker images | VPS terminal | 5 min |
| 13 | `docker compose up -d --build` | VPS terminal | 5 min |
| 14 | Run Prisma migrations | VPS terminal | 2 min |
| 15 | Test judge worker end-to-end | VPS terminal | 5 min |
| 16 | Add DNS records in Cloudflare | Cloudflare dashboard | 10 min |
| 17 | Deploy frontends via Wrangler | Local PC terminal | 10 min |
| 18 | Set custom domains for Workers | Cloudflare dashboard | 10 min |
| 19 | Set up rclone + backup cron | VPS terminal | 15 min |
| 20 | Set up Sentry + BetterStack | Browser | 15 min |
| 21 | Add GitHub Secrets + push workflow | GitHub / local PC | 15 min |
| **Total** | | | **~3.5 hours** |
