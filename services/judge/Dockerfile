# Multi-stage build for RankerShip Judge Worker (Phase 3 — Coding Tests)
# This container needs access to the Docker socket to spawn sandboxed execution containers.
FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY services/judge/package.json services/judge/
COPY apps/api/prisma/schema.prisma apps/api/prisma/schema.prisma
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --prod=false

FROM deps AS build
COPY packages/shared/ packages/shared/
COPY services/judge/ services/judge/
COPY apps/api/prisma/ apps/api/prisma/
RUN pnpm --filter @enrich-skills/shared build
RUN cd services/judge && npx prisma generate --schema=../../apps/api/prisma/schema.prisma
RUN pnpm --filter @enrich-skills/judge build

FROM node:20-slim AS runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/services/judge/dist ./services/judge/dist
COPY --from=build /app/services/judge/package.json ./services/judge/package.json
COPY --from=build /app/services/judge/node_modules ./services/judge/node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
EXPOSE 4000
CMD ["node", "services/judge/dist/index.js"]
