# syntax=docker/dockerfile:1
# Build from the repo root:
#   docker build -f infra/backend.Dockerfile .

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

# ── Build: install workspace deps, generate Prisma client, compile ──────────
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json apps/backend/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter backend
COPY apps/backend apps/backend
# Generate BOTH Prisma clients: the app client (prisma.config.ts → DATABASE_URL)
# and the better-auth client (prisma.auth.config.ts → AUTH_DATABASE_URL, output
# src/generated/auth-prisma). `database:generate` runs both; the compile step
# imports the auth client, so skipping it breaks `nest build`. generate never
# connects, so placeholder URLs are enough at build time.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    AUTH_DATABASE_URL="postgresql://build:build@localhost:5432/build_auth" \
    pnpm --filter backend run database:generate \
    && pnpm --filter backend run build \
    # deploy copies the package with pruned prod deps, but follows npm pack
    # rules (.gitignore) which exclude dist — copy it in explicitly
    && pnpm --filter backend --prod deploy /prod/backend \
    && cp -r apps/backend/dist /prod/backend/dist

# ── Runner: minimal production image ─────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app
# Prisma's migration engine needs OpenSSL; the slim image ships without it.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /prod/backend /app
COPY --chown=node:node infra/backend-entrypoint.sh /app/entrypoint.sh
COPY --chown=node:node infra/ensure-auth-db.cjs /app/ensure-auth-db.cjs
# WORKDIR created /app owned by root; the app must be able to write there
RUN chown node:node /app
USER node
EXPOSE 3000
# start-period covers `migrate deploy` on first boot before health checks count
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# entrypoint applies pending migrations, then execs the server
CMD ["sh", "/app/entrypoint.sh"]
