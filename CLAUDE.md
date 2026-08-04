# rowhouse

Rowhouse is a **governed database workspace** for ops, support and dev teams:
a premium, multi-device explorer and safe editor on top of production
databases, with an embedded AI agent (later phases) that works *inside* the
governance layer, never around it.

**Start here to iterate**: [docs/plans/README.md](./docs/plans/README.md) —
the master plan holds the phase index, the shared data model and the
**transverse decisions (D1–D11), which are settled: follow them, do not
re-litigate them.** One phase = one plan file = one branch = one session;
work in progress is stacked branches (`feat/foundation` →
`feat/workspace-projects` → `feat/datasource-vault` →
`feat/query-engine-audit` → `feat/introspection` → …), each green on
`pnpm verify` before push.

## Trust layer — non-negotiables in code terms

The product's core promise is that nothing unsafe can happen to a customer
database. These rules are load-bearing; breaking one is never a refactor
detail:

- **Every read of a customer database goes through `QueryEngine`**
  (`src/target-db/query-engine.service.ts`) — humans and (later) the agent
  alike. It resolves the datasource *through the workspace* (foreign ids 404
  like missing ones), runs on the READ_ONLY role only, and journals exactly
  one `AuditEvent` per execution, success or failure. No other code path may
  open a target-DB connection — the `TargetConnectionFactory` and
  `CredentialVault` are implementation details of `src/target-db/`.
- **Secrets**: datasource passwords are envelope-encrypted (per-credential
  DEK wrapped by the `KeyProvider` KEK — `CREDENTIALS_KEK` in env, KMS in
  prod). Plaintext exists in memory just-in-time only; never in a log, a
  response, or a test snapshot. Tests assert redaction — keep them passing.
- **Audit is append-only** (`src/audit/`): the service exposes `record` and
  `list`, nothing else. A spec pins that surface; extend it, never widen it.
- **Workspace scoping**: every scoped route sits behind
  `WorkspaceMemberGuard` and consumes ids via `@CurrentWorkspace()` /
  `@CurrentUser()` — never a client-supplied value. Non-members get **404,
  never 403** (no existence probing). New scoped queries put the workspace
  filter *inside* the query, not as a post-check.
- **Prisma is for Rowhouse's own database only** (D8). Customer databases
  are reached exclusively through the datasource layer with parameterized
  SQL; engine-specific SQL lives only in `src/target-db/*.external-datasource.ts`
  implementations (D1).
- **Security pairs with fluidity** (standing order): a guardrail that
  creates user friction is a design bug — redesign the flow, never weaken
  the guardrail.

## Backend map (beyond the starter layout)

- `src/auth/` — better-auth wrapper (separate auth database; the
  **organization plugin is the Workspace backbone**), global AuthGuard
  (protected by default), `WorkspaceMemberGuard`, decorators. No other
  module imports better-auth directly.
- `src/target-db/` — everything touching customer databases: vault
  (envelope encryption), connection factory, `ExternalDatasource`
  abstraction + Postgres implementation, governed `QueryEngine`.
- `src/audit/` — append-only journal + workspace-scoped read endpoint.
- `src/modules/project|datasource|introspection/` — feature silos on top of
  the shared layers (modules never import each other).
- E2e tests run on PGlite (in-memory Postgres, no Docker needed) and
  substitute `TargetConnectionFactory` with fakes — see
  `test/datasource.e2e-spec.ts` for the pattern that proves the
  seal → persist → unseal chain.

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
| Local Dev    | Docker Compose (DB + Mailpit + Monitoring)          |

## Getting Started (fresh clone)

**Prerequisites**: Node ≥ 20, pnpm 9 (`corepack enable`), Docker (running).

```bash
# 1. Create the backend env file (gitignored — not in a fresh clone).
#    The example already matches the dev container defaults; edit only if needed.
cp apps/backend/.env.example apps/backend/.env

# 2. One-shot bootstrap. Runs in order:
#    install deps → start dev Docker (Postgres + Mailpit, waits until healthy)
#    → run migrations (app + auth DBs) → generate both Prisma clients → codegen
#    (backend OpenAPI contract + webapp typed API bindings).
pnpm run setup   # NOTE: `pnpm run setup`, not `pnpm setup` (the latter is a built-in pnpm command)

# 3. Start everything in dev (turbo runs backend + webapp in watch mode).
pnpm dev
```

