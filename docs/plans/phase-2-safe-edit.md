# Phase 2 — Safe single-record editing

**Branch**: `feat/safe-edit-write` → `feat/safe-edit-rbac` →
`feat/safe-edit-approvals` (stacked) · **Depends on**: phase 1 (explorer
read) merged, phase 1.5 (connection methods) merged.

## Goal

Turn the read-only explorer into a **safe editor**: a user can change one
record and see it persist, but only through the same governed rails as reads
— the `READ_WRITE` role opens only here, every write is single-record and
audited, and sensitive writes wait for a second pair of eyes. Nothing about
the trust layer is relaxed to
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
3. **Capability and approval are server-side.** RBAC decides who may write and
   who may approve; approval gating is enforced on apply, never in the UI. The
   agent (P3+) inherits every one of these through the same API (D4).

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
  edit affordance is absent for read-only members. **A foreign-key column is
  selected, never typed** (D15): its control is a read-only value plus a
  drawer that browses the referenced table through the governed rows endpoint
  (server-side search, cursor paging) and writes back the referenced column's
  value; clearing to NULL is offered only where the column is nullable, and a
  relation whose target table is missing from the snapshot stays read-only
  instead of degrading to a text box.

### Slice B — RBAC capabilities (`feat/safe-edit-rbac`)

- **Capability policy** derived from the Better Auth org role already exposed
  as `request.workspaceRole` (owner | admin | member) — a single documented
  matrix over `{ read, write, approve }`. Add `@CurrentWorkspaceRole()` and a
  `RequireCapability` guard; we do **not** build a bespoke RBAC table (D9 —
  the org plugin is the backbone).
- **webapp**: edit/approve affordances gated by capability; a read-only
  workspace members/roles view.
- Tests: every write/approve endpoint rejects an under-privileged caller; the
  capability matrix is asserted per role.

### Slice C — Four-eyes approvals (`feat/safe-edit-approvals`)

- **Schema (app DB only, D8)**: `ChangeRequest` — workspace, datasource,
  `tableId` (SchemaTable snapshot id), encoded PK, proposed column diff,
  `status: PENDING | APPROVED | REJECTED | APPLIED`, `requestedBy`,
  `reviewedBy`, timestamps. The proposed write lives here until applied; the
  customer DB is untouched while pending.
- **Policy**: which writes need approval — a per-datasource "require approval"
  setting (default off: writes apply directly as in slice A; on: every
  single-record write is gated). A gated write becomes a PENDING
  `ChangeRequest` instead of an immediate apply.
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
field-level approval policy UI (baseline policy is code-level in C), PII
masking (deferred — see below), agent writes (P3+, same API).

**Deferred — PII sensitivity & masking.** Read-time masking of sensitive data
is out of P2. When it lands it will be **table-level** — a table carries a
sensitivity flag rather than the per-column `isPii` flag — and every access to
a sensitive table is audited (masking/reveal gated by a capability, the reveal
itself journaled). The per-column `isPii` badge from P0 stays as plain
metadata; nothing enforces masking on it until that feature ships.

## Design decisions (phase-local — candidates to promote to the master list)

- **D13 — Capability policy over org roles, not a new RBAC table.** The
  `{read, write, approve}` matrix is a pure function of the Better Auth org
  role (D9). Finer-grained Better Auth access-control roles are a later
  refinement, not a data-model change.
- **D14 — Four-eyes on sensitive writes, enforced on apply.** Separation of
  duties (requester ≠ approver) and the single-row transaction guard are the
  two write-side guardrails; both live in the execution path (D2), never in
  UI or prompt.
- **D15 — A relation is selected, never typed.** Any editor writing a
  foreign-key column offers a picker over the referenced table (the drawer in
  slice A, and whatever surface comes later — bulk edit, the agent's own
  forms), never a free-text input. A hand-typed key is how records end up
  pointing at rows that do not exist; the referential guardrail belongs in the
  interaction, next to the server-side one. Where no picker is possible (the
  referenced table is not in the schema snapshot) the field is read-only —
  degrading to free input would defeat the rule exactly when it matters.

## Manual validation

Against the seeded sample-db, as an admin: open a `customers` record, edit a
field, see the diff, apply — the grid reflects it and the audit view shows one
WRITE on the READ_WRITE role. On an `orders` record, the `customer_id` field
offers no text box: "Change" opens the customers drawer, searching narrows it
server-side, and picking a row stages `customer_id → <that row's id>` in the
diff before apply. As a member (read-only): the edit affordance is
absent and the PATCH endpoint 403s. With approvals enabled on the datasource,
edit a `customers` record as an admin: the change lands in the approvals inbox
as PENDING; a second admin approves it, it applies, and the WRITE event carries
`approvedBy`; the requester cannot approve their own change. Attempt a
hand-crafted UPDATE that would match two rows (via a colliding PK fixture): it
rolls back and audits ERROR.

## Gate

`pnpm verify` green at the end of each slice before asking for validation;
coverage ratchet never lowered; the append-only audit surface and the
no-plaintext-secret invariants stay pinned by their existing specs.
