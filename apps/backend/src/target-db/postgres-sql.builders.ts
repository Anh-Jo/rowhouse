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

/**
 * Keyset-paginated page over a table, ordered by its primary key (row-value
 * comparison handles composite PKs). Without a PK there is no stable order
 * to resume from — callers serve the first page only.
 */
export function buildListRows(options: {
  table: TableRef;
  columns: string[];
  pkColumns: string[];
  limit: number;
  cursorValues?: unknown[];
}): SqlStatement {
  const select = options.columns.map(quoteIdent).join(', ');
  const params: unknown[] = [];
  let where = '';
  if (options.cursorValues && options.pkColumns.length > 0) {
    const left = `(${options.pkColumns.map(quoteIdent).join(', ')})`;
    const placeholders = options.cursorValues.map(
      (_value, index) => `$${index + 1}`,
    );
    where = ` WHERE ${left} > (${placeholders.join(', ')})`;
    params.push(...options.cursorValues);
  }
  const orderBy =
    options.pkColumns.length > 0
      ? ` ORDER BY ${options.pkColumns.map(quoteIdent).join(', ')}`
      : '';
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
