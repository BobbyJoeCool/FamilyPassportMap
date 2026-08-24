#!/usr/bin/env bash
set -e
export NODE_ENV=production

cd /home/site/wwwroot

echo "[startup] Creating data directory..."
mkdir -p /home/data

echo "[startup] Restoring workspace symlinks..."
mkdir -p node_modules/@familypassportmap
ln -sfn /home/site/wwwroot/packages/shared node_modules/@familypassportmap/shared

echo "[startup] Running database migrations..."
cd /home/site/wwwroot/apps/server
npx prisma migrate deploy 2>&1

echo "[startup] Starting server on port ${PORT:-8080}..."
cd /home/site/wwwroot
exec node apps/server/dist/index.js
