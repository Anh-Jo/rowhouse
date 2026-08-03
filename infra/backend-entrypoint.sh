#!/bin/sh
# Container entrypoint: apply pending migrations to both databases, then start
# the server. `migrate deploy` is idempotent and takes a per-database advisory
# lock, so it is safe on every boot; a failed migration aborts startup so a bad
# deploy fails fast instead of serving against a stale schema.
set -e

echo "[entrypoint] ensuring auth database exists"
node /app/ensure-auth-db.cjs

echo "[entrypoint] migrate deploy — app database"
node_modules/.bin/prisma migrate deploy

echo "[entrypoint] migrate deploy — auth database"
node_modules/.bin/prisma migrate deploy --config prisma.auth.config.ts

echo "[entrypoint] starting server"
exec node dist/src/main.js
