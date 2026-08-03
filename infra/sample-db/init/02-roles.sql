-- Sample TARGET database — connection roles.
-- These are exactly the two roles Rowhouse's connect flow expects on any
-- target database (master plan transverse decisions D2/D11): a least-privilege
-- read-only/read-write pair instead of a superuser, read-only being the
-- default. This file mirrors the SQL snippet onboarding generates for
-- customers; trivial passwords are fine here — dev-only, never on a real DB.

CREATE ROLE rowhouse_ro LOGIN PASSWORD 'rowhouse_ro';
CREATE ROLE rowhouse_rw LOGIN PASSWORD 'rowhouse_rw';

-- Deny-by-default so the grants below are the *whole* story: without this,
-- PUBLIC's implicit CONNECT would make the explicit CONNECT grants meaningless.
REVOKE ALL ON DATABASE sampledb FROM PUBLIC;

GRANT CONNECT ON DATABASE sampledb TO rowhouse_ro, rowhouse_rw;
GRANT USAGE ON SCHEMA public TO rowhouse_ro, rowhouse_rw;

-- rowhouse_ro: SELECT only — no INSERT/UPDATE/DELETE anywhere. The connect
-- flow's "test connection" probe relies on writes actually failing here.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO rowhouse_ro;

-- rowhouse_rw: row DML but no DDL — Rowhouse edits data, never structure.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rowhouse_rw;
-- Sequence access so rw inserts work on serial/identity columns regardless of
-- how a future table declares them (plain serial sequences do check privileges).
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rowhouse_rw;

-- Future tables (created by the sampledb superuser, e.g. when someone extends
-- this schema) must inherit the same grants — ALTER DEFAULT PRIVILEGES applies
-- to objects later created by the role running this script.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO rowhouse_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rowhouse_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO rowhouse_rw;
