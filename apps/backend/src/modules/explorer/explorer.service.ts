import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { clampLimit } from '@/helpers/pagination';
import { encodeRowKey } from '@/target-db/postgres-sql.builders';
import { RowReader, type TableShape } from '@/target-db/row-reader.service';
import type { SchemaColumn } from '../../generated/prisma/client';

/** Rows shown per incoming-relation panel before "view all" (slice B UI). */
const RELATED_ROWS_LIMIT = 10;

export type ExplorerRow = {
  key: string | null;
  values: Record<string, unknown>;
};

@Injectable()
export class ExplorerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowReader: RowReader,
  ) {}

  /**
   * Resolves a snapshot table through datasource → project → workspace in
   * one query (foreign ids 404 like missing ones) and derives the shape the
   * row reader needs. Everything downstream uses snapshot identifiers only.
   */
  async resolveTable(
    workspaceId: string,
    projectId: string,
    datasourceId: string,
    tableId: string,
  ): Promise<TableShape & { datasourceId: string; columns$: SchemaColumn[] }> {
    const table = await this.prisma.client.schemaTable.findFirst({
      where: {
        id: tableId,
        datasourceId,
        datasource: { projectId, project: { workspaceId } },
      },
      include: { columns: { orderBy: { position: 'asc' } } },
    });
    if (!table) {
      throw new NotFoundException('Table not found');
    }
    return {
      schema: table.schema,
      name: table.name,
      datasourceId: table.datasourceId,
      columns: table.columns.map((column) => column.name),
      pkColumns: table.columns
        .filter((column) => column.isPrimaryKey)
        .map((column) => column.name),
      columns$: table.columns,
    };
  }

  async listRows(
    workspaceId: string,
    projectId: string,
    datasourceId: string,
    tableId: string,
    actorId: string,
    query: { cursor?: string; limit?: number },
  ): Promise<{ items: ExplorerRow[]; nextCursor: string | null }> {
    const table = await this.resolveTable(
      workspaceId,
      projectId,
      datasourceId,
      tableId,
    );
    let page;
    try {
      page = await this.rowReader.listRows(
        { workspaceId, actorId, datasourceId },
        table,
        { cursor: query.cursor, limit: clampLimit(query.limit) },
      );
    } catch (error) {
      // A garbled cursor is a client mistake, not a server failure.
      if (error instanceof Error && error.message === 'Malformed cursor') {
        throw new BadRequestException('Malformed cursor');
      }
      throw error;
    }
    return {
      items: page.rows.map((values) => ({
        key:
          table.pkColumns.length > 0
            ? encodeRowKey(table.pkColumns.map((column) => values[column]))
            : null,
        values,
      })),
      nextCursor: page.nextCursor,
    };
  }

  /**
   * The record plus everything it connects to. Outgoing FKs resolve the
   * referenced row (via the referenced column, which need not be the PK);
   * incoming FKs list each snapshot table pointing at this one with a count
   * and a first page. Every lookup is a governed, audited READ.
   */
  async getRecord(
    workspaceId: string,
    projectId: string,
    datasourceId: string,
    tableId: string,
    rowKey: string,
    actorId: string,
  ) {
    const table = await this.resolveTable(
      workspaceId,
      projectId,
      datasourceId,
      tableId,
    );
    if (table.pkColumns.length === 0) {
      throw new BadRequestException(
        'This table has no primary key — records cannot be addressed individually',
      );
    }
    const context = { workspaceId, actorId, datasourceId };
    let values: Record<string, unknown> | null;
    try {
      values = await this.rowReader.getRow(context, table, rowKey);
    } catch (error) {
      if (error instanceof Error && error.message === 'Malformed cursor') {
        throw new BadRequestException('Malformed row key');
      }
      throw error;
    }
    if (!values) {
      throw new NotFoundException('Record not found');
    }

    // Outgoing: one resolved row per FK column carrying a value.
    const fkColumns = table.columns$.filter(
      (column) => column.refTable && column.refColumn,
    );
    const references = await Promise.all(
      fkColumns.map(async (column) => {
        const value = values[column.name];
        const referenced = await this.prisma.client.schemaTable.findFirst({
          where: { datasourceId, name: column.refTable as string },
          include: { columns: { orderBy: { position: 'asc' } } },
        });
        if (value === null || value === undefined || !referenced) {
          return {
            column: column.name,
            tableId: referenced?.id ?? null,
            tableName: column.refTable as string,
            row: null,
          };
        }
        const rows = await this.rowReader.listReferencing(
          context,
          {
            schema: referenced.schema,
            name: referenced.name,
            columns: referenced.columns.map((c) => c.name),
          },
          column.refColumn as string,
          value,
          1,
        );
        return {
          column: column.name,
          tableId: referenced.id,
          tableName: referenced.name,
          row: rows[0]
            ? this.toKeyedRow(
                rows[0],
                referenced.columns.filter((c) => c.isPrimaryKey),
              )
            : null,
        };
      }),
    );

    // Incoming: every snapshot column elsewhere pointing at this table.
    const incomingColumns = await this.prisma.client.schemaColumn.findMany({
      where: {
        refTable: table.name,
        table: { datasourceId, NOT: { id: tableId } },
      },
      include: {
        table: { include: { columns: { orderBy: { position: 'asc' } } } },
      },
    });
    const referencedBy = await Promise.all(
      incomingColumns.map(async (incoming) => {
        const value = values[incoming.refColumn as string];
        const shape = {
          schema: incoming.table.schema,
          name: incoming.table.name,
          columns: incoming.table.columns.map((c) => c.name),
        };
        const [count, rows] = await Promise.all([
          this.rowReader.countReferencing(context, shape, incoming.name, value),
          this.rowReader.listReferencing(
            context,
            shape,
            incoming.name,
            value,
            RELATED_ROWS_LIMIT,
          ),
        ]);
        return {
          tableId: incoming.table.id,
          tableName: incoming.table.name,
          viaColumn: incoming.name,
          count,
          rows: rows.map((row) =>
            this.toKeyedRow(
              row,
              incoming.table.columns.filter((c) => c.isPrimaryKey),
            ),
          ),
        };
      }),
    );

    return {
      row: {
        key: rowKey,
        values,
      },
      references,
      referencedBy,
    };
  }

  private toKeyedRow(
    values: Record<string, unknown>,
    pkColumns: SchemaColumn[],
  ): ExplorerRow {
    return {
      key:
        pkColumns.length > 0
          ? encodeRowKey(pkColumns.map((column) => values[column.name]))
          : null,
      values,
    };
  }
}
