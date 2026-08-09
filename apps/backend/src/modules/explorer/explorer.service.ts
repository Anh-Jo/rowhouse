import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '@/prisma/prisma.service';
import { clampLimit } from '@/helpers/pagination';
import { SingleRowWriteError } from '@/target-db/errors';
import {
  FILTER_OPS,
  encodeRowKey,
  type RowFilter,
  type RowSearch,
  type RowSort,
} from '@/target-db/postgres-sql.builders';
import { RowReader, type TableShape } from '@/target-db/row-reader.service';
import type { SchemaColumn } from '../../generated/prisma/client';

/** Rows shown per incoming-relation panel before "view all" (slice B UI). */
const RELATED_ROWS_LIMIT = 10;

/** Sanity bound — a grid never sends more per-column filters than columns. */
const MAX_FILTERS = 20;

/** Shape of one entry of the `filters` query param (JSON-encoded array). */
const FilterSchema = z.object({
  column: z.string().min(1),
  op: z.enum(FILTER_OPS),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

const FiltersSchema = z.array(FilterSchema).max(MAX_FILTERS);

/**
 * Column types the server searches with `search` (ILIKE on `::text`).
 * Numeric/temporal columns are excluded on purpose: substring-matching them
 * surprises more than it helps — use a filter for those.
 */
function isSearchableType(dataType: string): boolean {
  const type = dataType.toLowerCase();
  return (
    type === 'text' ||
    type === 'citext' ||
    type === 'uuid' ||
    type.startsWith('character') || // character, character varying(…)
    type.startsWith('varchar') ||
    type.startsWith('char')
  );
}

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
    query: {
      cursor?: string;
      limit?: number;
      filters?: string;
      sort?: string;
      search?: string;
    },
  ): Promise<{ items: ExplorerRow[]; nextCursor: string | null }> {
    const table = await this.resolveTable(
      workspaceId,
      projectId,
      datasourceId,
      tableId,
    );
    const filters = this.parseFilters(query.filters, table);
    const sort = this.parseSort(query.sort, table);
    const search = this.pickSearch(query.search, table);
    let page;
    try {
      page = await this.rowReader.listRows(
        { workspaceId, actorId, datasourceId },
        table,
        {
          cursor: query.cursor,
          limit: clampLimit(query.limit),
          filters,
          search,
          sort,
        },
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
   * `filters` arrives as a JSON string. Anything off — unparseable JSON,
   * wrong shape, unknown column, unknown op, value not matching the op —
   * is a 400 with a message precise enough to fix the request.
   */
  private parseFilters(
    raw: string | undefined,
    table: TableShape,
  ): RowFilter[] | undefined {
    if (raw === undefined || raw === '') {
      return undefined;
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new BadRequestException('`filters` must be valid JSON');
    }
    const parsed = FiltersSchema.safeParse(json);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new BadRequestException(
        `\`filters\` must be an array of {column, op, value} objects (op one of ${FILTER_OPS.join(', ')}): ${issue.path.join('.')} ${issue.message}`,
      );
    }
    for (const filter of parsed.data) {
      if (!table.columns.includes(filter.column)) {
        throw new BadRequestException(
          `Unknown filter column "${filter.column}"`,
        );
      }
      if (filter.op === 'isnull' || filter.op === 'notnull') {
        if (filter.value !== undefined && filter.value !== null) {
          throw new BadRequestException(
            `Filter op "${filter.op}" takes no value`,
          );
        }
      } else if (filter.op === 'contains') {
        if (typeof filter.value !== 'string') {
          throw new BadRequestException(
            'Filter op "contains" needs a string value',
          );
        }
      } else if (filter.value === undefined || filter.value === null) {
        throw new BadRequestException(
          `Filter op "${filter.op}" needs a non-null value (use isnull/notnull for NULL checks)`,
        );
      }
    }
    return parsed.data;
  }

  /**
   * `sort` arrives as `column:direction`. The column must exist in the
   * snapshot. On a PK-less table sort still applies — such tables serve the
   * first page only, and sorting that page is fine.
   */
  private parseSort(
    raw: string | undefined,
    table: TableShape,
  ): RowSort | undefined {
    if (raw === undefined || raw === '') {
      return undefined;
    }
    const match = /^(.+):(asc|desc)$/.exec(raw);
    if (!match) {
      throw new BadRequestException(
        '`sort` must be `column:direction` with direction asc or desc',
      );
    }
    const [, column, direction] = match;
    if (!table.columns.includes(column)) {
      throw new BadRequestException(`Unknown sort column "${column}"`);
    }
    return { column, direction: direction as 'asc' | 'desc' };
  }

  /**
   * The server — not the client — picks which columns `search` scans: the
   * snapshot's text-ish ones. A table with none simply ignores the search
   * (an empty grid would read as "no data", which is wrong).
   */
  private pickSearch(
    raw: string | undefined,
    table: TableShape & { columns$: SchemaColumn[] },
  ): RowSearch | undefined {
    const query = raw?.trim();
    if (!query) {
      return undefined;
    }
    const columns = table.columns$
      .filter((column) => isSearchableType(column.dataType))
      .map((column) => column.name);
    return columns.length > 0 ? { columns, query } : undefined;
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

  /**
   * Applies a single-record UPDATE addressed by row key. The `set` columns are
   * validated against the snapshot and must exclude the primary key (editing
   * the PK is an identity change, out of scope for single-record edit). The
   * write itself runs on the READ_WRITE role through the governed engine, which
   * commits only a single-row change and audits exactly one WRITE event.
   */
  async updateRecord(
    workspaceId: string,
    projectId: string,
    datasourceId: string,
    tableId: string,
    rowKey: string,
    actorId: string,
    set: Record<string, unknown>,
  ): Promise<{ row: ExplorerRow }> {
    const table = await this.resolveTable(
      workspaceId,
      projectId,
      datasourceId,
      tableId,
    );
    if (table.pkColumns.length === 0) {
      throw new BadRequestException(
        'This table has no primary key — records cannot be edited individually',
      );
    }
    const pkColumns = new Set(table.pkColumns);
    const entries = Object.entries(set);
    for (const [column] of entries) {
      if (!table.columns.includes(column)) {
        throw new BadRequestException(`Unknown column "${column}"`);
      }
      if (pkColumns.has(column)) {
        throw new BadRequestException(
          `Primary key column "${column}" cannot be edited`,
        );
      }
    }

    const context = { workspaceId, actorId, datasourceId };
    let values: Record<string, unknown> | null;
    try {
      values = await this.rowReader.updateRow(
        context,
        table,
        rowKey,
        entries.map(([column, value]) => ({ column, value })),
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'Malformed cursor') {
        throw new BadRequestException('Malformed row key');
      }
      if (error instanceof SingleRowWriteError) {
        // The write matched more than one row — already rolled back and
        // audited as ERROR by the engine; refuse rather than pretend it applied.
        throw new ConflictException(
          'Refusing to apply a write that matched more than one row',
        );
      }
      throw error;
    }
    if (!values) {
      throw new NotFoundException('Record not found');
    }
    return { row: { key: rowKey, values } };
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
