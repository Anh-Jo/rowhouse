#!/bin/sh
# Container entrypoint: apply pending migrations, then start the server.
# `migrate deploy` is idempotent and takes a per-database advisory lock, so it
# is safe on every boot; a failed migration aborts startup so a bad deploy
# fails fast instead of serving against a stale schema.
set -e

echo "[entrypoint] migrate deploy"
node_modules/.bin/prisma migrate deploy

echo "[entrypoint] starting server"
exec node dist/src/main.js
