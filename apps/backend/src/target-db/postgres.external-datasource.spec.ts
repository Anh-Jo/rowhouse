import { PostgresExternalDatasource } from './postgres.external-datasource';
import type { TargetConnection } from './target-connection.factory';

function connectionReturning(rows: unknown[]): {
  connection: TargetConnection;
  query: jest.Mock;
} {
  const query = jest.fn().mockResolvedValue({ rows });
  return {
    connection: { query, end: jest.fn() } as unknown as TargetConnection,
    query,
  };
}

describe('PostgresExternalDatasource', () => {
  it('maps catalog rows into tables with PK and FK metadata', async () => {
    const { connection } = connectionReturning([
      {
        table_schema: 'public',
        table_name: 'customers',
        column_name: 'id',
        data_type: 'integer',
        is_nullable: 'NO',
        is_primary_key: true,
        fk_table: null,
        fk_column: null,
      },
      {
        table_schema: 'public',
        table_name: 'orders',
        column_name: 'id',
        data_type: 'integer',
        is_nullable: 'NO',
        is_primary_key: true,
        fk_table: null,
        fk_column: null,
      },
      {
        table_schema: 'public',
        table_name: 'orders',
        column_name: 'customer_id',
        data_type: 'integer',
        is_nullable: 'YES',
        is_primary_key: false,
        fk_table: 'customers',
        fk_column: 'id',
        enum_values: null,
      },
      {
        table_schema: 'public',
        table_name: 'orders',
        column_name: 'status',
        data_type: 'USER-DEFINED',
        is_nullable: 'NO',
        is_primary_key: false,
        fk_table: null,
        fk_column: null,
        enum_values: ['pending', 'paid', 'shipped'],
      },
    ]);
    const datasource = new PostgresExternalDatasource();

    const schema = await datasource.introspect(connection);

    expect(schema.tables).toHaveLength(2);
    const orders = schema.tables.find((t) => t.name === 'orders');
    expect(orders?.columns).toEqual([
      {
        name: 'id',
        dataType: 'integer',
        isNullable: false,
        isPrimaryKey: true,
        references: null,
        // Non-enum rows arrive with a NULL (or absent) label array -> [].
        enumValues: [],
      },
      {
        name: 'customer_id',
        dataType: 'integer',
        isNullable: true,
        isPrimaryKey: false,
        references: { table: 'customers', column: 'id' },
        enumValues: [],
      },
      {
        // A native enum surfaces its labels in declared order.
        name: 'status',
        dataType: 'USER-DEFINED',
        isNullable: false,
        isPrimaryKey: false,
        references: null,
        enumValues: ['pending', 'paid', 'shipped'],
      },
    ]);
  });

  it('executes a parameterized read and reports the row count', async () => {
    const { connection, query } = connectionReturning([{ id: 1 }, { id: 2 }]);
    const datasource = new PostgresExternalDatasource();

    const result = await datasource.executeRead(
      connection,
      'SELECT * FROM customers WHERE country = $1',
      ['FR'],
    );

    expect(query).toHaveBeenCalledWith(
      'SELECT * FROM customers WHERE country = $1',
      ['FR'],
    );
    expect(result.rowCount).toBe(2);
  });
});
