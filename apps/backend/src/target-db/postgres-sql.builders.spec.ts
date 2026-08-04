import {
  buildCountReferencing,
  buildGetRow,
  buildListReferencing,
  buildListRows,
  decodeRowKey,
  encodeRowKey,
  quoteIdent,
} from './postgres-sql.builders';

describe('postgres-sql.builders', () => {
  it('quotes identifiers so hostile names cannot break out', () => {
    expect(quoteIdent('orders')).toBe('"orders"');
    expect(quoteIdent('weird"name')).toBe('"weird""name"');
  });

  it('round-trips a row key, rejecting malformed or wrong-arity cursors', () => {
    const key = encodeRowKey([42, 'a"b']);
    expect(decodeRowKey(key, 2)).toEqual([42, 'a"b']);
    expect(() => decodeRowKey(key, 1)).toThrow('Malformed cursor');
    expect(() => decodeRowKey('not-base64-json', 1)).toThrow(
      'Malformed cursor',
    );
  });

  it('builds a first page ordered by the primary key, over-fetching by one', () => {
    const { sql, params } = buildListRows({
      table: { schema: 'public', name: 'orders' },
      columns: ['id', 'status'],
      pkColumns: ['id'],
      limit: 25,
    });
    expect(sql).toBe(
      'SELECT "id", "status" FROM "public"."orders" ORDER BY "id" LIMIT 26',
    );
    expect(params).toEqual([]);
  });

  it('resumes from a composite-PK cursor with a row-value comparison', () => {
    const { sql, params } = buildListRows({
      table: { schema: 'public', name: 'order_items' },
      columns: ['order_id', 'product_id', 'quantity'],
      pkColumns: ['order_id', 'product_id'],
      limit: 10,
      cursorValues: [7, 3],
    });
    expect(sql).toContain('WHERE ("order_id", "product_id") > ($1, $2)');
    expect(sql).toContain('ORDER BY "order_id", "product_id" LIMIT 11');
    expect(params).toEqual([7, 3]);
  });

  it('serves tables without a PK unordered, first page only', () => {
    const { sql } = buildListRows({
      table: { schema: 'public', name: 'logs' },
      columns: ['message'],
      pkColumns: [],
      limit: 5,
    });
    expect(sql).toBe('SELECT "message" FROM "public"."logs" LIMIT 6');
  });

  it('builds PK lookup, referencing list and count statements', () => {
    expect(
      buildGetRow({
        table: { schema: 'public', name: 'orders' },
        columns: ['id'],
        pkColumns: ['id'],
        pkValues: [9],
      }),
    ).toEqual({
      sql: 'SELECT "id" FROM "public"."orders" WHERE "id" = $1 LIMIT 1',
      params: [9],
    });
    expect(
      buildListReferencing({
        table: { schema: 'public', name: 'order_items' },
        columns: ['order_id'],
        viaColumn: 'order_id',
        value: 9,
        limit: 10,
      }).sql,
    ).toContain('WHERE "order_id" = $1 LIMIT 10');
    expect(
      buildCountReferencing({
        table: { schema: 'public', name: 'order_items' },
        viaColumn: 'order_id',
        value: 9,
      }).sql,
    ).toContain('count(*)::int');
  });
});
