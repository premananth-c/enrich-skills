# Deployment & Infrastructure Plan — White-Label SaaS Edition

**Document ID:** DEPLOY-INFRA-v1.0  
**Version:** 1.0  
**Date:** 2026-02-24  
**Status:** Draft  
**Author:** Engineering Team  
**Related Documents:** [BRD-v2.1](./BRD-v2.1.md) | [TDD](./TDD.md) | [LMS Admin Plan](./LMS_ADMIN_PLAN.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Compute & Hosting — Tiered Recommendations](#3-compute--hosting--tiered-recommendations)
4. [Judge Service (Code Execution)](#4-judge-service-code-execution)
5. [AI-Powered Code Analysis & Reporting](#5-ai-powered-code-analysis--reporting)
6. [Email & WhatsApp Communications](#6-email--whatsapp-communications)
7. [White-Label / Multi-Tenant Infrastructure](#7-white-label--multi-tenant-infrastructure)
8. [Student Mobile App](#8-student-mobile-app)
9. [File Storage Migration](#9-file-storage-migration)
10. [DevOps & CI/CD](#10-devops--cicd)
11. [Monitoring & Observability](#11-monitoring--observability)
12. [Decision Matrix](#12-decision-matrix)
13. [Recommended Starting Stack](#13-recommended-starting-stack)
14. [Pre-Deployment Tasks](#14-pre-deployment-tasks)
15. [Revision History](#15-revision-history)

---

## 1. Overview

### 1.1 Purpose

This document provides detailed deployment and infrastructure recommendations for the Enrich Skills platform — a white-label SaaS product sold to institutions and companies, each receiving their own branded instance.

### 1.2 Key Requirements

| Requirement | Description |
|-------------|-------------|
| **White-Label SaaS** | Multi-tenant platform sold as branded sites to institutions |
| **Code Execution** | Students write, compile, and run code with immediate test case results |
| **AI Analysis** | AI-powered analysis of coding submissions generating strength/weakness reports |
| **Multi-Channel Comms** | Email and WhatsApp notifications for course updates and admin announcements |
| **Web + Mobile** | Student app available on web browsers and mobile devices |
| **Scalability** | Must scale from 1 tenant to 100+ tenants |

### 1.3 Current Technology Stack

| Component | Technology |
|-----------|------------|
| API | Fastify 4.28 + TypeScript + Prisma 5.22 |
| Student Web | React 18 + Vite 5 + Monaco Editor |
| Admin Web | React 18 + Vite 5 + TipTap Editor |
| Judge Service | Node.js + Dockerode (code execution in Docker containers) |
| Database | PostgreSQL (via Prisma ORM) |
| Authentication | JWT (@fastify/jwt) |
| File Storage | Local filesystem (needs migration) |
| Shared Package | TypeScript types + Zod validation schemas |
| Package Manager | pnpm 10.29 (monorepo workspaces) |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Per-Tenant White-Label                         │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐   │
│  │ student.      │  │ admin.       │  │ Custom Domains         │   │
│  │ tenant1.com   │  │ tenant1.com  │  │ (TLS auto-provision)   │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬─────────────┘   │
│         │                 │                      │                  │
│         └────────────┬────┴──────────────────────┘                  │
│                      ▼                                              │
│              ┌───────────────┐                                      │
│              │  API Gateway  │  ← Tenant routing, rate limiting     │
│              │  (Fastify)    │                                       │
│              └───┬───┬───┬──┘                                       │
│                  │   │   │                                           │
│    ┌─────────────┘   │   └──────────────┐                           │
│    ▼                 ▼                  ▼                            │
│ ┌──────┐    ┌──────────────┐    ┌──────────────┐                   │
│ │Judge │    │ AI Analysis  │    │  Messaging   │                   │
│ │Queue │    │ Service      │    │  Service     │                   │
│ │(Bull)│    │ (Gemini/     │    │  (Email +    │                   │
│ │      │    │  OpenAI)     │    │   WhatsApp)  │                   │
│ └──┬───┘    └──────┬───────┘    └──────┬───────┘                   │
│    │               │                   │                            │
│    ▼               ▼                   ▼                            │
│ ┌──────┐    ┌──────────┐       ┌──────────────┐                   │
│ │Docker│    │PostgreSQL│       │Redis (Queue  │                   │
│ │Judge │    │ (Neon/   │       │ + Pub/Sub)   │                   │
│ │VMs   │    │  RDS)    │       │              │                   │
│ └──────┘    └──────────┘       └──────────────┘                   │
│                                                                     │
│ ┌──────────────────────────────────────────────────────┐           │
│ │  Object Storage (Cloudflare R2 / S3)                 │           │
│ │  Materials, Videos, Logos, Reports                    │           │
│ └──────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Compute & Hosting — Tiered Recommendations

### 3.1 Tier A: Launch & Validate (1-10 tenants, <500 students)

**Estimated Monthly Cost: $80-120**

| Component | Platform | Cost | Rationale |
|-----------|----------|------|-----------|
| **API** | [Railway](https://railway.app) | $10-20/mo | Git-based deploys, env management, auto-restart, logs |
| **Student Web** | [Cloudflare Pages](https://pages.cloudflare.com) | Free | Global CDN, unlimited bandwidth, custom domains with auto-TLS |
| **Admin Web** | [Cloudflare Pages](https://pages.cloudflare.com) | Free | Separate project, same benefits |
| **Database** | [Neon](https://neon.tech) Pro | $19/mo | Serverless Postgres, auto-scaling, branching, connection pooling built-in |
| **Judge Service** | [Hetzner Cloud](https://www.hetzner.com/cloud) CX22 | $5-8/mo | Dedicated VM with Docker daemon, 2 vCPU, 4 GB RAM |
| **Redis** | [Upstash](https://upstash.com) | Free → $10/mo | Serverless Redis for BullMQ job queues, pay-per-request |
| **File Storage** | [Cloudflare R2](https://developers.cloudflare.com/r2/) | Free → $5/mo | S3-compatible, zero egress (critical for video/PDF downloads) |
| **AI Analysis** | [Google Gemini API](https://ai.google.dev/) | ~$5-15/mo | Gemini 2.0 Flash: $0.10/1M input tokens — cheapest capable model |
| **Email** | [Resend](https://resend.com) | Free → $20/mo | Modern API, React email templates, great DX |
| **WhatsApp** | [Interakt](https://www.interakt.shop/) | ~$12/mo | Indian BSP, simple REST API, template management |
| **Monitoring** | [Sentry](https://sentry.io) + [BetterStack](https://betterstack.com) | Free tiers | Error tracking + uptime monitoring |
| **DNS/CDN/SSL** | [Cloudflare](https://cloudflare.com) | Free | DNS, DDoS protection, wildcard SSL |

### 3.2 Tier B: Growth (10-100 tenants, 500-5000 students)

**Estimated Monthly Cost: $250-450**

| Component | Platform | Cost | Why Upgrade |
|-----------|----------|------|-------------|
| **API** | [Fly.io](https://fly.io) (2-3 instances) | $30-60/mo | Multi-region, horizontal scaling, health checks |
| **Student Web** | Cloudflare Pages | Free | No change needed — CDN scales infinitely |
| **Admin Web** | Cloudflare Pages | Free | Same |
| **Database** | [Supabase](https://supabase.com) Pro or Neon Scale | $25-50/mo | More storage, connection pooling, point-in-time recovery |
| **Judge Service** | Hetzner CX32 (x2-3 VMs) | $20-40/mo | Horizontal scaling with BullMQ queue distribution |
| **Redis** | Upstash Pro | $10-30/mo | Higher throughput for queues + pub/sub |
| **File Storage** | Cloudflare R2 | $5-20/mo | Scales with usage |
| **AI Analysis** | Google Gemini API + [OpenAI API](https://platform.openai.com/) | $20-50/mo | Gemini for bulk analysis, GPT-4o for detailed reports |
| **Email** | Resend Pro | $20/mo | Higher volume |
| **WhatsApp** | [Wati](https://www.wati.io/) Growth | $50-80/mo | Better API, multi-agent support |
| **Monitoring** | Sentry Team + [Axiom](https://axiom.co) | $30-50/mo | Log aggregation, performance monitoring |

### 3.3 Tier C: Enterprise (100+ tenants, 5000+ students)

**Estimated Monthly Cost: $500-2000**

| Component | Platform | Cost | Why |
|-----------|----------|------|-----|
| **API** | [AWS ECS Fargate](https://aws.amazon.com/fargate/) or [GCP Cloud Run](https://cloud.google.com/run) | $80-200/mo | Auto-scaling containers, enterprise SLAs, VPC isolation |
| **Student/Admin Web** | [AWS CloudFront + S3](https://aws.amazon.com/cloudfront/) | $10-30/mo | Enterprise CDN, geographic restrictions for compliance |
| **Database** | [AWS RDS PostgreSQL](https://aws.amazon.com/rds/) Multi-AZ | $100-300/mo | High availability, automated failover, read replicas |
| **Judge Service** | AWS EC2 Auto Scaling Group | $60-150/mo | Auto-scales Judge VMs based on queue depth |
| **Redis** | [AWS ElastiCache](https://aws.amazon.com/elasticache/) | $30-60/mo | Managed, replicated |
| **File Storage** | [AWS S3](https://aws.amazon.com/s3/) + CloudFront | $20-50/mo | Industry standard |
| **AI Analysis** | OpenAI GPT-4o + Gemini Flash | $50-200/mo | Best quality reports |
| **Email** | [AWS SES](https://aws.amazon.com/ses/) | $0.10/1000 | Cheapest at high volume |
| **WhatsApp** | Direct [Meta Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) | Per-conversation | Cheapest at scale, no middleman |
| **Monitoring** | [Datadog](https://www.datadoghq.com/) or [Grafana Cloud](https://grafana.com/products/cloud/) | $50-100/mo | Full observability |

---

## 4. Judge Service (Code Execution)

### 4.1 Production Architecture

The current Judge service is a skeleton with `runInContainer()` but no queue processing or test case execution. The production architecture should be:

```
Student submits code
        │
        ▼
  API creates Submission (status: 'pending')
        │
        ▼
  API pushes job to BullMQ queue (Redis)
        │
        ▼
  Judge Worker(s) pick up job
        │
        ├── Pull test cases for the question
        ├── For each test case:
        │       ├── Spin up Docker container (--network=none, memory/CPU limits)
        │       ├── Run code with test case input
        │       ├── Compare output to expected
        │       ├── Record: passed, executionTimeMs, memoryUsageMb, actualOutput
        │       └── Store TestCaseResult in DB
        ├── Calculate weighted score
        ├── Update Submission (status, score, output)
        │
        ▼
  Trigger AI Analysis job (separate queue)
        │
        ▼
  AI Worker analyzes code:
        ├── Code quality (readability, structure, naming)
        ├── Problem-solving approach (algorithm choice, edge cases)
        ├── Efficiency (time/space complexity)
        ├── Correctness (test case pass rate, partial credit)
        └── Store in Submission.aiRatings JSON
        │
        ▼
  Notify student via WebSocket/SSE (real-time result)
  Send Email + WhatsApp notification (if enabled)
```

### 4.2 Judge VM Specifications

| Scale | VMs | Specs per VM | Queue Strategy |
|-------|-----|-------------|----------------|
| 1-10 tenants | 1 | 2 vCPU, 4 GB RAM, 40 GB SSD | Single worker, sequential |
| 10-100 tenants | 2-3 | 3 vCPU, 4 GB RAM, 60 GB SSD | BullMQ with concurrency 3 per worker |
| 100+ tenants | Auto-scaling group | 4 vCPU, 8 GB RAM, 80 GB SSD | BullMQ with priority queues per tenant plan |

### 4.3 Security Hardening

| Measure | Implementation |
|---------|---------------|
| **Network isolation** | `--network=none` on all containers |
| **Memory limit** | `--memory=256m` per container |
| **CPU limit** | `--cpus=0.5` per container |
| **Timeout** | Kill after `timeLimit` (per question, default 5s) |
| **Read-only filesystem** | `--read-only` flag |
| **No privileges** | `--security-opt=no-new-privileges` |
| **User namespacing** | Run as non-root inside container |

### 4.4 Alternative: Judge0 (Open Source)

If maintaining a custom execution engine is too costly, consider [Judge0](https://judge0.com/) (open-source, self-hosted):

- 60+ language support out of the box
- Built-in sandboxing (cgroups, seccomp)
- REST API for submissions
- Batch submission support
- Self-host on Hetzner/EC2 for ~$15-30/mo

This would replace the custom `dockerode` implementation with a battle-tested execution engine.

---

## 5. AI-Powered Code Analysis & Reporting

### 5.1 AI Provider Selection

| Provider | Model | Cost (per 1M tokens) | Best For |
|----------|-------|---------------------|----------|
| **Google Gemini 2.0 Flash** | gemini-2.0-flash | $0.10 input / $0.40 output | Bulk analysis — cheapest capable model |
| **OpenAI GPT-4o mini** | gpt-4o-mini | $0.15 input / $0.60 output | Good balance of cost and quality |
| **OpenAI GPT-4o** | gpt-4o | $2.50 input / $10.00 output | Detailed reports — best quality |

**Recommendation:** Use **Gemini 2.0 Flash** for per-submission analysis (high volume, low cost) and **GPT-4o** for aggregate student reports (low volume, high quality).

### 5.2 Analysis Dimensions

The existing `Submission.aiRatings` JSON field should be populated with:

| Dimension | What AI Evaluates | Data Points |
|-----------|-------------------|-------------|
| **Code Quality** (1-10) | Readability, naming conventions, structure, DRY principles, formatting | Source code |
| **Problem Solving** (1-10) | Algorithm choice, approach, edge case handling, logical flow | Source code + question description |
| **Efficiency** (1-10) | Time complexity, space complexity, optimal vs brute force | Source code + execution metrics |
| **Correctness** (1-10) | Test case pass rate, partial correctness, error handling | Test case results |
| **Strengths** | Top 2-3 things the student did well | All above |
| **Weaknesses** | Top 2-3 areas for improvement with specific suggestions | All above |
| **Plagiarism Signal** | Code similarity score across submissions in the same test | Cross-submission comparison |

### 5.3 AI Prompt Strategy

**Per-submission analysis (~500 tokens input → ~300 tokens output):**
- Include: question description, student code, language, test case results, execution time
- Ask for: structured JSON with ratings + 2-3 line feedback per dimension

**Aggregate student report (~2000 tokens input → ~1000 tokens output):**
- Include: all submissions for the student across a test/course, historical trends
- Ask for: overall strengths, weaknesses, topic-wise skill map, improvement suggestions

### 5.4 Cost Estimation (Gemini Flash)

| Scale | Submissions/month | AI Cost/month |
|-------|-------------------|---------------|
| 10 tenants, 500 students | ~5,000 | ~$2-4 |
| 50 tenants, 2500 students | ~25,000 | ~$10-20 |
| 200 tenants, 10000 students | ~100,000 | ~$40-80 |

### 5.5 Required Database Changes

A new model is needed to track per-test-case execution results:

```prisma
model TestCaseResult {
  id              String     @id @default(uuid())
  submissionId    String
  testCaseId      String
  passed          Boolean
  executionTimeMs Int?
  memoryUsageMb   Float?
  actualOutput    String?
  errorMessage    String?
  createdAt       DateTime   @default(now())

  submission      Submission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  testCase        TestCase   @relation(fields: [testCaseId], references: [id], onDelete: Cascade)
}
```

Enhanced Submission model additions:
- `executionTimeMs Int?`
- `memoryUsageMb Float?`
- `testCaseResults TestCaseResult[]`

---

## 6. Email & WhatsApp Communications

### 6.1 Email Service Selection

| Provider | Free Tier | Paid Plan | Best For |
|----------|-----------|-----------|----------|
| **[Resend](https://resend.com)** | 100 emails/day | $20/mo (50K/mo) | Best DX, React email templates, Indian deliverability |
| **[AWS SES](https://aws.amazon.com/ses/)** | 62K free (from EC2) | $0.10/1000 | Cheapest at scale |
| **[Brevo](https://www.brevo.com/)** | 300 emails/day | $9/mo (5K/mo) | Built-in template editor, marketing features |

**Recommendation:** Start with **Resend** (drop-in replacement for existing `nodemailer` via SMTP relay). Migrate to SES at Tier C scale.

### 6.2 WhatsApp Business API

WhatsApp requires a Business Solution Provider (BSP) or Meta's direct Cloud API.

| Provider | Setup Cost | Monthly | Per Conversation | Best For |
|----------|-----------|---------|------------------|----------|
| **[Interakt](https://www.interakt.shop/)** | Free | ₹999/mo (~$12) | Meta rates + markup | Easiest setup, Indian company |
| **[Wati](https://www.wati.io/)** | Free | $40/mo | Meta rates + small markup | Better API, multi-agent support |
| **[Twilio](https://www.twilio.com/whatsapp)** | Free | Pay-per-use | $0.005 + Meta rates | Best API, global, most flexible |
| **Meta Cloud API Direct** | Free | Free | Meta conversation rates only | Cheapest at scale, more setup work |

**Meta's conversation pricing (India):**
- Marketing: ₹0.77/conversation (~$0.009)
- Utility (updates, alerts): ₹0.30/conversation (~$0.004)
- Service (user-initiated): Free first 1000/month, then ₹0.30

**Recommendation:**
- Tier A: **Interakt** (cheapest Indian BSP, simple REST API)
- Tier B: **Wati** (better API, webhooks, template management)
- Tier C: **Meta Cloud API direct** (eliminate middleman costs)

### 6.3 Communication Events

| Event | Channel | Trigger | WhatsApp Template Type |
|-------|---------|---------|------------------------|
| Course material published | Email + WhatsApp | Admin publishes new material | Utility |
| Test scheduled | Email + WhatsApp | Admin creates test allocation | Utility |
| Test reminder (24h, 1h) | WhatsApp | Cron job | Utility |
| Test results available | Email + WhatsApp | All submissions graded + AI analysis complete | Utility |
| AI report ready | Email | AI analysis finished | Utility |
| Batch announcement | Email + WhatsApp | Admin sends announcement | Marketing |
| Course assignment | Email + WhatsApp | Admin assigns course to batch | Utility |
| Invite to platform | Email + WhatsApp | Admin invites student | Utility |
| Payment reminder | Email + WhatsApp | Subscription expiring (for tenants) | Marketing |

### 6.4 Notification Architecture

```
Event occurs (e.g., test results ready)
        │
        ▼
  API pushes to BullMQ "notifications" queue
        │
        ▼
  Notification Worker picks up job
        │
        ├── Check user preferences (email? whatsapp? both?)
        ├── Check tenant plan (WhatsApp enabled?)
        │
        ├── Email path:
        │     ├── Render tenant-branded email template
        │     ├── Inject tenant logo, colors, domain
        │     └── Send via Resend/SES
        │
        └── WhatsApp path:
              ├── Select pre-approved template
              ├── Fill template variables
              └── Send via WhatsApp BSP API
```

---

## 7. White-Label / Multi-Tenant Infrastructure

### 7.1 Current State

The platform has a solid multi-tenant foundation:
- `Tenant` model with `slug`, `domain`, `brandingConfig`, `featureFlags`, `status`
- `tenantId` on all core models (User, Test, Question, Course, Batch, Invite)
- `requireTenant()` enforcement in all route handlers
- JWT includes `tenantId` and `role`

### 7.2 Custom Domain Strategy

| Approach | How | Cost | Complexity |
|----------|-----|------|------------|
| **Subdomains** (`tenant1.yourdomain.com`) | Cloudflare wildcard DNS + Pages custom domains | Free | Low |
| **Custom domains** (`learn.clientbrand.com`) | Tenant adds CNAME → your platform, you provision TLS | $2/mo base | Medium |
| **Both** | Subdomain by default, custom domain as premium feature | $2/mo + $0.10/hostname | Medium |

**Recommended:** Use [Cloudflare for SaaS](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/) — it automatically provisions TLS certificates for custom domains your tenants point to you. Costs $2/month for the first 100 custom hostnames, then $0.10/hostname.

### 7.3 Tenant Routing Flow

```
Request comes in (e.g., learn.clientbrand.com)
        │
        ▼
  Cloudflare resolves → your origin
        │
        ▼
  API middleware:
        ├── Extract hostname from request
        ├── Look up Tenant by domain or slug
        ├── Check tenant status (active? suspended? trial expired?)
        ├── Check tenant plan entitlements
        ├── Inject tenantId into request context
        └── Proceed to route handler
```

### 7.4 Branding Injection (Frontend)

The existing `brandingConfig` JSON supports `logoUrl`, `primaryColor`, `secondaryColor`, `fontFamily`, `customCss`. The frontend should:

1. On load, fetch `GET /api/v1/tenants/:slug` (resolved from domain)
2. Apply branding via CSS custom properties (`--primary-color`, etc.)
3. Render tenant logo
4. Apply custom CSS (sanitized)

### 7.5 Gaps to Address for SaaS Readiness

| Gap | Priority | Description |
|-----|----------|-------------|
| **Plans & Subscriptions** | Critical | No Plan model, subscription tracking, or entitlement enforcement |
| **Payment Integration** | Critical | No Stripe/Razorpay integration, no webhook handlers |
| **Tenant Management API** | Critical | No update, delete, or status management endpoints |
| **Domain Verification** | High | No domain validation or TLS automation |
| **Feature Flag Enforcement** | High | Structure exists but no plan-to-feature mapping or gating middleware |
| **Usage Tracking** | High | No quota enforcement (max students, max tests, etc.) |
| **Tenant Admin Branding UI** | Medium | Config structure exists but no admin UI for it |
| **Audit Logging** | Medium | No tenant operation audit trail |
| **Data Export/Deletion** | Medium | No tenant data export or GDPR deletion workflow |
| **Tenant Rate Limiting** | Medium | No per-tenant rate limits |

---

## 8. Student Mobile App

### 8.1 Recommended Phased Approach

| Phase | Approach | Timeline | Cost |
|-------|----------|----------|------|
| **Phase 1** | **PWA** — add manifest + service worker to student-web | 1-2 days | $0 |
| **Phase 2** | **Capacitor** — wrap student-web in native shell | 1-2 weeks | $124 (store fees) |
| **Phase 3** | **React Native / Expo** (if needed) | 2-3 months | $124 + dev time |

### 8.2 Why Capacitor Over React Native (Initially)

- The entire `student-web` React codebase runs as-is inside Capacitor
- Monaco Editor works inside the Capacitor WebView
- Native push notifications, camera (for proctoring), and biometric auth via plugins
- Same codebase, same deploy pipeline, native app store distribution
- Maintained by the Ionic team — production stable

### 8.3 Code Editor on Mobile

- **Tablets:** Monaco Editor works well
- **Phones:** Monaco is cramped; consider [CodeMirror 6](https://codemirror.net/) which has better mobile support and a smaller bundle
- **Alternative:** Show simplified code input on phones, full Monaco on tablets/desktop (responsive breakpoint)

### 8.4 App Store Requirements

| Store | Fee | Review Time | Notes |
|-------|-----|-------------|-------|
| Apple App Store | $99/year | 1-3 days | Requires Mac for builds (use EAS Build from Expo or Appflow from Ionic) |
| Google Play Store | $25 one-time | Hours to 1 day | Easier approval process |

---

## 9. File Storage Migration

### 9.1 Current State

File storage is local filesystem (`apps/api/src/lib/storage.ts`) with `saveFile()`, `getFilePath()`, `deleteFile()` abstractions. This will not work in production (stateless containers, horizontal scaling).

### 9.2 Recommended: Cloudflare R2

| Factor | Details |
|--------|---------|
| **S3-compatible** | Drop-in replacement using `@aws-sdk/client-s3` |
| **Zero egress fees** | Students downloading PDFs/videos won't cost per-download |
| **Cost** | Free for first 10 GB stored, $0.015/GB after |
| **CDN** | Built-in via Cloudflare's network |

### 9.3 Migration Path

Replace `apps/api/src/lib/storage.ts` internals with an S3-compatible client while keeping the same function signatures (`saveFile`, `getFilePath`, `deleteFile`). The existing storage key conventions (`materials/`, `videos/`) can be preserved as S3 prefixes.

### 9.4 Storage Categories

| Category | Content | Access Pattern |
|----------|---------|----------------|
| `materials/` | Course PDFs | Read-heavy, cacheable |
| `videos/` | Batch videos (MP4) | Read-heavy, large files, use presigned URLs |
| `logos/` | Tenant logos/branding assets | Read-heavy, small files |
| `reports/` | Generated AI/PDF reports | Write-once, read-occasionally |

---

## 10. DevOps & CI/CD

### 10.1 GitHub Actions Pipeline

```
Push to main/develop
        │
        ▼
  ┌─────────────────────────────┐
  │ 1. Lint + Type-check        │  (parallel)
  │ 2. Build shared package     │
  │ 3. Run tests                │
  └─────────────┬───────────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
  ┌──────────┐    ┌──────────┐    ┌──────────┐
  │Build API │    │Build     │    │Build     │
  │Docker    │    │Student   │    │Admin     │
  │image     │    │Web       │    │Web       │
  └────┬─────┘    └────┬─────┘    └────┬─────┘
       │               │               │
       ▼               ▼               ▼
  Deploy to       Deploy to       Deploy to
  Railway/Fly     Cloudflare      Cloudflare
                  Pages           Pages
```

### 10.2 Environment Management

| Environment | Purpose | Database | Cost |
|-------------|---------|----------|------|
| **Development** | Local dev | Neon branch / local Docker Postgres | Free |
| **Staging** | Pre-production testing | Neon branch | Free |
| **Production** | Live | Neon main / RDS | Paid |

### 10.3 Required Dockerfiles

Two Dockerfiles need to be created:

1. **API Dockerfile** — Multi-stage build: install deps → build shared → build API → run
2. **Judge Dockerfile** — Node.js + Docker-in-Docker (or Docker socket mount)

---

## 11. Monitoring & Observability

### 11.1 Monitoring Stack by Tier

| Layer | Tier A (Free) | Tier B ($30-50/mo) | Tier C ($50-100/mo) |
|-------|---------------|---------------------|---------------------|
| **Error Tracking** | [Sentry](https://sentry.io) Free | Sentry Team | Sentry Business |
| **Uptime** | [BetterStack](https://betterstack.com) Free | BetterStack Pro | BetterStack Pro |
| **Logging** | Console + Railway logs | [Axiom](https://axiom.co) Free | Datadog / Grafana Cloud |
| **APM** | None | Sentry Performance | Datadog APM |
| **Alerts** | BetterStack | BetterStack + PagerDuty | Datadog + PagerDuty |

### 11.2 Health Check Endpoints

Add to the API:
- `GET /health` — Basic liveness check (returns 200)
- `GET /ready` — Readiness check (DB connected, Redis connected)

---

## 12. Decision Matrix

### Step 1: Choose your starting tier

| Situation | Tier |
|-----------|------|
| Building MVP / first 5 tenants | **Tier A** ($80-120/mo) |
| Already have paying customers | **Tier B** ($250-450/mo) |
| Enterprise contracts signed | **Tier C** ($500-2000/mo) |

### Step 2: Choose AI provider

| Priority | Choice | Cost |
|----------|--------|------|
| Cost-first | Gemini Flash only | ~$0.10/1M tokens |
| Quality-first | GPT-4o for reports + Gemini Flash for per-submission | ~$15-50/mo |
| Privacy-sensitive tenants | Self-host Ollama with Llama 3.1/CodeLlama on Hetzner GPU VM | ~$50-100/mo |

### Step 3: Choose WhatsApp provider

| Priority | Choice | Cost |
|----------|--------|------|
| India-focused, budget | Interakt | ₹999/mo |
| India-focused, better API | Wati | $40/mo |
| Global, maximum flexibility | Twilio | Pay-per-use |
| Scale (10K+ conversations/mo) | Meta Cloud API direct | Per-conversation |

### Step 4: Choose mobile strategy

| Priority | Choice | Cost |
|----------|--------|------|
| Validate first | PWA | Free, 1-2 days |
| Need app store presence | Capacitor (reuse web code) | $124 one-time |
| Need best mobile UX | React Native / Expo (new codebase) | $124 + dev time |

### Step 5: Choose database hosting

| Priority | Choice | Cost |
|----------|--------|------|
| Serverless, auto-scale | Neon | Best for variable load |
| Integrated with storage/auth | Supabase | Good ecosystem |
| Enterprise SLA required | AWS RDS | Highest reliability |

---

## 13. Recommended Starting Stack

The optimal stack to launch with — balancing cost, stability, and upgrade path:

| Component | Choice | Monthly Cost |
|-----------|--------|-------------|
| API | Railway (Pro) | $20 |
| Student Web | Cloudflare Pages | Free |
| Admin Web | Cloudflare Pages | Free |
| Database | Neon Pro | $19 |
| Judge Service | Hetzner CX22 | $5 |
| Redis / Queue | Upstash | Free → $10 |
| File Storage | Cloudflare R2 | Free → $5 |
| AI Analysis | Gemini 2.0 Flash | ~$5-15 |
| Email | Resend | Free → $20 |
| WhatsApp | Interakt | ~$12 |
| Monitoring | Sentry + BetterStack | Free |
| DNS / SSL / CDN | Cloudflare (+ for SaaS) | $2 |
| Mobile | PWA → Capacitor | Free → $124 one-time |
| **Total** | | **~$65-110/month** |

---

## 14. Pre-Deployment Tasks

Ordered by priority — complete these before going to production:

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 1 | Complete Judge pipeline — BullMQ queue, test case execution, result storage | Critical | 1-2 weeks |
| 2 | Add `TestCaseResult` model — per-test-case pass/fail tracking | Critical | 1 day |
| 3 | Integrate AI analysis — Gemini API call after grading, populate `aiRatings` | Critical | 3-5 days |
| 4 | Migrate file storage to R2/S3 — replace `apps/api/src/lib/storage.ts` | Critical | 2-3 days |
| 5 | Add Dockerfiles for API and Judge service | Critical | 1 day |
| 6 | Build notification service — BullMQ queue for email + WhatsApp | High | 1 week |
| 7 | Add tenant management endpoints — update, branding upload, domain config | High | 3-5 days |
| 8 | Add subscription/plan models — Plan, Subscription, entitlement enforcement | High | 1-2 weeks |
| 9 | Set up CI/CD — GitHub Actions for automated deploys | High | 1-2 days |
| 10 | Add health check endpoints — `/health` and `/ready` | High | 1 hour |
| 11 | Set up Cloudflare for SaaS — custom domain provisioning for tenants | Medium | 2-3 days |
| 12 | Add PWA support to student-web — manifest.json, service worker | Medium | 1-2 days |
| 13 | Add rate limiting — `@fastify/rate-limit`, per-tenant limits | Medium | 1 day |
| 14 | Payment gateway integration — Stripe/Razorpay for tenant subscriptions | Medium | 1-2 weeks |

---

## 15. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-24 | Engineering Team | Initial draft — deployment recommendations for white-label SaaS |
