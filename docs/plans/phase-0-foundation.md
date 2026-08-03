# Phase 0 — Governed foundation

**Branch**: `feat/foundation` · **Depends on**: empty repo (`anh-jo/rowhouse`)

## Goal

At the end of this phase, a user can sign up, create a workspace and a
project, register a PostgreSQL datasource with encrypted credentials, see
its introspected schema in a minimal UI, and every statement executed
against that database is recorded in an append-only audit log. No data
grid yet (phase 1) — but the entire trust layer that phases 1–4 rely on
exists and is tested.

## Scope

Backend modules: `auth`, `user`, `workspace`, `project`, `datasource`,
`introspection`, `query-engine` (internal, no public endpoint beyond what
introspection needs), `audit`. Frontend: auth screens, onboarding
(create workspace → project → connect datasource), schema browser
(table list + column detail, mobile layout included).

**Non-goals**: data browsing/grid, editing, invitations/multi-member flows
(model exists, UI in P2), Google OAuth (email/password only in P0), any AI.

## Steps

1. **Bootstrap** — copy `nest-starter-pack` into `anh-jo/rowhouse` (fresh
   history), rename packages, strip demo feature code, keep infra
   (compose files, monitoring, verify pipeline, commitlint). Add a second
   dev compose service: `sample-db` (Postgres seeded with a realistic demo
   schema — customers/orders/products) used as the target database in dev
   and integration tests. `pnpm verify` green on the empty shell; CI up.
2. **Commit this plans folder** (`docs/plans/`).
3. **Auth + tenant model (Better Auth, decision D9)** — Better Auth with
   the Prisma adapter: email/password + cookie sessions, organization
   plugin as the Workspace backbone (members, roles, invitations for
   free — invitation UI still lands in P2). Mounted on NestJS/Fastify via
   the community module, wrapped in our own `auth` module (guards,
   `@CurrentUser`, `@CurrentWorkspace`) so no other module imports Better
   Auth directly. Prisma migration adds `Project` referencing the
   organization id. Workspace scoping guard; isolation covered by tests
   (user A can never read workspace B — asserted on every endpoint).
4. **Datasource module + envelope encryption (decision D10)** — CRUD with
   Zod DTOs; `DatasourceCredential` pair (read_only / read_write). Secrets
   sealed with a per-credential DEK (AES-256-GCM); DEKs wrapped by the
   `KeyProvider` (P0 implementation: KEK from `EnvSchema`; the interface
   is the contract a KMS-backed provider implements in production —
   mirrors the starter's "external providers have a local fallback" rule).
   Every unwrap emits an `AuditEvent`. The connect flow generates a
   least-privilege SQL snippet (`rowhouse_ro` / `rowhouse_rw` roles) for
   the customer to run — we never ask for a superuser; TLS required by
   default. "Test connection" endpoint validates both roles and verifies
   the read_only role actually cannot write (probe in a rolled-back
   transaction). Secrets never serialized back; tests assert ciphertext at
   rest, DEK isolation (one credential's DEK never decrypts another) and
   redaction in every response and log.
5. **Datasource abstraction** — port the v1 concept cleanly:
   `ExternalDatasource` interface (connect, introspect, executeRead — 
   parameterized, read-only role) + `PostgresDatasource` implementation
   with a bounded connection pool per datasource. Integration tests target
   the interface against `sample-db` (decision D1).
6. **Audit module** — `AuditEvent` write path wired *inside* the query
   engine (not in controllers), so no statement can bypass it. Insert-only
   repository (no update/delete methods exposed); list endpoint scoped by
   workspace, cursor-paginated.
7. **Introspection module** — read `information_schema`/`pg_catalog`
   through the query engine (so introspection itself is audited), persist
   `SchemaTable`/`SchemaColumn` snapshot, re-sync endpoint (idempotent
   diff, preserves manual metadata), editable description + PII flag.
8. **Frontend** — auth pages, onboarding flow (workspace → project →
   connect datasource with connection test feedback), schema browser:
   tables list with search, column detail (types, nullability, FK links),
   metadata editing. Responsive list + detail pattern on mobile.
9. **Codegen + gate** — OpenAPI contract exported, webapp types generated,
   coverage thresholds set (config pinned at 95% per starter convention),
   `pnpm verify` green.

## Manual validation

On a fresh clone: `pnpm run setup && pnpm dev`. Sign up, create workspace
"Acme" and project "Prod", connect the seeded `sample-db` (paste both
role URLs, connection test passes; swap the URLs and the test must fail
with an explicit "read_only role can write" error). Browse the schema on
desktop and on a phone-sized viewport, edit a column description, flag
`customers.email` as PII, re-sync the schema and confirm the flag
survives. Open the audit view: introspection and connection-test
statements are listed with actor, datasource, role and duration.
