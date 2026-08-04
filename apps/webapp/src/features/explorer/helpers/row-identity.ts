import type { SchemaTableDto } from '@/api/schema';

/** Columns that tend to carry a human name for the row. */
const NAMING_COLUMN = /(^|_)(name|title|email|label|slug|username)($|_)/i;

function formatIdentityValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Compact identity of a record from its primary key: `id 42`, composite keys
 * joined with a middle dot (`order_id 7 · sku ABC`). Empty when the table has
 * no PK (its rows cannot be addressed anyway).
 */
function describePkIdentity(
  table: SchemaTableDto,
  values: Record<string, unknown>,
): string {
  return [...table.columns]
    .sort((a, b) => a.position - b.position)
    .filter((column) => column.isPrimaryKey)
    .map((column) => `${column.name} ${formatIdentityValue(values[column.name])}`)
    .join(' · ');
}

/**
 * Human identity of a row for links and subtitles: the first "naming" column
 * (name, title, email…) carrying a non-empty string, falling back to the PK
 * identity — `ada@example.test` beats `id 42` when available.
 */
function describeRowIdentity(
  table: SchemaTableDto,
  values: Record<string, unknown>,
): string {
  const ordered = [...table.columns].sort((a, b) => a.position - b.position);
  for (const column of ordered) {
    const value = values[column.name];
    if (
      !column.isPrimaryKey &&
      NAMING_COLUMN.test(column.name) &&
      typeof value === 'string' &&
      value.length > 0
    ) {
      return value;
    }
  }
  return describePkIdentity(table, values);
}

export { describePkIdentity, describeRowIdentity };
