import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { QueryEngine } from '@/target-db/query-engine.service';
import type { IntrospectedSchema } from '@/target-db/external-datasource.d.ts';
import type { SchemaColumn, SchemaTable } from '../../generated/prisma/client';

export type TableWithColumns = SchemaTable & { columns: SchemaColumn[] };

@Injectable()
export class IntrospectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: QueryEngine,
  ) {}

  /**
   * All lookups resolve the datasource through project + workspace in one
   * query — a foreign datasource id behaves exactly like a missing one.
   */
  private async assertDatasourceInScope(
    workspaceId: string,
    projectId: string,
    datasourceId: string,
  ): Promise<void> {
    const datasource = await this.prisma.client.datasource.findFirst({
      where: {
        id: datasourceId,
        projectId,
        project: { workspaceId },
      },
      select: { id: true },
    });
    if (!datasource) {
      throw new NotFoundException('Datasource not found');
    }
  }

  /**
   * Introspects the live database (through the governed engine, so the run
   * itself is journaled) and reconciles the snapshot:
   * - new tables/columns are created;
   * - still-present ones get their structure refreshed but KEEP their
   *   team-authored metadata (description, isPii) — the module's contract;
   * - disappeared ones are deleted.
   * Idempotent: re-running against an unchanged database changes nothing.
   */
  async sync(
    workspaceId: string,
    projectId: string,
    datasourceId: string,
    actorId: string,
  ): Promise<{
    tablesCreated: number;
    tablesRemoved: number;
    tablesKept: number;
  }> {
    await this.assertDatasourceInScope(workspaceId, projectId, datasourceId);
    const introspected = await this.engine.introspect({
      workspaceId,
      actorId,
      datasourceId,
    });
    return this.reconcile(datasourceId, introspected);
  }

  private async reconcile(
    datasourceId: string,
    introspected: IntrospectedSchema,
  ): Promise<{
    tablesCreated: number;
    tablesRemoved: number;
    tablesKept: number;
  }> {
    const existing = await this.prisma.client.schemaTable.findMany({
      where: { datasourceId },
      include: { columns: true },
    });
    const existingByKey = new Map(
      existing.map((table) => [`${table.schema}.${table.name}`, table]),
    );
    const introspectedKeys = new Set(
      introspected.tables.map((table) => `${table.schema}.${table.name}`),
    );

    let tablesCreated = 0;
    let tablesKept = 0;

    await this.prisma.client.$transaction(async (tx) => {
      // Disappeared tables go away, columns cascade.
      const removedIds = existing
        .filter(
          (table) => !introspectedKeys.has(`${table.schema}.${table.name}`),
        )
        .map((table) => table.id);
      if (removedIds.length > 0) {
        await tx.schemaTable.deleteMany({ where: { id: { in: removedIds } } });
      }

      for (const table of introspected.tables) {
        const key = `${table.schema}.${table.name}`;
        const current = existingByKey.get(key);
        if (!current) {
          tablesCreated += 1;
          await tx.schemaTable.create({
            data: {
              datasourceId,
              schema: table.schema,
              name: table.name,
              columns: {
                create: table.columns.map((column, position) => ({
                  name: column.name,
                  dataType: column.dataType,
                  isNullable: column.isNullable,
                  isPrimaryKey: column.isPrimaryKey,
                  refTable: column.references?.table ?? null,
                  refColumn: column.references?.column ?? null,
                  enumValues: column.enumValues,
                  position,
                })),
              },
            },
          });
          continue;
        }

        tablesKept += 1;
        const currentColumns = new Map(
          current.columns.map((column) => [column.name, column]),
        );
        const introspectedNames = new Set(
          table.columns.map((column) => column.name),
        );

        const removedColumnIds = current.columns
          .filter((column) => !introspectedNames.has(column.name))
          .map((column) => column.id);
        if (removedColumnIds.length > 0) {
          await tx.schemaColumn.deleteMany({
            where: { id: { in: removedColumnIds } },
          });
        }

        for (const [position, column] of table.columns.entries()) {
          const structure = {
            dataType: column.dataType,
            isNullable: column.isNullable,
            isPrimaryKey: column.isPrimaryKey,
            refTable: column.references?.table ?? null,
            refColumn: column.references?.column ?? null,
            // DB-derived like dataType — refreshed on every sync, not preserved
            // like the team-authored description/isPii metadata.
            enumValues: column.enumValues,
            position,
          };
          const currentColumn = currentColumns.get(column.name);
          if (currentColumn) {
            // Structure refresh only — description/isPii untouched.
            await tx.schemaColumn.update({
              where: { id: currentColumn.id },
              data: structure,
            });
          } else {
            await tx.schemaColumn.create({
              data: { tableId: current.id, name: column.name, ...structure },
            });
          }
        }
      }
    });

    return {
      tablesCreated,
      tablesRemoved: existing.length - tablesKept,
      tablesKept,
    };
  }

  async getSchema(
    workspaceId: string,
    projectId: string,
    datasourceId: string,
  ): Promise<{ tables: TableWithColumns[]; syncedAt: Date | null }> {
    await this.assertDatasourceInScope(workspaceId, projectId, datasourceId);
    const tables = await this.prisma.client.schemaTable.findMany({
      where: { datasourceId },
      include: { columns: { orderBy: { position: 'asc' } } },
      orderBy: [{ schema: 'asc' }, { name: 'asc' }],
    });
    const syncedAt = tables.reduce<Date | null>(
      (latest, table) =>
        latest && latest > table.updatedAt ? latest : table.updatedAt,
      null,
    );
    return { tables, syncedAt };
  }

  async updateTableMetadata(
    workspaceId: string,
    projectId: string,
    tableId: string,
    data: { description: string | null },
  ): Promise<TableWithColumns> {
    const table = await this.prisma.client.schemaTable.findFirst({
      where: {
        id: tableId,
        datasource: { projectId, project: { workspaceId } },
      },
      select: { id: true },
    });
    if (!table) {
      throw new NotFoundException('Table not found');
    }
    return this.prisma.client.schemaTable.update({
      where: { id: table.id },
      data: { description: data.description },
      include: { columns: { orderBy: { position: 'asc' } } },
    });
  }

  async updateColumnMetadata(
    workspaceId: string,
    projectId: string,
    columnId: string,
    data: { description?: string | null; isPii?: boolean },
  ): Promise<SchemaColumn> {
    const column = await this.prisma.client.schemaColumn.findFirst({
      where: {
        id: columnId,
        table: { datasource: { projectId, project: { workspaceId } } },
      },
      select: { id: true },
    });
    if (!column) {
      throw new NotFoundException('Column not found');
    }
    return this.prisma.client.schemaColumn.update({
      where: { id: column.id },
      data: {
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.isPii !== undefined ? { isPii: data.isPii } : {}),
      },
    });
  }
}
