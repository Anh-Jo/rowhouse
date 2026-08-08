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
}
