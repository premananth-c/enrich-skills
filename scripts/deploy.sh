#!/bin/bash
set -euo pipefail

# Manual deploy script — run from your local machine
# Usage: bash scripts/deploy.sh YOUR_VPS_IP

VPS_IP="${1:?Usage: bash scripts/deploy.sh <VPS_IP>}"

echo "Deploying API to $VPS_IP..."

ssh "root@${VPS_IP}" << 'DEPLOY'
  set -euo pipefail
  cd /opt/enrich-skills
  git pull origin main
  docker compose -f docker-compose.prod.yml build --no-cache api
  docker compose -f docker-compose.prod.yml up -d
  docker compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy
  docker system prune -f
  echo "API deployed successfully!"
  docker compose -f docker-compose.prod.yml ps
DEPLOY

echo ""
echo "API deployment complete. Now deploying frontends to Cloudflare..."
echo ""

pnpm --filter @enrich-skills/shared build

for app in student-web admin-web landing-web; do
  echo "Building and deploying $app..."
  pnpm --filter "@enrich-skills/$app" build
  (cd "apps/$app" && npx wrangler deploy)
  echo "$app deployed!"
done

echo ""
echo "All deployments complete!"
