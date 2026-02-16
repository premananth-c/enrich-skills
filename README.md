# Enrich Skills

White-label SaaS Mock Test & Coding Assessment Platform. See [docs/](docs/) for business and technical documentation.

## Structure

```
enrich-skills/
├── apps/
│   ├── api/           # Backend API (Fastify + Prisma)
│   ├── student-web/   # Student-facing React app
│   └── admin-web/     # Tenant admin React app
├── packages/
│   └── shared/        # Shared types and validation (Zod)
├── services/
│   └── judge/         # Docker-based code execution worker
└── docs/              # BRD, TDD, RTM
```

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 9+
- PostgreSQL
- Docker (optional, for judge service)

### Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Configure environment**

   ```bash
   cp apps/api/.env.example apps/api/.env
   # Edit apps/api/.env with your DATABASE_URL and JWT_SECRET
   ```

3. **Database**

   ```bash
   pnpm db:generate
   pnpm db:push
   pnpm db:seed
   ```

4. **Run apps**

   ```bash
   pnpm dev:api        # API on http://localhost:3000
   pnpm dev:student    # Student app on http://localhost:5173
   pnpm dev:admin      # Admin app on http://localhost:5174
   ```

   Or run all in parallel: `pnpm dev`

### Seed Accounts

| Role   | Email               | Password   |
|--------|---------------------|------------|
| Admin  | admin@example.com   | admin123   |
| Student| student@example.com | student123 |

For admin login, use the admin app (port 5174). For student login, use the student app (port 5173).

## API

- Base: `http://localhost:3000/api/v1`
- Auth: `POST /auth/login`, `POST /auth/register`
- Tenant-scoped requests require `Authorization: Bearer <token>` and `X-Tenant-Id` (or tenant from JWT).

## Phase 1 Scope

- [x] Auth (JWT, register, login)
- [x] Multi-tenant (tenant_id isolation)
- [x] Question bank (coding, MCQ)
- [x] Test builder
- [x] Student test flow (attempt, coding editor, submit)
- [x] Proctoring config UI (settings only)
- [ ] AI feedback (placeholder)
- [ ] Payments (Stripe/Razorpay)
- [ ] Judge worker (Docker execution – scaffolded)

## License

Proprietary.