**Local URLs**: API `http://localhost:3000` · Swagger `http://localhost:3000/api-docs` · Frontend `http://localhost:5173` · Mailpit `http://localhost:3021`.

**Run steps individually** (all idempotent — safe to re-run):

| Command            | What it does                                                       |
| ------------------ | ------------------------------------------------------------------ |
| `pnpm docker:dev`  | Start dev Postgres + Mailpit, block until Postgres is healthy      |
| `pnpm db:migrate`  | `prisma migrate deploy` on both the app and better-auth DBs        |
| `pnpm db:generate` | Generate both Prisma clients (gitignored output)                   |
| `pnpm codegen`     | Backend `contracts:export` (openapi.json) → webapp `api:generate`  |
| `pnpm verify`      | Full quality gate: codegen drift + typecheck + lint + tests + knip |

> `create-auth-db.sql` provisions the `rowhouse_auth` database **only on a fresh Postgres volume**. If migrations fail on `AUTH_DATABASE_URL` against a pre-existing volume, create it once: `docker exec -i rowhouse-dev-postgres psql -U rowhouse -d rowhouse -c "CREATE DATABASE rowhouse_auth OWNER rowhouse;"`

## Project Structure

```
rowhouse/
├── apps/
│   ├── backend/         # NestJS + Fastify API
│   └── webapp/          # React 19 + Vite SPA
├── packages/
│   ├── ui/              # Shared component library
│   ├── eslint-config/   # Shared ESLint configs
│   └── typescript-config/
├── infra/
│   ├── compose.dev.yml / compose.test.yml / compose.monitoring.yml
│   ├── compose.prod.yml # Production stack (API + webapp + DB + monitoring)
│   ├── backend.Dockerfile / webapp.Dockerfile
│   └── monitoring/      # Prometheus, Grafana (provisioned dashboards), Loki, Promtail
├── e2e/                 # Playwright E2E tests
└── turbo.json
```

## Ports

- **Dev (3xxx)**: PostgreSQL 3010, Mailpit SMTP 3020, Mailpit UI 3021
- **Test (4xxx)**: PostgreSQL 4010, Mailpit SMTP 4020, Mailpit UI 4021
- **Monitoring (5xxx)**: Prometheus 5010, Loki 5020, Grafana 5030
- **App**: Backend 3000, Frontend 5173

## Architecture Conventions

### Feature Silo Pattern

Organize code by feature. Each feature is self-contained.

```
# Frontend
apps/webapp/src/
├── features/
│   └── my-feature/
│       ├── components/
│       ├── hooks/
│       └── helpers/
├── components/       # Shared/global components
├── hooks/            # Shared/global hooks
└── helpers/          # Shared/global helpers

# Backend
apps/backend/src/
├── modules/
│   └── my-feature/
│       ├── my-feature.controller.ts
│       ├── my-feature.service.ts
│       ├── my-feature.module.ts
│       └── dto/
├── helpers/
├── interceptors/
└── prisma/
```

### Reusability Rule

If something is imported in 2+ places across features, move it to the corresponding global folder.

### Path Aliases

- Frontend: `@/` -> `apps/webapp/src/`
- Backend: `@/` -> `apps/backend/src/`

## Code Conventions

