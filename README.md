# Rowhouse

Governed database workspace for ops, support and dev teams — a premium,
multi-device explorer and safe editor on top of production databases, with an
embedded AI agent (later phases) that works inside the governance layer, never
around it. See [docs/plans](./docs/plans/README.md) for the master plan and
phase index.

Built from [nest-starter-pack](https://github.com/Anh-Jo/nest-starter-pack).

## Tech Stack

| Layer        | Technology                                          |
| ------------ | --------------------------------------------------- |
| Monorepo     | Turborepo + pnpm workspaces                         |
| Frontend     | React 19 + Vite + TypeScript                        |
| Styling      | CSS + Radix UI                                      |
| Backend      | NestJS 11 + Fastify + TypeScript                    |
| Auth         | better-auth (session cookies, separate database)    |
| API Contract | OpenAPI (NestJS Swagger) -> openapi-ts              |
| Validation   | Zod v4 (env vars + DTOs via nestjs-zod)             |
| Database     | PostgreSQL + Prisma                                 |
| Testing      | Vitest (frontend), Jest (backend), Playwright (e2e) |
| Linting      | ESLint + Prettier                                   |
| Monitoring   | Prometheus + Grafana + Loki + Promtail              |
| Local Dev    | Docker Compose (DB + Mailpit + Monitoring)           |

## Quick Start

```bash
cp apps/backend/.env.example apps/backend/.env   # gitignored — not in a fresh clone
pnpm run setup   # NOTE: `pnpm run setup`, not `pnpm setup` (a built-in pnpm command)
pnpm dev
```

Each step also runs on its own (all idempotent — safe to re-run):

| Command            | What it does                                                       |
| ------------------ | ------------------------------------------------------------------ |
| `pnpm docker:dev`  | Start dev Postgres + Mailpit, block until Postgres is healthy      |
| `pnpm db:migrate`  | `prisma migrate deploy` on both the app and better-auth DBs        |
| `pnpm db:generate` | Generate both Prisma clients (gitignored output)                   |
| `pnpm codegen`     | Backend `contracts:export` (openapi.json) → webapp `api:generate`  |
| `pnpm verify`      | Full quality gate: codegen drift + typecheck + lint + tests + knip |

## Ports

| Stack            | Service        | Port |
| ---------------- | -------------- | ---- |
| **App**          | Backend API    | 3000 |
| **App**          | Frontend (Vite)| 5173 |
| **Dev (3xxx)**   | PostgreSQL     | 3010 |
| **Dev (3xxx)**   | Mailpit SMTP   | 3020 |
| **Dev (3xxx)**   | Mailpit UI     | 3021 |
| **Test (4xxx)**  | PostgreSQL     | 4010 |
| **Test (4xxx)**  | Mailpit SMTP   | 4020 |
| **Test (4xxx)**  | Mailpit UI     | 4021 |
| **Monitoring (5xxx)** | Prometheus | 5010 |
| **Monitoring (5xxx)** | Loki       | 5020 |
| **Monitoring (5xxx)** | Grafana    | 5030 |

## Project Structure

```
rowhouse/
├── apps/
│   ├── backend/              # NestJS + Fastify API
│   │   ├── src/
│   │   │   ├── modules/      # Feature modules (health, metrics)
│   │   │   ├── interceptors/ # Request timing, Prisma logging
│   │   │   ├── config/       # Env schema (Zod) + fail-fast validation
│   │   │   ├── logger/       # Structured logging (pino)
│   │   │   ├── mail/         # SMTP mail provider
│   │   │   ├── prisma/       # Prisma module
│   │   │   └── main.ts
│   │   ├── prisma/           # Schema, migrations, seed
│   │   ├── scripts/          # OpenAPI export
│   │   └── test/             # E2E tests
│   └── webapp/               # React 19 + Vite SPA
│       ├── src/
│       │   ├── components/   # Reusable UI components
│       │   ├── layouts/      # App layout (sidebar + content)
│       │   ├── helpers/      # Utilities
│       │   ├── hooks/        # Custom hooks
│       │   ├── styles/       # Global CSS + tokens
│       │   ├── api/          # Generated OpenAPI types
│       │   └── router.tsx
│       └── .storybook/       # Storybook config
├── packages/
│   ├── ui/                   # Shared component library
│   ├── eslint-config/        # Shared ESLint configs
│   └── typescript-config/    # Shared TSConfig presets
├── infra/
│   ├── compose.dev.yml       # Dev: PostgreSQL + Mailpit
│   ├── compose.test.yml      # Test: isolated DB + Mailpit
│   ├── compose.monitoring.yml# Local observability stack
│   ├── compose.prod.yml      # Production: API + webapp + DB + monitoring
│   ├── backend.Dockerfile    # Multi-stage NestJS production image
│   ├── webapp.Dockerfile     # Vite build served by nginx
│   └── monitoring/           # Prometheus, Grafana (provisioned dashboards), Loki, Promtail
├── e2e/                      # Playwright E2E tests
└── turbo.json
```

## Authentication

better-auth handles email/password sign-up/sign-in (optional Google SSO), session cookies, OTP password reset (via SMTP/Mailpit in dev) and self-service account deletion, in a **dedicated `rowhouse_auth` database**. The app keeps a minimal `User` mirror (same id) synced by lifecycle hooks.

- Every route is **protected by default** (global `AuthGuard`); mark exceptions with `@Public()` and read the caller with `@CurrentUser()` — see `GET /me` in `app.controller.ts` for the reference pattern.
- Auth routes live under `/api/auth/*` (better-auth's own REST surface); consume them with the typed better-auth client on the frontend.
- The auth schema is generated: `pnpm --filter backend run database:generate-schema:auth` after changing the plugin set in `buildAuthOptions`.

## Adding a Backend Module

```bash
cd apps/backend
npx nest generate module modules/my-feature
npx nest generate controller modules/my-feature
npx nest generate service modules/my-feature
```

Then register `MyFeatureModule` in `src/app.module.ts`.

## Adding a Frontend Feature

Create `apps/webapp/src/features/my-feature/` and add routes in `src/router.tsx`.

## OpenAPI Codegen

The frontend API types are auto-generated from the backend's OpenAPI spec:

```bash
# 1. Export OpenAPI spec from backend
pnpm --filter backend run contracts:export

# 2. Generate TypeScript types for frontend
pnpm --filter webapp run api:generate
```

## Monitoring

```bash
pnpm docker:monitoring
```

- Grafana: http://localhost:5030 (admin/admin)
- Prometheus: http://localhost:5010

Two dashboards are provisioned automatically in Grafana:

- **Rowhouse API** — request rate, error rate, latency percentiles (p50/p95/p99) per endpoint, status codes, endpoints overview table, Node.js runtime (memory, CPU, event loop)
- **Rowhouse API — Logs** — log volume by level, error stream, HTTP 5xx, slow requests (> 500 ms), live logs with level/search filters (Loki, pino JSON parsed by Promtail)

## Deployment

The whole stack ships as a production Docker Compose (API, webapp, PostgreSQL, monitoring included):

```bash
# 1. Configure
cp infra/.env.prod.example infra/.env   # then edit the values (passwords, public URLs)

# 2. Build and start everything — the API container applies pending migrations
#    itself at boot (see infra/backend-entrypoint.sh)
pnpm docker:prod

# Escape hatch: migrate without (re)starting the API
docker compose -f infra/compose.prod.yml run --rm migrate
```

| Service                     | Exposed on                | Notes                                  |
| --------------------------- | ------------------------- | -------------------------------------- |
| `webapp`                    | `${WEBAPP_PORT:-8080}`    | nginx, SPA fallback, hashed-asset cache |
| `api`                       | `${API_PORT:-3000}`       | health check on `/health`              |
| `grafana`                   | `${GRAFANA_PORT:-5030}`   | dashboards + datasources provisioned   |
| `postgres`, `prometheus`, `loki`, `promtail` | internal only | not published on the host       |

Images can also be built standalone (e.g. for a PaaS like Coolify):

```bash
docker build -f infra/backend.Dockerfile -t my-api .
docker build -f infra/webapp.Dockerfile --build-arg VITE_API_URL=https://api.example.com -t my-webapp .
```

## Testing

```bash
# Backend unit/integration tests
pnpm --filter backend run test

# Frontend tests
pnpm --filter webapp run test

# E2E (requires running app)
pnpm test:e2e
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm run setup` | One-shot bootstrap: install → Docker → migrate → generate → codegen |
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all apps |
| `pnpm db:migrate` | Apply Prisma migrations to the dev database |
| `pnpm db:generate` | Generate the Prisma client |
| `pnpm verify` | Full quality gate: codegen + types + lint + tests |
| `pnpm codegen` | Export OpenAPI spec + regenerate frontend API types |
| `pnpm lint` | Lint all apps |
| `pnpm check-types` | Type-check all apps |
| `pnpm format` | Format with Prettier |
| `pnpm test:e2e` | Run Playwright E2E tests |
| `pnpm docker:dev` | Start dev Docker services |
| `pnpm docker:test` | Start test Docker services |
| `pnpm docker:monitoring` | Start monitoring stack |
