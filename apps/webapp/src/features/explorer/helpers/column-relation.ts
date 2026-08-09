import type { SchemaColumnDto, SchemaTableDto } from '@/api/schema';

/**
 * The relation an FK column carries, already resolved against the snapshot:
 * `tableId` is null when the referenced table is not in it (another schema,
 * or a sync that has not caught up) — the relation is then shown, not linked,
 * and not editable (there is no table to pick a row from).
 */
type ColumnRelation = {
  tableId: string | null;
  tableName: string;
  columnName: string;
};

/** Resolves a column's foreign key against the snapshot, null if it has none. */
function resolveRelation(
  column: SchemaColumnDto,
  tables: SchemaTableDto[],
): ColumnRelation | null {
  if (!column.refTable || !column.refColumn) {
    return null;
  }
  return {
    tableId: tables.find((table) => table.name === column.refTable)?.id ?? null,
    tableName: column.refTable,
    columnName: column.refColumn,
  };
}

export { resolveRelation };
export type { ColumnRelation };
