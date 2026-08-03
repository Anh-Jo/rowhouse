# Rowhouse — Master plan

Rowhouse is a governed database workspace for ops, support and dev teams of
startups/SMBs: a premium, multi-device explorer and safe editor on top of
production databases, with an embedded AI agent (later phases) that works
*inside* the governance layer, never around it. Built on the
`nest-starter-pack` stack: NestJS 11 + Fastify, React 19 + Vite, Prisma +
PostgreSQL (app DB), OpenAPI → generated frontend types, Zod everywhere,
`pnpm verify` as the single quality gate.

**Standing order — security with fluidity.** Security is a project-wide
guideline, not a feature: every phase applies the trust-layer decisions below
(D2, D3, D10, D11) by default. Its counterpart is UX: security must never
translate into friction for the user — safe defaults, invisible guardrails,
explicit and helpful errors when a guardrail fires. When a trade-off between
the two seems necessary, redesign the flow instead of weakening either side.

**V1 scope** (phases 0–2): governed foundation (multi-tenant, encrypted
credentials, dual-role connections, introspection, append-only audit),
read explorer, safe single-record editing with RBAC and approvals.
**Out of scope for V1**: the embedded agent (P3+), automations (P4), MCP
server / second engine / self-host packaging (P5), billing.

## Phase index

| Phase | Plan                                             | Branch               | Delivers                                             |
| ----- | ------------------------------------------------ | -------------------- | ---------------------------------------------------- |
| 0     | [phase-0-foundation.md](./phase-0-foundation.md) | `feat/foundation`    | Bootstrap + multi-tenant + datasources + audit core  |
| 1     | phase-1-explorer.md (to write at phase start)    | `feat/explorer-read` | Premium read explorer (grid, relations, saved views) |
| 2     | phase-2-safe-edit.md (to write at phase start)   | `feat/safe-edit`     | Single edit, RBAC, PII masking, approvals            |
| 3+    | planned after V1 feedback                        | —                    | AI analyst, governed agents, MCP, MySQL/MariaDB      |

Each phase plan is written **at the start of its own session**, following the
skeleton in this folder's upstream `nest-starter-pack` docs — except phase 0,
already written.

## Transverse decisions (do not reopen)

1. **PostgreSQL first, single engine until after V1.** The datasource
   abstraction is contractual from phase 0: no postgres-ism leaks outside the
   datasource layer (integration tests are written against the interface, not
   the driver). MySQL/MariaDB is added post-V1, pulled by real user demand.
   Non-relational engines (DynamoDB, Mongo) are a separate product family,
   out of roadmap until a strong customer signal — they break introspection,
   relation navigation and the connection-role trust model.
2. **Guardrails live in the execution path, never in a prompt.** Every target
   datasource gets two distinct connection roles (read-only / read-write);
   read-only is the default. Permissions are enforced server-side in the
   query engine.
3. **Append-only audit from phase 0.** Every statement executed against a
   customer database is journaled (who, what, when, duration, status,
   approved-by) before any data UI exists. The audit table is insert-only at
   the application layer.
4. **The agent (P3+) goes through the same governed APIs as humans.** It
   never holds a direct database connection and inherits the permissions of
   the invoking user. Row content is always treated as untrusted data, never
   as instructions.
5. **Claude Agent SDK + MCP as the agent stack** (P3+). We build governance
   and business context, not an agent runtime.
6. **nest-starter-pack conventions are kept wholesale**: feature silos,
   OpenAPI → generated types, Zod DTOs via nestjs-zod, `env.get()` accessor,
   cursor pagination helpers, ESLint boundary rules, `pnpm verify` gate,
   one phase = one branch = one session.
7. **Mobile-first explorer.** Multi-device is a core differentiator; it is
   decided at the first component (list + detail pattern on small screens),
   not as final polish.
8. **App DB vs target DBs are strictly separate worlds.** Prisma is used
   only for Rowhouse's own application database. Target (customer) databases
   are reached exclusively through the datasource layer with raw
   parameterized SQL — never through Prisma models.
9. **Better Auth is the auth layer** (Prisma adapter, email/password +
   cookie sessions in P0; OAuth/2FA are config, not code, later). Its
   **organization plugin is the backbone of Workspace/members/invitations**
   — we do not rebuild membership, roles or invitation flows. Domain tables
   reference the organization id. NestJS/Fastify integration via the
   maintained community module, wrapped in our own `auth` module so the
   rest of the codebase never imports Better Auth directly.
10. **Envelope encryption with a `KeyProvider` interface for target-DB
    credentials.** Each credential gets its own DEK (AES-256-GCM); DEKs are
    wrapped by a KEK that only the `KeyProvider` can unwrap. P0/dev provider
    reads the KEK from env; production swaps in a KMS-backed provider
    (AWS KMS / Vault) without touching the data model. Plaintext secrets
    exist only in memory, just-in-time, never in logs or API responses;
    every unwrap is audited. Rotation = rewrap DEKs, not re-encrypt data.
11. **Least privilege on customer databases, by onboarding design.** We
    never ask for a superuser: the connect flow generates a SQL snippet the
    customer runs to create `rowhouse_ro` / `rowhouse_rw` roles with minimal
    grants. TLS is required by default on target connections.

## Data model (shared by all phases)

- `User`, sessions, `Workspace` (= Better Auth organization),
  `WorkspaceMember(role: owner|admin|member)`, invitations — all managed by
  Better Auth tables (Prisma adapter, decision D9); every domain query is
  workspace-scoped by a guard, enforced in tests.
- `Project` — groups datasources inside a workspace (e.g. one product, or
  one environment).
- `Datasource(type: postgres, name, host, port, database)` — plus exactly two
  `DatasourceCredential` rows (`role: read_only|read_write`), secrets under
  envelope encryption (per-credential DEK wrapped via `KeyProvider`,
  decision D10; never logged, never serialized).
- `SchemaTable` / `SchemaColumn` — persisted introspection snapshot
  (relations, PK/FK, types, nullability) + team-editable metadata
  (description, PII flag — the PII flag feeds P2 masking).
- `AuditEvent` — append-only: actor, workspace, datasource, connection role,
  statement fingerprint + params digest, row count, duration, status,
  `approvedBy` (nullable, used from P2).

Invariants: no cross-workspace access; no plaintext secret ever returned by
any API; every target-DB statement produces exactly one `AuditEvent`.

## Gate

Run from the repo root, all green before asking for user validation:
`pnpm verify`
