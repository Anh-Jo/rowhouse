/**
 * Pure Postgres SQL builders for the explorer's row reading (decision D1:
 * engine-specific SQL lives only in the target-db layer). Every identifier
 * comes from the introspection snapshot — never from client input — and is
 * quoted anyway, so even a hostile table name cannot break out.
 */

export type TableRef = { schema: string; name: string };

/** Double-quote a Postgres identifier, escaping embedded quotes. */
export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function quoteTable(table: TableRef): string {
  return `${quoteIdent(table.schema)}.${quoteIdent(table.name)}`;
}

/** An opaque cursor is the base64url of the JSON array of PK values. */
export function encodeRowKey(values: unknown[]): string {
  return Buffer.from(JSON.stringify(values), 'utf8').toString('base64url');
}

export function decodeRowKey(cursor: string, arity: number): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Malformed cursor');
  }
  if (!Array.isArray(parsed) || parsed.length !== arity) {
    throw new Error('Malformed cursor');
  }
  return parsed;
}

export type SqlStatement = { sql: string; params: unknown[] };

/** The only comparison operators the rows endpoint will ever emit. */
export const FILTER_OPS = [
  'eq',
  'neq',
  'contains',
  'gt',
  'gte',
  'lt',
  'lte',
  'isnull',
  'notnull',
] as const;

type FilterOp = (typeof FILTER_OPS)[number];

export type RowFilter = { column: string; op: FilterOp; value?: unknown };
export type RowSort = { column: string; direction: 'asc' | 'desc' };
export type RowSearch = { columns: string[]; query: string };

/**
 * Escape LIKE/ILIKE wildcards in a user value so it matches literally.
 * Backslash is Postgres's default LIKE escape character, so no ESCAPE
 * clause is needed.
 */
