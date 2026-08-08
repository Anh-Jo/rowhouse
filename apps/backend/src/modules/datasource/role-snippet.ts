/**
 * Least-privilege onboarding (transverse decision D11): Rowhouse never asks
 * for a superuser. Instead the connect flow hands the customer this script,
 * to run once as an admin on THEIR database — it creates the exact two roles
 * the product expects: a read-only role that the connection test will verify
 * holds no write grant, and a read-write role used only behind approvals
 * from P2 on. Passwords are placeholders on purpose: they must never
 * transit through us before the customer chose them.
 */

const IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]{0,62}$/;

/** Validates and normalizes a Postgres identifier we inject into the script. */
function identifier(value: string, label: string): string {
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new Error(
      `${label} must match ${IDENTIFIER_PATTERN.source} (lowercase Postgres identifier)`,
    );
  }
  return value;
}

export type RoleSnippetInput = {
  database: string;
  schema?: string;
};

export function buildRoleSnippet(input: RoleSnippetInput): string {
  const database = identifier(input.database, 'database');
  const schema = identifier(input.schema ?? 'public', 'schema');

  return `-- Rowhouse least-privilege setup — run once as an admin on ${database}.
-- Replace the two placeholder passwords with strong ones of your choice,
-- then paste each role's credentials into the Rowhouse connect form.

CREATE ROLE rowhouse_ro LOGIN PASSWORD '<choose-a-read-only-password>';
CREATE ROLE rowhouse_rw LOGIN PASSWORD '<choose-a-read-write-password>';

GRANT CONNECT ON DATABASE ${database} TO rowhouse_ro, rowhouse_rw;
GRANT USAGE ON SCHEMA ${schema} TO rowhouse_ro, rowhouse_rw;

-- Read-only role: SELECT and nothing else, now and for future tables.
GRANT SELECT ON ALL TABLES IN SCHEMA ${schema} TO rowhouse_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema}
  GRANT SELECT ON TABLES TO rowhouse_ro;

-- Read-write role: row mutations, no DDL.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schema} TO rowhouse_rw;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA ${schema} TO rowhouse_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema}
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rowhouse_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema}
  GRANT USAGE ON SEQUENCES TO rowhouse_rw;
`;
}
