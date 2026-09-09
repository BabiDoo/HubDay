#!/bin/sh
set -e

echo "==> Running database migrations..."
pnpm --filter @hubday/api migrate

echo "==> Seeding database (idempotent)..."
pnpm --filter @hubday/api seed

echo "==> Starting Hubday API on port ${API_PORT:-3000}..."
exec node apps/api/dist/main.js
