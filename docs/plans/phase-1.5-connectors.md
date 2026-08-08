# Phase 1.5 — Connection methods (D12)

**Branch**: `feat/connection-methods` · **Depends on**: phase 1 slice B

## Goal

Reaching a production database stops being "host + port + password over
TLS-without-CA". Connection methods become per-typology tables behind the
`TargetConnectionFactory` (decision D12), the direct method gets real TLS
verification, and Cloud SQL gets a first-class connector with IAM database
authentication — the zero-stored-password path.

## Scope

- **Schema (D12)**: `connectionMethod` discriminator on `Datasource`
  (`DIRECT` | `CLOUDSQL`); `DirectConnection` table (host, port, database,
  sslMode, optional CA cert PEM) extracted from the `Datasource` columns;
  `CloudSqlConnection` table (instanceConnectionName, database,
  authType IAM|BUILT_IN, sealed service-account key). Data-moving
  migration (create → copy → drop) exercised by the PGlite test runner.
- **Factory strategies**: one `ConnectionStrategy` per method inside
  `src/target-db/`. DIRECT: `verify-full` when a CA is provided
  (`rejectUnauthorized: true` + ca), `require` semantics otherwise.
  CLOUDSQL: `@google-cloud/cloud-sql-connector` (mTLS managed by Google,
  no IP allowlisting), SA key unsealed just-in-time; with IAM auth the
  role password is empty — ephemeral tokens, no stored DB secret at all.
- **Snippets**: the connect flow serves a gcloud + SQL script for Cloud
  SQL (service account with roles/cloudsql.client, two IAM database users
  rowhouse-ro/rowhouse-rw, grants) — least privilege by onboarding (D11).
- **Frontend**: method picker in the connect flow (Direct | Cloud SQL),
  CA upload field on Direct, Cloud SQL form with SA-key paste
  (write-only), per-method snippets in CodeBlocks.
- **Invariant**: exactly one method row, matching the discriminator —
  service-level, transaction-written, test-pinned.

**Non-goals**: SSH tunnel (own table later, same pattern), RDS IAM (same
mould after Cloud SQL), reverse agent (post-V1, with the self-host
decision), egress-IP infrastructure.

## Manual validation

Direct + sample-db still works end to end (regression). Cloud SQL: with a
real instance and the generated script executed, connect with IAM auth —
no password ever typed — then run the phase-1 explorer against it. The
guardrail probe must still reject a write-capable read-only IAM user.
