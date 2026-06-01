# Multi-stage build for RankerShip API (Phase 1 deployment)
FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --prod=false

FROM deps AS build
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/
RUN pnpm --filter @enrich-skills/shared build
# Generate BOTH Prisma clients: the tenant client (default schema) and the
# control-plane client (custom output to src/generated/prisma-control).
RUN pnpm --filter @enrich-skills/api exec prisma generate
RUN pnpm --filter @enrich-skills/api exec prisma generate --schema=prisma-control/schema.prisma
RUN pnpm --filter @enrich-skills/api build
# The control client is imported by the compiled app as ../generated/prisma-control
# (i.e. dist/generated/...), so mirror the generated client into dist.
RUN cp -r apps/api/src/generated apps/api/dist/generated


FROM node:20-slim AS runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
# prisma-control schema + migrations, plus src/scripts so control migrations
# and the one-time onboarding scripts can run via `docker compose exec api`.
COPY --from=build /app/apps/api/prisma-control ./apps/api/prisma-control
COPY --from=build /app/apps/api/scripts ./apps/api/scripts
COPY --from=build /app/apps/api/src ./apps/api/src
COPY --from=build /app/apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "--import", "./apps/api/dist/instrument.js", "apps/api/dist/index.js"]
