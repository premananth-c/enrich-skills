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
RUN pnpm --filter @enrich-skills/api build
RUN pnpm --filter @enrich-skills/api exec prisma generate

FROM node:20-slim AS runtime
WORKDIR /app
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/apps/api/node_modules ./node_modules
COPY --from=build /app/node_modules/.pnpm node_modules/.pnpm
EXPOSE 3000
CMD ["node", "dist/index.js"]
