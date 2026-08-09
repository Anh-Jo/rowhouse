import { PGlite } from '@electric-sql/pglite';
import { PostgresExternalDatasource } from '@/target-db/postgres.external-datasource';
import type { IntrospectedSchema } from '@/target-db/external-datasource.d.ts';
import type { TargetConnection } from '@/target-db/target-connection.factory';

/**
 * The only test that runs the introspection catalog query against a REAL
 * Postgres. Every other suite stubs the connection, so the SQL itself — and
 * above all the privileges it needs — goes unchecked there.
 *
 * That gap is exactly how the "no table has a primary key" bug shipped:
 * `information_schema`'s constraint views are privilege-filtered, and
 * Rowhouse always reads as the READ_ONLY role (SELECT only). The read-only
 * role is therefore the point of this file, not an extra case.
 */

/** Mirrors the shapes the sample target database uses (infra/sample-db). */
const SCHEMA_SQL = `
  CREATE TABLE customers (
    id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email text NOT NULL UNIQUE
  );
  CREATE TABLE orders (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id bigint NOT NULL REFERENCES customers (id)
  );
  -- Composite primary key: the shape a join table takes, and the one the
  -- privilege-filtered query used to miss along with every other PK.
  CREATE TABLE order_items (
    order_id   bigint NOT NULL REFERENCES orders (id),
    product_id bigint NOT NULL,
    quantity   integer NOT NULL,
    PRIMARY KEY (order_id, product_id)
  );
  -- No primary key at all: the snapshot must report that honestly.
  CREATE TABLE audit_trail (
    happened_at timestamptz NOT NULL,
    payload     text
  );
  -- Views are not browsable rows: they must stay out of the snapshot.
  CREATE VIEW recent_orders AS SELECT * FROM orders;
`;

/** The read-only role of the connect flow (D2/D11) — SELECT and nothing else. */
const ROLES_SQL = `
  CREATE ROLE rowhouse_ro;
  GRANT USAGE ON SCHEMA public TO rowhouse_ro;
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO rowhouse_ro;
`;

/** Adapts PGlite to the handle the datasource layer expects. */
function asTargetConnection(pg: PGlite): TargetConnection {
  return {
    query: async (sql: string, params?: unknown[]) => {
      const result = await pg.query(sql, params);
      return { rows: result.rows };
    },
    end: async () => {},
  };
}

function pkColumnsOf(schema: IntrospectedSchema, tableName: string): string[] {
  return (
    schema.tables
      .find((table) => table.name === tableName)
      ?.columns.filter((column) => column.isPrimaryKey)
      .map((column) => column.name) ?? []
  );
}

describe('Postgres introspection SQL (real database)', () => {
  let pg: PGlite;
  let datasource: PostgresExternalDatasource;

  beforeAll(async () => {
    pg = await PGlite.create();
    await pg.exec(SCHEMA_SQL);
    await pg.exec(ROLES_SQL);
    datasource = new PostgresExternalDatasource();
  });

  afterAll(async () => {
    await pg.close();
  });

  /** Runs the introspection as `rowhouse_ro`, restoring the role after. */
  async function introspectAsReadOnlyRole(): Promise<IntrospectedSchema> {
    await pg.exec('SET ROLE rowhouse_ro');
    try {
      return await datasource.introspect(asTargetConnection(pg));
    } finally {
      await pg.exec('RESET ROLE');
    }
  }

  it('sees the same primary keys as the READ_ONLY role and as the owner', async () => {
    const asOwner = await datasource.introspect(asTargetConnection(pg));
    const asReadOnly = await introspectAsReadOnlyRole();

    const tableNames = asOwner.tables.map((table) => table.name);
    for (const name of tableNames) {
      expect(pkColumnsOf(asReadOnly, name)).toEqual(pkColumnsOf(asOwner, name));
    }
  });

  it('marks single and composite primary keys as the READ_ONLY role', async () => {
    const schema = await introspectAsReadOnlyRole();

    expect(pkColumnsOf(schema, 'customers')).toEqual(['id']);
    expect(pkColumnsOf(schema, 'orders')).toEqual(['id']);
    // Composite key: both columns, neither dropped nor duplicated.
    expect(pkColumnsOf(schema, 'order_items')).toEqual([
      'order_id',
      'product_id',
    ]);
  });

  it('reports a genuinely key-less table as key-less', async () => {
    const schema = await introspectAsReadOnlyRole();

    expect(pkColumnsOf(schema, 'audit_trail')).toEqual([]);
  });

  it('keeps every column of a table, primary key or not', async () => {
    const schema = await introspectAsReadOnlyRole();

    const orderItems = schema.tables.find(
      (table) => table.name === 'order_items',
    );
    expect(orderItems?.columns.map((column) => column.name)).toEqual([
      'order_id',
      'product_id',
      'quantity',
    ]);
  });

  it('excludes views and system schemas', async () => {
    const schema = await introspectAsReadOnlyRole();

    expect(schema.tables.map((table) => table.name).sort()).toEqual([
      'audit_trail',
      'customers',
      'order_items',
      'orders',
    ]);
  });
});
