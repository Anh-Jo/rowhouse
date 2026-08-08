# Phase 1 — Premium explorer (read)

**Branch**: `feat/explorer-tables-view` then `feat/explorer-record-view`
(stacked) · **Depends on**: phase 0 (merged or via `integration/p0-preview`)

## Goal

The daily-driver read experience: browse any table's rows in a fast,
full-width data grid, open a record, and see everything it connects to —
without writing SQL and without ever leaving the read-only rails.

## Scope

Two stacked slices, one per view:

**A — All-tables data view** (`feat/explorer-tables-view`)
- Backend `explorer` module: governed row reading. SQL is built ONLY in the
  target-db layer (decision D1) from snapshot identifiers — never from
  client input — and executed through the QueryEngine (READ_ONLY role, one
  audit event per page, decision D3). Keyset pagination on the primary key
  (row-value comparison for composite PKs); tables without a PK serve the
  first page only.
- Frontend: full-width workspace layout (data views escape the centered
  container), table switcher listing every table of the datasource, dense
  mono data grid (28px rows, sticky header, tabular-nums), cursor "load
  more". Mobile: table list → grid as list+detail (D7).

**B — Record detail & linked records** (`feat/explorer-record-view`)
- Backend: record fetch by PK + related records — outgoing FKs resolve the
  referenced row per relation; incoming FKs list each referencing table
  with a count and a first page of rows. Same rails: snapshot-driven SQL,
  QueryEngine, audited.
- Frontend: record page — field/value list (PII values visibly badged),
  linked panels per relation with counts, navigation record → record.

**Non-goals**: editing (P2), PII masking enforcement (P2, needs RBAC),
saved views (later in P1), filters/search inside the grid (next P1 slice),
non-PK sorting.

## Steps

1. Phase plan (this file).
2. `target-db`: pure SQL builders (quoting, keyset pagination, FK lookups)
   + a `RowReader` service composing builders with the QueryEngine so
   feature modules stay engine-neutral. Unit tests on builders (quoting,
   cursor round-trip, row-value comparisons).
3. `modules/explorer`: rows endpoint
   (`GET .../tables/:tableId/rows?cursor&limit`), snapshot-scoped
   (tableId is a SchemaTable id — foreign ids 404), JSON-safe value
   serialization. E2e with a fake target connection: pagination, audit
   events, cross-tenant 404.
4. Frontend A (grid + full-width + switcher) with tests on the grid
   pagination flow.
5. `modules/explorer`: record endpoint
   (`GET .../tables/:tableId/rows/:rowKey` — rowKey encodes the PK
   value(s)) returning `{ row, references, referencedBy }`. E2e: outgoing
   and incoming relations, counts, 404s.
6. Frontend B (record page + linked panels + navigation) with tests.

## Manual validation

Against the seeded sample-db: open `orders` in the grid (200 rows page by
page, newest first), open one order — see its customer resolved and its
order_items listed with a count; click through to the customer and see
their orders back-referenced. Audit view shows one READ per page served.

## Slice C — Grid filters, sort and search (`feat/explorer-refinements`)

- Backend: the rows endpoint accepts `filters` (JSON array of
  `{column, op, value}` with a whitelisted operator set: eq, neq,
  contains, gt, gte, lt, lte, isnull, notnull), `sort` (snapshot-validated
  column + direction) and `search` (ILIKE across text-ish columns).
  Identifiers are snapshot-validated and quoted; values are always
  parameterized. Keyset pagination composes with custom sort by extending
  the row-value comparison to `(sortColumn, ...pk)` — the cursor encodes
  the sort value plus the PK values.
- Frontend: sortable column headers, per-column filter popovers, a search
  box, active-filter chips; all reflected in the URL so views are
  shareable.
- Audit unchanged: one READ per page, params as digest.

