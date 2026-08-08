import { Injectable } from '@nestjs/common';
import {
  buildCountReferencing,
  buildGetRow,
  buildListReferencing,
  buildListRows,
  decodeRowKey,
  encodeRowKey,
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
    query: { cursor?: string; limit: number },
  ): Promise<RowPage> {
    const cursorValues =
      query.cursor && table.pkColumns.length > 0
        ? decodeRowKey(query.cursor, table.pkColumns.length)
        : undefined;
    const statement = buildListRows({
      table,
      columns: table.columns,
      pkColumns: table.pkColumns,
      limit: query.limit,
      cursorValues,
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
            table.pkColumns.map(
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
