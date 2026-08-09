import { Injectable } from '@nestjs/common';
import {
  buildCountReferencing,
  buildGetRow,
  buildListReferencing,
  buildListRows,
  buildUpdateRow,
  decodeRowKey,
  encodeRowKey,
  type RowFilter,
  type RowSearch,
  type RowSort,
  type TableRef,
} from './postgres-sql.builders';
import { QueryEngine, type ExecutionContext } from './query-engine.service';

/** What feature modules know about a table: snapshot identifiers only. */
export type TableShape = TableRef & {
  columns: string[];
  pkColumns: string[];
};

export type RowPage = {
  rows: Record<string, unknown>[];
  nextCursor: string | null;
};

/**
 * Engine-neutral, governed row reading for feature modules. Composes the
 * (Postgres, for now — decision D1) SQL builders with the QueryEngine, so
 * every page served is a READ_ONLY, audited execution and no engine SQL
 * ever leaks into `src/modules/**`.
 */
@Injectable()
export class RowReader {
  constructor(private readonly engine: QueryEngine) {}

  /** Dates and buffers JSON-safely; everything else passes through. */
  private static serializeRow(
    this: void,
    row: unknown,
  ): Record<string, unknown> {
    const record = row as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (value instanceof Date) {
        out[key] = value.toISOString();
      } else if (value instanceof Uint8Array) {
        out[key] = `\\x${Buffer.from(value).toString('hex')}`;
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  async listRows(
    context: ExecutionContext,
    table: TableShape,
    query: {
      cursor?: string;
      limit: number;
      filters?: RowFilter[];
      search?: RowSearch;
      sort?: RowSort;
    },
  ): Promise<RowPage> {
    // With a custom sort the cursor carries the sort value in front of the
    // PK values, so its arity (and the keyset tuple) grows by one.
    const cursorColumns =
      query.sort !== undefined
        ? [query.sort.column, ...table.pkColumns]
        : table.pkColumns;
    const cursorValues =
      query.cursor && table.pkColumns.length > 0
        ? decodeRowKey(query.cursor, cursorColumns.length)
        : undefined;
    const statement = buildListRows({
      table,
      columns: table.columns,
      pkColumns: table.pkColumns,
      limit: query.limit,
      cursorValues,
      filters: query.filters,
      search: query.search,
      sort: query.sort,
    });
    const result = await this.engine.executeRead(
      context,
      statement.sql,
      statement.params,
    );
    const hasMore = result.rows.length > query.limit;
    const rows = (
      hasMore ? result.rows.slice(0, query.limit) : result.rows
    ).map(RowReader.serializeRow);
    const nextCursor =
      hasMore && table.pkColumns.length > 0 && rows.length > 0
        ? encodeRowKey(
            cursorColumns.map(
              (column) =>
                (result.rows[query.limit - 1] as Record<string, unknown>)[
                  column
                ],
            ),
          )
        : null;
    return { rows, nextCursor };
  }

  async getRow(
    context: ExecutionContext,
    table: TableShape,
    rowKey: string,
  ): Promise<Record<string, unknown> | null> {
    const pkValues = decodeRowKey(rowKey, table.pkColumns.length);
    const statement = buildGetRow({
      table,
      columns: table.columns,
      pkColumns: table.pkColumns,
      pkValues,
    });
    const result = await this.engine.executeRead(
      context,
      statement.sql,
      statement.params,
    );
    const row = result.rows[0];
    return row === undefined ? null : RowReader.serializeRow(row);
  }

  /**
   * Applies a single-record UPDATE addressed by row key (the encoded PK) and
   * returns the persisted row, or null when nothing matched (the record is
   * gone). The `set` entries are snapshot columns disjoint from the PK — the
   * caller validates that; here they are quoted and parameterized. One
   * governed, audited WRITE on the READ_WRITE role.
   */
  async updateRow(
    context: ExecutionContext,
    table: TableShape,
    rowKey: string,
    set: { column: string; value: unknown }[],
  ): Promise<Record<string, unknown> | null> {
    const pkValues = decodeRowKey(rowKey, table.pkColumns.length);
    const statement = buildUpdateRow({
      table,
      columns: table.columns,
      pkColumns: table.pkColumns,
      pkValues,
      set,
    });
    const result = await this.engine.executeWrite(
      context,
      statement.sql,
      statement.params,
    );
    const row = result.rows[0];
    return row === undefined ? null : RowReader.serializeRow(row);
  }

  async listReferencing(
    context: ExecutionContext,
    table: TableRef & { columns: string[] },
    viaColumn: string,
    value: unknown,
    limit: number,
  ): Promise<Record<string, unknown>[]> {
    const statement = buildListReferencing({
      table,
      columns: table.columns,
      viaColumn,
      value,
      limit,
    });
    const result = await this.engine.executeRead(
      context,
      statement.sql,
      statement.params,
    );
    return result.rows.map(RowReader.serializeRow);
  }

  async countReferencing(
    context: ExecutionContext,
    table: TableRef,
    viaColumn: string,
    value: unknown,
  ): Promise<number> {
    const statement = buildCountReferencing({ table, viaColumn, value });
    const result = await this.engine.executeRead(
      context,
      statement.sql,
      statement.params,
    );
    const first = result.rows[0] as { count?: number } | undefined;
    return first?.count ?? 0;
  }
}
