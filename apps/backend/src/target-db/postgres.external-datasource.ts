import { Injectable } from '@nestjs/common';
import { SingleRowWriteError } from './errors';
import type { TargetConnection } from './target-connection.factory';
import type {
  ExternalDatasource,
  IntrospectedSchema,
  IntrospectedTable,
  ReadResult,
  WriteResult,
} from './external-datasource.d.ts';

/** Raw shape of one row of the column catalog query below. */
type ColumnRow = {
  table_schema: string;
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: 'YES' | 'NO';
  is_primary_key: boolean;
  fk_table: string | null;
  fk_column: string | null;
  // Native-enum labels for the column's type, or NULL when it is not an enum
  // (array_agg over the empty set is NULL, never an empty array).
  enum_values: string[] | null;
};

/**
 * One catalog query for the whole schema: columns joined with primary-key
 * membership and foreign keys. System schemas excluded. Multi-column FKs
 * surface as one reference per column, which is the level of detail the
 * explorer's relation navigation needs.
 *
 * Constraints are read from `pg_catalog`, NOT from `information_schema`:
 * the constraint views there are privilege-filtered, and we always connect
 * as the READ_ONLY role (SELECT and nothing else). Under that role
 * `information_schema.table_constraints` returns zero rows, so every table
 * would look primary-key-less — and a table without a PK has no addressable
 * records (no record page, first page only). `constraint_column_usage` is
 * stricter still: it needs a privilege *other than* SELECT on the referenced
 * table, so no foreign key was ever discoverable and the whole relation graph
 * (FK links, "Linked records" panels) stayed empty. `pg_catalog` is readable
 * by any role, so the snapshot matches the database whatever we connect as.
 */
const INTROSPECT_SQL = `
  SELECT
    c.table_schema,
    c.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    COALESCE(pk.is_primary_key, false) AS is_primary_key,
    fk.foreign_table_name AS fk_table,
    fk.foreign_column_name AS fk_column,
    en.enum_values AS enum_values
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
   AND t.table_type = 'BASE TABLE'
  LEFT JOIN (
    -- Every column of a PRIMARY KEY constraint, composite keys included
    -- (conkey holds one attnum per key column).
    SELECT nsp.nspname AS table_schema,
           rel.relname AS table_name,
           att.attname AS column_name,
           true AS is_primary_key
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
    JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_catalog.pg_attribute att
      ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
    WHERE con.contype = 'p'
  ) pk ON pk.table_schema = c.table_schema
      AND pk.table_name = c.table_name
      AND pk.column_name = c.column_name
  LEFT JOIN (
    -- One row per referencing column. conkey and confkey are positionally
    -- aligned, so unnesting them together pairs each column with the column
    -- it actually points at — a composite FK (a, b) -> (x, y) yields a->x
    -- and b->y, never the cross product. DISTINCT ON keeps the reference
    -- single-valued when two constraints cover the same column.
    SELECT DISTINCT ON (nsp.nspname, rel.relname, att.attname)
           nsp.nspname AS table_schema,
           rel.relname AS table_name,
           att.attname AS column_name,
           frel.relname AS foreign_table_name,
           fatt.attname AS foreign_column_name
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
    JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_catalog.pg_class frel ON frel.oid = con.confrelid
    JOIN LATERAL unnest(con.conkey, con.confkey) AS pair(attnum, fattnum)
      ON true
    JOIN pg_catalog.pg_attribute att
      ON att.attrelid = con.conrelid AND att.attnum = pair.attnum
    JOIN pg_catalog.pg_attribute fatt
      ON fatt.attrelid = con.confrelid AND fatt.attnum = pair.fattnum
    WHERE con.contype = 'f'
    ORDER BY nsp.nspname, rel.relname, att.attname, con.conname
  ) fk ON fk.table_schema = c.table_schema
      AND fk.table_name = c.table_name
      AND fk.column_name = c.column_name
  LEFT JOIN LATERAL (
    -- Native-enum labels for the column's type, in the enum's declared order.
    -- information_schema.columns exposes the underlying type as udt_schema/
    -- udt_name; pg_type + pg_enum turn that into the label set. Read from
    -- pg_catalog for the same reason as the constraints above: it is readable
    -- by the READ_ONLY role, so the enum choices match whatever role connects.
    -- The aggregate always yields one row (NULL when the type has no labels),
    -- so this never multiplies the column rows.
    SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) AS enum_values
    FROM pg_catalog.pg_type typ
    JOIN pg_catalog.pg_namespace tns ON tns.oid = typ.typnamespace
    JOIN pg_catalog.pg_enum e ON e.enumtypid = typ.oid
    WHERE typ.typname = c.udt_name
      AND tns.nspname = c.udt_schema
  ) en ON true
  WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
  ORDER BY c.table_schema, c.table_name, c.ordinal_position
`;

@Injectable()
export class PostgresExternalDatasource implements ExternalDatasource {
  async introspect(connection: TargetConnection): Promise<IntrospectedSchema> {
    const result = await connection.query(INTROSPECT_SQL);
    const tables = new Map<string, IntrospectedTable>();
    for (const raw of result.rows as ColumnRow[]) {
      const key = `${raw.table_schema}.${raw.table_name}`;
      let table = tables.get(key);
      if (!table) {
        table = { schema: raw.table_schema, name: raw.table_name, columns: [] };
        tables.set(key, table);
      }
      table.columns.push({
        name: raw.column_name,
        dataType: raw.data_type,
        isNullable: raw.is_nullable === 'YES',
        isPrimaryKey: raw.is_primary_key,
        references:
          raw.fk_table && raw.fk_column
            ? { table: raw.fk_table, column: raw.fk_column }
            : null,
        enumValues: raw.enum_values ?? [],
      });
    }
    return { tables: [...tables.values()] };
  }

  async executeRead(
    connection: TargetConnection,
    sql: string,
    params: unknown[],
  ): Promise<ReadResult> {
    const result = await connection.query(sql, params);
    return { rows: result.rows, rowCount: result.rows.length };
  }

  /**
   * A single-record write, wrapped in a transaction so the single-row invariant
   * is enforced atomically: the statement must carry a full-PK predicate and a
   * `RETURNING`, so `rows.length` is the affected count. Zero rows commit as a
   * no-op (the record simply did not exist); more than one can only come from a
   * builder bug, so we roll back and refuse rather than let it persist.
   */
  async executeWrite(
    connection: TargetConnection,
    sql: string,
    params: unknown[],
  ): Promise<WriteResult> {
    await connection.query('BEGIN');
    try {
      const result = await connection.query(sql, params);
      if (result.rows.length > 1) {
        throw new SingleRowWriteError(result.rows.length);
      }
      await connection.query('COMMIT');
      return { rows: result.rows, rowCount: result.rows.length };
    } catch (error) {
      await connection.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }
}
