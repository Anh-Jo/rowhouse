import type { TargetConnection } from './target-connection.factory';

/**
 * Engine-neutral contracts for reading a customer database (transverse
 * decision D1: no engine-specific SQL leaks past implementations of this
 * interface — adding MySQL later means one new class, zero call-site change).
 */

export type IntrospectedColumn = {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  /** Present when the column is a foreign key to another table. */
  references: { table: string; column: string } | null;
};

export type IntrospectedTable = {
  schema: string;
  name: string;
  columns: IntrospectedColumn[];
};

export type IntrospectedSchema = {
  tables: IntrospectedTable[];
};

export type ReadResult = {
  rows: unknown[];
  rowCount: number;
};

/**
 * One database engine's read surface. Implementations receive an open
 * connection — governance (credential unsealing, role selection, auditing,
 * connection lifecycle) lives in the QueryEngine, never here.
 */
export interface ExternalDatasource {
  introspect(connection: TargetConnection): Promise<IntrospectedSchema>;
  executeRead(
    connection: TargetConnection,
    sql: string,
    params: unknown[],
  ): Promise<ReadResult>;
}
