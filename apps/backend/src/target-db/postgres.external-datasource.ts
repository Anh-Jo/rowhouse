import { Injectable } from '@nestjs/common';
import type { TargetConnection } from './target-connection.factory';
import type {
  ExternalDatasource,
  IntrospectedSchema,
  IntrospectedTable,
  ReadResult,
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
};

/**
 * One catalog query for the whole schema: columns joined with primary-key
 * membership and single-column foreign keys. System schemas excluded.
 * Multi-column FKs surface as one reference per column, which is the level
 * of detail the explorer's relation navigation needs.
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
    fk.foreign_column_name AS fk_column
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
   AND t.table_type = 'BASE TABLE'
  LEFT JOIN (
    SELECT kcu.table_schema, kcu.table_name, kcu.column_name,
           true AS is_primary_key
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
     AND kcu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
  ) pk ON pk.table_schema = c.table_schema
      AND pk.table_name = c.table_name
      AND pk.column_name = c.column_name
  LEFT JOIN (
    SELECT kcu.table_schema, kcu.table_name, kcu.column_name,
           ccu.table_name AS foreign_table_name,
           ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
     AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
  ) fk ON fk.table_schema = c.table_schema
      AND fk.table_name = c.table_name
      AND fk.column_name = c.column_name
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
}
