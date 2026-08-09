# Phase 2 — Safe single-record editing

**Branch**: `feat/safe-edit-write` → `feat/safe-edit-rbac` →
`feat/safe-edit-approvals` (stacked) · **Depends on**: phase 1 (explorer
read) merged, phase 1.5 (connection methods) merged.

## Goal

Turn the read-only explorer into a **safe editor**: a user can change one
record and see it persist, but only through the same governed rails as reads
— the `READ_WRITE` role opens only here, every write is single-record and
audited, PII is masked unless the caller may reveal it, and sensitive writes
wait for a second pair of eyes. Nothing about the trust layer is relaxed to
make editing possible; the guardrails move into the write path, never into a
prompt or a convention.

## Scope

The READ_WRITE credential role has existed since P0 with **no code path** on
purpose (see the comment in `query-engine.service.ts`). P2 opens it, behind
three settled invariants:

1. **One governed write path.** Writes go through `QueryEngine.executeWrite`
   on the READ_WRITE role, exactly like reads go through `executeRead` —
   resolved through the workspace (foreign ids 404), one `AuditEvent` per
   execution (D3), SQL built only in the target-db layer from snapshot
   identifiers (D1). No other code may open a write connection.
2. **Single-record by construction.** Every statement carries a full-PK
   `WHERE` and runs inside a transaction that asserts **exactly one affected
   row** — otherwise it rolls back and audits an ERROR. A safe editor can
   never fan out into a table-wide UPDATE.
3. **Capability, masking and approval are server-side.** RBAC decides who may
   write / reveal PII / approve; masking is applied in serialization from the
   snapshot, not as a client-trimmable field; approval gating is enforced on
   apply. The agent (P3+) inherits every one of these through the same API
   (D4).

Three stacked slices, one concern each.

### Slice A — Write rail + single-record UPDATE (`feat/safe-edit-write`)

The end-to-end write, audited, with the minimal gate (only a workspace role
with write capability may edit — full matrix lands in B).

- **target-db**: extend `ExternalDatasource` with
  `executeWrite(connection, sql, params): Promise<WriteResult>`
  (`{ rowCount }`); implement on `PostgresExternalDatasource` inside a
  transaction that `ROLLBACK`s unless `rowCount === 1`. Add
  `QueryEngine.executeWrite` — parametrize the currently-hardcoded
  `role: 'READ_ONLY'` in `execute()`, select READ_WRITE for writes, keep
  READ_ONLY the default for every existing caller. New `AuditAction.WRITE`.
  Thread `approvedBy` through `AuditRecord` and `AuditService.record` (the
  column exists since P0 but is never written yet) — null in slice A, used
  in C.
- **SQL builder**: `buildUpdateRow` in `postgres-sql.builders.ts` — quoted
  snapshot identifiers, `SET` only over snapshot columns, `WHERE` over the
  full PK, all values parameterized. Unit tests: quoting, PK arity, no
  identifier ever taken from client input.
- **modules/explorer** (or a new `editor` module): a
  `PATCH .../tables/:tableId/rows/:rowKey` endpoint with a Zod DTO carrying
  the column→value map to set, snapshot-scoped (unknown column / foreign
  tableId → 404/422), behind the write-capability gate. Returns the re-read
  updated row. E2e: write is
  audited on the READ_WRITE role; the multi-row guard rolls back and audits
  ERROR; READ_ONLY role and non-writer 404/403; cross-tenant 404.
- **webapp**: inline field editing on the record page (react-hook-form),
  a before/after diff preview, react-query mutation with invalidation; the
  edit affordance is absent for read-only members.

### Slice B — RBAC capabilities + PII masking (`feat/safe-edit-rbac`)

- **Capability policy** derived from the Better Auth org role already exposed
  as `request.workspaceRole` (owner | admin | member) — a single documented
  matrix over `{ read, write, revealPii, approve }`. Add
  `@CurrentWorkspaceRole()` and a `RequireCapability` guard; we do **not**
  build a bespoke RBAC table (D9 — the org plugin is the backbone).
- **PII masking**: columns flagged `isPii` in the snapshot are masked in the
  read serialization (grid + record) for callers without `revealPii`.
  Masking happens in the target-db/explorer serialization from the snapshot,
  never as a field the client filters — an unauthorized caller never receives
  the plaintext. A reveal is itself an audited action.
- **webapp**: PII values badged and masked with a reveal control shown only
  to privileged roles; edit/approve affordances gated by capability; a
  read-only workspace members/roles view.
- Tests: masking asserted per role on grid and record; reveal audited;
  every write/approve endpoint rejects an under-privileged caller.

### Slice C — Four-eyes approvals (`feat/safe-edit-approvals`)

- **Schema (app DB only, D8)**: `ChangeRequest` — workspace, datasource,
  `tableId` (SchemaTable snapshot id), encoded PK, proposed column diff,
  `status: PENDING | APPROVED | REJECTED | APPLIED`, `requestedBy`,
  `reviewedBy`, timestamps. The proposed write lives here until applied; the
  customer DB is untouched while pending.
- **Policy**: which writes need approval (baseline: any write touching a
  `isPii` column; configurable per datasource later). A gated write becomes a
  PENDING `ChangeRequest` instead of an immediate apply.
- **Apply**: approval by a **different** member with `approve` (separation of
  duties — requester ≠ approver, enforced server-side) re-validates the row
  hasn't drifted (optimistic check on original values), then applies through
  `QueryEngine.executeWrite`, writing `approvedBy` on the WRITE audit event.
  Reject → REJECTED, zero DB contact. Apply is idempotent (a second apply of
  an APPLIED request is a no-op, not a second write).
- **webapp**: an approvals inbox (pending list + diff review + approve/reject);
  the editor's submit routes to "applied" or "pending approval" per policy.
- Tests: state-machine transitions; self-approval rejected; apply writes
  exactly one WRITE event with `approvedBy`; drift detection blocks a stale
  apply; cross-tenant 404.

**Non-goals**: bulk / multi-row edits, INSERT/DELETE of records (single-row
UPDATE first; add on the same rail after), free-form SQL, per-column
field-level approval policy UI (baseline policy is code-level in C), agent
writes (P3+, same API).

## Design decisions (phase-local — candidates to promote to the master list)

- **D13 — Capability policy over org roles, not a new RBAC table.** The
  `{read, write, revealPii, approve}` matrix is a pure function of the Better
  Auth org role (D9). Finer-grained Better Auth access-control roles are a
  later refinement, not a data-model change.
- **D14 — Four-eyes on sensitive writes, enforced on apply.** Separation of
  duties (requester ≠ approver) and the single-row transaction guard are the
  two write-side guardrails; both live in the execution path (D2), never in
  UI or prompt.

## Manual validation

Against the seeded sample-db, as an admin: open a `customers` record, edit a
non-PII field, see the diff, apply — the grid reflects it and the audit view
shows one WRITE on the READ_WRITE role. As a member (read-only): the edit
affordance is absent and the PATCH endpoint 403s. Flag `customers.email` PII,
reload as a member: the value is masked with no reveal control; as an admin,
reveal it and see the reveal audited. Edit `customers.email` as an admin: the
change lands in the approvals inbox as PENDING; a second admin approves it,
it applies, and the WRITE event carries `approvedBy`; the requester cannot
approve their own change. Attempt a hand-crafted UPDATE that would match two
rows (via a colliding PK fixture): it rolls back and audits ERROR.

## Gate

`pnpm verify` green at the end of each slice before asking for validation;
coverage ratchet never lowered; the append-only audit surface and the
no-plaintext-secret invariants stay pinned by their existing specs.