export function escapeLikeValue(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

const OP_SQL: Record<
  Exclude<FilterOp, 'contains' | 'isnull' | 'notnull'>,
  string
> = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' };

/**
 * Keyset-paginated page over a table, ordered by its primary key (row-value
 * comparison handles composite PKs). Without a PK there is no stable order
 * to resume from — callers serve the first page only.
 *
 * Filters, search and sort compose on top:
 * - every filter value and the search query are parameterized; identifiers
 *   (columns, sort column) come from the introspection snapshot, validated
 *   upstream, and are quoted anyway;
 * - `contains` and search use ILIKE on `column::text` with `%`/`_`/`\`
 *   escaped in the value, so the user text always matches literally;
 * - with a custom sort, ORDER BY becomes `(sortCol dir, ...pk dir)` and the
 *   keyset comparison becomes the row-value `(sortCol, ...pk) > (...)` for
 *   asc / `< (...)` for desc — the cursor then carries the sort value in
 *   front of the PK values. `NULLS LAST` (asc) / `NULLS FIRST` (desc) keep
 *   the visual order consistent with that comparison. Simplification: a row
 *   whose sort value is NULL makes the row-value comparison NULL (filtered
 *   out), so such rows may be unreachable when resuming via cursor —
 *   acceptable for the explorer, where NULL-sorted rows sit at the end of
 *   the scan direction anyway.
 */
export function buildListRows(options: {
  table: TableRef;
  columns: string[];
  pkColumns: string[];
  limit: number;
  cursorValues?: unknown[];
  filters?: RowFilter[];
  search?: RowSearch;
  sort?: RowSort;
}): SqlStatement {
  const select = options.columns.map(quoteIdent).join(', ');
  const params: unknown[] = [];
  const conditions: string[] = [];
  const nextParam = (value: unknown): string => {
    params.push(value);
    return `$${params.length}`;
  };

  for (const filter of options.filters ?? []) {
    const ident = quoteIdent(filter.column);
    switch (filter.op) {
      case 'isnull':
        conditions.push(`${ident} IS NULL`);
        break;
      case 'notnull':
        conditions.push(`${ident} IS NOT NULL`);
        break;
      case 'contains':
        conditions.push(
          `${ident}::text ILIKE '%' || ${nextParam(escapeLikeValue(String(filter.value)))} || '%'`,
        );
        break;
      default:
        conditions.push(
          `${ident} ${OP_SQL[filter.op]} ${nextParam(filter.value)}`,
        );
    }
  }

  if (options.search && options.search.columns.length > 0) {
    // One parameter, referenced by every branch of the OR.
    const placeholder = nextParam(escapeLikeValue(options.search.query));
    const branches = options.search.columns.map(
      (column) =>
        `${quoteIdent(column)}::text ILIKE '%' || ${placeholder} || '%'`,
    );
    conditions.push(`(${branches.join(' OR ')})`);
  }

  // The keyset comparison tuple: (sortCol, ...pk) when sorted, plain pk
  // otherwise. Directions apply to every member so the single row-value
  // operator (`>` asc / `<` desc) matches the ORDER BY exactly.
  const direction = options.sort?.direction ?? 'asc';
  const keysetColumns = options.sort
    ? [options.sort.column, ...options.pkColumns]
    : options.pkColumns;
  if (options.cursorValues && options.pkColumns.length > 0) {
    const left = `(${keysetColumns.map(quoteIdent).join(', ')})`;
    const placeholders = options.cursorValues.map(nextParam);
    const comparator = direction === 'asc' ? '>' : '<';
    conditions.push(`${left} ${comparator} (${placeholders.join(', ')})`);
  }

  const where =
    conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

  let orderBy = '';
  if (options.sort) {
    const dir = direction.toUpperCase();
    const nulls = direction === 'asc' ? 'NULLS LAST' : 'NULLS FIRST';
    const terms = [
      `${quoteIdent(options.sort.column)} ${dir} ${nulls}`,
      ...options.pkColumns.map((column) => `${quoteIdent(column)} ${dir}`),
    ];
    orderBy = ` ORDER BY ${terms.join(', ')}`;
  } else if (options.pkColumns.length > 0) {
    orderBy = ` ORDER BY ${options.pkColumns.map(quoteIdent).join(', ')}`;
  }

  // Over-fetch by one so the caller knows whether a next page exists.
  const sql = `SELECT ${select} FROM ${quoteTable(options.table)}${where}${orderBy} LIMIT ${options.limit + 1}`;
  return { sql, params };
}

/** Single row by primary key (composite supported). */
export function buildGetRow(options: {
  table: TableRef;
  columns: string[];
  pkColumns: string[];
  pkValues: unknown[];
}): SqlStatement {
  const select = options.columns.map(quoteIdent).join(', ');
  const where = options.pkColumns
    .map((column, index) => `${quoteIdent(column)} = $${index + 1}`)
    .join(' AND ');
  return {
    sql: `SELECT ${select} FROM ${quoteTable(options.table)} WHERE ${where} LIMIT 1`,
    params: options.pkValues,
  };
}

/** Rows of `table` whose `viaColumn` points at a given value (incoming FK). */
export function buildListReferencing(options: {
  table: TableRef;
  columns: string[];
  viaColumn: string;
  value: unknown;
  limit: number;
}): SqlStatement {
  const select = options.columns.map(quoteIdent).join(', ');
  return {
    sql: `SELECT ${select} FROM ${quoteTable(options.table)} WHERE ${quoteIdent(options.viaColumn)} = $1 LIMIT ${options.limit}`,
    params: [options.value],
  };
}

/** Count of rows referencing a value (incoming FK panel header). */
export function buildCountReferencing(options: {
  table: TableRef;
  viaColumn: string;
  value: unknown;
}): SqlStatement {
  return {
    sql: `SELECT count(*)::int AS count FROM ${quoteTable(options.table)} WHERE ${quoteIdent(options.viaColumn)} = $1`,
    params: [options.value],
  };
}
