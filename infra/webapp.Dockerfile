# syntax=docker/dockerfile:1
# Build from the repo root:
#   docker build -f infra/webapp.Dockerfile --build-arg VITE_API_URL=https://api.example.com .

FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/webapp/package.json apps/webapp/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter webapp
COPY apps/webapp apps/webapp
# Public URL of the API, baked into the bundle at build time
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter webapp run build

# ── Runner: static files served by nginx ─────────────────────────────────────
FROM nginx:1.29-alpine AS runner
COPY infra/webapp-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/webapp/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s \
    CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1