- **Language**: All code, comments, commits, and docs in **English**
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/)
- **Branch naming**: `feat/short-description`, `fix/short-description`, `chore/short-description`
- **TypeScript**: Strict mode. Never use `any` or `never`.
- **Type definitions**: Extract to `types.d.ts` when 2+ types in a file. Exception: NestJS DTOs stay in `*.dto.ts`.
- **DTOs**: Zod schemas wrapped with `createZodDto` (nestjs-zod), in `*.dto.ts`. A global `ZodValidationPipe` validates `@Body()`/`@Query()`/`@Params()`; use `@ZodResponse` to type and document responses (see `app.dto.ts` for the reference pattern).
- **Env vars**: declared in the Zod `EnvSchema` (`apps/backend/src/config/env.schema.ts`) — never read `process.env` directly; use the typed singleton accessor `env.get('KEY')` (`env.init()` runs at boot).
- **API types**: Generated from OpenAPI spec — never manually type API responses on the frontend. `openapi.json` is gitignored (regenerated by `pnpm codegen`); commit it only if a client must build without a runnable backend (e.g. a mobile CI build), and then add a drift check in CI.
- **Forms**: Use react-hook-form.
- **Auth is protected-by-default**: a global `AuthGuard` (better-auth session) covers every route; opt out per-handler with `@Public()` (on the handler, not the class), read the caller with `@CurrentUser() userId: string`. Auth tables live in a **separate database** (`AUTH_DATABASE_URL`, `prisma/auth/`) owned by better-auth — the app only touches its `User` mirror (same id, synced by `AuthHooks`). `/api/auth/*` is better-auth's own REST surface, outside the OpenAPI contract. To change the plugin set, edit `buildAuthOptions` then regenerate the schema: `pnpm --filter backend run database:generate-schema:auth` + a new auth migration.
- **External providers have a local fallback**: anything talking to an external service (mail via SMTP, object storage, image CDN…) ships with an in-memory/dev fallback selected by env vars, so dev and tests never require real credentials (see the mail module's stream transport).
- **Cursor pagination**: paginated lists use `orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]` with Prisma `cursor` + `skip: 1`, over-fetch `take: limit + 1` — see `src/helpers/pagination.ts` (`clampLimit`, `paginateRows`). Never offset pagination on growing tables.
- **Infra files explain themselves**: every non-obvious block in Dockerfiles, compose files, CI workflows and env examples carries a comment saying *why* it exists (not what it does). When you touch infra, keep that contract — a future session only has the file to go on.

## Verification

- **`pnpm verify`** is the single quality gate: OpenAPI codegen (drift check) + typecheck + lint + tests + knip across the monorepo. Run it before committing; CI runs it on every PR (`verify.yml`), plus commitlint on PR commits.
- **knip** fails the gate on dead files, unused exports and unused dependencies. Intentional scaffolding is whitelisted in `knip.jsonc` with a justification comment — when you wire a scaffolding entry (mail module, API client…), remove it from the whitelist. Component public types are kept with a `@public` JSDoc tag.
- **Coverage thresholds** (backend Jest): global ratchet at the current level, `src/config` pinned at 95%. Raise the ratchet as coverage grows — never lower it.
- **Boundaries are enforced by ESLint** (not just conventions):
  - backend: no direct `process.env` (use `env.get()`), no cross-module imports (`@/modules/*` forbidden inside `src/modules/**`)
  - webapp: no cross-feature imports (`@/features/*` forbidden inside `src/features/**`), no raw `fetch` outside `src/api/` (use `fetchClient`)
  - imports from outside your own module/feature must use the `@/` alias — the silo rules rely on it

## Testing Rules

- **Backend**: Always write tests for new features and bug fixes. Tests must cover the critical paths, not just the happy path:
  - **edge cases and invalid inputs** (malformed body, missing fields, out-of-range values — the Zod boundary and beyond)
  - **write side effects** (DB mutations, mail sending, external calls): assert what was written/sent, not only the return value
  - error propagation (expected exceptions, status codes)
- **Frontend**: Write tests for complex logic and critical user flows
- **E2E**: Playwright for critical paths

## Planning Multi-Session Work

Any feature too large for a single session/PR gets a phase plan under `docs/plans/` **before** implementation starts (see `docs/plans/README.md` for the skeleton):

- One master plan (`docs/plans/README.md` of the feature set) with a phase index: one self-contained plan file per phase, one branch/session per phase, no re-planning mid-phase.
- A **"Transverse decisions (do not reopen)"** section records the choices that hold across phases (stack picks, data-model invariants, API style). Later sessions follow them instead of re-litigating.
- Every phase ends with the gate green (`pnpm verify`) plus a manual validation scenario.

## AI Collaboration Rules

- **Never auto-commit** — always ask before committing
- **Ask before large refactors** — confirm scope first
- **Always write tests for the backend**
- **Prefer editing over creating** — modify existing files when possible
- **Keep it simple** — no over-engineering
