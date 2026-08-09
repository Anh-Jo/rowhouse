import {
  buildCountReferencing,
  buildGetRow,
  buildListReferencing,
  buildListRows,
  buildUpdateRow,
  decodeRowKey,
  encodeRowKey,
  escapeLikeValue,
  quoteIdent,
  type RowFilter,
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

  describe('filters', () => {
    const base = {
      table: { schema: 'public', name: 'orders' },
      columns: ['id', 'status'],
      pkColumns: ['id'],
      limit: 10,
    };

    it.each([
      ['eq', '"status" = $1'],
      ['neq', '"status" <> $1'],
      ['gt', '"status" > $1'],
      ['gte', '"status" >= $1'],
      ['lt', '"status" < $1'],
      ['lte', '"status" <= $1'],
    ] as const)('renders %s as a parameterized comparison', (op, fragment) => {
      const { sql, params } = buildListRows({
        ...base,
        filters: [{ column: 'status', op, value: 'paid' }],
      });
      expect(sql).toContain(`WHERE ${fragment}`);
      expect(params).toEqual(['paid']);
    });

    it.each([
      ['isnull', '"status" IS NULL'],
      ['notnull', '"status" IS NOT NULL'],
    ] as const)('renders %s without a parameter', (op, fragment) => {
      const { sql, params } = buildListRows({
        ...base,
        filters: [{ column: 'status', op }],
      });
      expect(sql).toContain(`WHERE ${fragment}`);
      expect(params).toEqual([]);
    });

    it('renders contains as a parameterized ILIKE on ::text', () => {
      const { sql, params } = buildListRows({
        ...base,
        filters: [{ column: 'status', op: 'contains', value: 'pai' }],
      });
      expect(sql).toContain(`WHERE "status"::text ILIKE '%' || $1 || '%'`);
      expect(params).toEqual(['pai']);
    });

    it('escapes LIKE wildcards in contains values so they match literally', () => {
      expect(escapeLikeValue('100%_done\\now')).toBe('100\\%\\_done\\\\now');
      const { params } = buildListRows({
        ...base,
        filters: [{ column: 'status', op: 'contains', value: '50%_a\\b' }],
      });
      expect(params).toEqual(['50\\%\\_a\\\\b']);
    });

    it('ANDs multiple filters with sequential placeholders', () => {
      const filters: RowFilter[] = [
        { column: 'status', op: 'eq', value: 'paid' },
        { column: 'id', op: 'gt', value: 5 },
        { column: 'status', op: 'notnull' },
      ];
      const { sql, params } = buildListRows({ ...base, filters });
      expect(sql).toContain(
        'WHERE "status" = $1 AND "id" > $2 AND "status" IS NOT NULL',
      );
      expect(params).toEqual(['paid', 5]);
    });
  });

  describe('search', () => {
    it('ORs an ILIKE per column, reusing one escaped parameter', () => {
      const { sql, params } = buildListRows({
        table: { schema: 'public', name: 'customers' },
        columns: ['id', 'email', 'name'],
        pkColumns: ['id'],
        limit: 10,
        search: { columns: ['email', 'name'], query: 'ann_a' },
      });
      expect(sql).toContain(
        `WHERE ("email"::text ILIKE '%' || $1 || '%' OR "name"::text ILIKE '%' || $1 || '%')`,
      );
      expect(params).toEqual(['ann\\_a']);
    });

    it('emits no search clause when no columns are searchable', () => {
      const { sql } = buildListRows({
        table: { schema: 'public', name: 'metrics' },
        columns: ['id', 'value'],
        pkColumns: ['id'],
        limit: 10,
        search: { columns: [], query: 'x' },
      });
      expect(sql).not.toContain('ILIKE');
    });
  });

  describe('sort × keyset', () => {
    const base = {
      table: { schema: 'public', name: 'orders' },
      columns: ['id', 'created_at'],
      pkColumns: ['id'],
      limit: 10,
    };

    it('asc: orders by (sortCol ASC NULLS LAST, pk ASC) and resumes with >', () => {
      const { sql, params } = buildListRows({
        ...base,
        sort: { column: 'created_at', direction: 'asc' },
        cursorValues: ['2026-01-03T00:00:00.000Z', 3],
      });
      expect(sql).toContain('WHERE ("created_at", "id") > ($1, $2)');
      expect(sql).toContain(
        'ORDER BY "created_at" ASC NULLS LAST, "id" ASC LIMIT 11',
      );
      expect(params).toEqual(['2026-01-03T00:00:00.000Z', 3]);
    });

    it('desc: orders by (sortCol DESC NULLS FIRST, pk DESC) and resumes with <', () => {
      const { sql, params } = buildListRows({
        ...base,
        sort: { column: 'created_at', direction: 'desc' },
        cursorValues: ['2026-01-03T00:00:00.000Z', 3],
      });
      expect(sql).toContain('WHERE ("created_at", "id") < ($1, $2)');
      expect(sql).toContain(
        'ORDER BY "created_at" DESC NULLS FIRST, "id" DESC LIMIT 11',
      );
      expect(params).toEqual(['2026-01-03T00:00:00.000Z', 3]);
    });

    it('composite PK: the keyset tuple is (sortCol, ...pk)', () => {
      const { sql } = buildListRows({
        table: { schema: 'public', name: 'order_items' },
        columns: ['order_id', 'product_id', 'quantity'],
        pkColumns: ['order_id', 'product_id'],
        limit: 5,
        sort: { column: 'quantity', direction: 'desc' },
        cursorValues: [4, 7, 3],
      });
      expect(sql).toContain(
        'WHERE ("quantity", "order_id", "product_id") < ($1, $2, $3)',
      );
      expect(sql).toContain(
        'ORDER BY "quantity" DESC NULLS FIRST, "order_id" DESC, "product_id" DESC',
      );
    });

    it('sorts a PK-less table (first page only — no keyset tuple)', () => {
      const { sql, params } = buildListRows({
        table: { schema: 'public', name: 'logs' },
        columns: ['message'],
        pkColumns: [],
        limit: 5,
        sort: { column: 'message', direction: 'asc' },
      });
      expect(sql).toBe(
        `SELECT "message" FROM "public"."logs" ORDER BY "message" ASC NULLS LAST LIMIT 6`,
      );
      expect(params).toEqual([]);
    });

    it('numbers cursor placeholders after filter and search parameters', () => {
      const { sql, params } = buildListRows({
        ...base,
        filters: [{ column: 'id', op: 'gte', value: 1 }],
        search: { columns: ['created_at'], query: 'x' },
        sort: { column: 'created_at', direction: 'desc' },
        cursorValues: ['2026-01-03T00:00:00.000Z', 3],
      });
      expect(sql).toContain(
        `WHERE "id" >= $1 AND ("created_at"::text ILIKE '%' || $2 || '%') AND ("created_at", "id") < ($3, $4)`,
      );
      expect(params).toEqual([1, 'x', '2026-01-03T00:00:00.000Z', 3]);
    });
  });

  describe('buildUpdateRow', () => {
    it('sets snapshot columns, filters on the full PK, and RETURNs the row', () => {
      const { sql, params } = buildUpdateRow({
        table: { schema: 'public', name: 'customers' },
        columns: ['id', 'email', 'name'],
        pkColumns: ['id'],
        pkValues: [9],
        set: [{ column: 'email', value: 'new@example.test' }],
      });
      expect(sql).toBe(
        'UPDATE "public"."customers" SET "email" = $1 WHERE "id" = $2 ' +
          'RETURNING "id", "email", "name"',
      );
      // SET values are parameterized first, then the PK values.
      expect(params).toEqual(['new@example.test', 9]);
    });

    it('numbers every SET value before the composite-PK conditions', () => {
      const { sql, params } = buildUpdateRow({
        table: { schema: 'public', name: 'order_items' },
        columns: ['order_id', 'product_id', 'quantity'],
        pkColumns: ['order_id', 'product_id'],
        pkValues: [7, 3],
        set: [
          { column: 'quantity', value: 5 },
          { column: 'product_id', value: 3 },
        ],
      });
      expect(sql).toContain('SET "quantity" = $1, "product_id" = $2');
      expect(sql).toContain('WHERE "order_id" = $3 AND "product_id" = $4');
      expect(params).toEqual([5, 3, 7, 3]);
    });

    it('quotes hostile identifiers so they cannot break out of the statement', () => {
      const { sql } = buildUpdateRow({
        table: { schema: 'public', name: 'we"ird' },
        columns: ['id'],
        pkColumns: ['id'],
        pkValues: [1],
        set: [{ column: 'a"b', value: 'x' }],
      });
      expect(sql).toContain('UPDATE "public"."we""ird" SET "a""b" = $1');
    });
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
