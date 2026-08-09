import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const SchemaColumnSchema = z.object({
  id: z.string().describe('Column id'),
  name: z.string().describe('Column name'),
  dataType: z.string().describe('Engine data type (e.g. integer, text)'),
  enumValues: z
    .array(z.string())
    .describe(
      'Allowed values when the column is a native enum; empty otherwise',
    ),
  isNullable: z.boolean().describe('Whether NULL is allowed'),
  isPrimaryKey: z.boolean().describe('Primary-key membership'),
  refTable: z
    .string()
    .nullable()
    .describe('Referenced table when the column is a foreign key'),
  refColumn: z
    .string()
    .nullable()
    .describe('Referenced column when the column is a foreign key'),
  position: z.number().int().describe('Ordinal position for stable display'),
  description: z
    .string()
    .nullable()
    .describe('Team-authored description — survives re-syncs'),
  isPii: z.boolean().describe('Marks personal data; feeds masking from P2 on'),
});

export class SchemaColumnDto extends createZodDto(SchemaColumnSchema) {}

const SchemaTableSchema = z.object({
  id: z.string().describe('Table id'),
  schema: z.string().describe('Database schema (e.g. public)'),
  name: z.string().describe('Table name'),
  description: z
    .string()
    .nullable()
    .describe('Team-authored description — survives re-syncs'),
  columns: z.array(SchemaColumnSchema).describe('Columns, in table order'),
});

export class SchemaTableDto extends createZodDto(SchemaTableSchema) {}

const DatasourceSchemaSchema = z.object({
  tables: z
    .array(SchemaTableSchema)
    .describe('Introspected tables, alphabetical'),
  syncedAt: z.iso
    .datetime()
    .nullable()
    .describe('Last successful sync, null before the first one'),
});

export class DatasourceSchemaDto extends createZodDto(DatasourceSchemaSchema) {}

const UpdateTableMetadataSchema = z.object({
  description: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .describe('Team description, null to clear'),
});

export class UpdateTableMetadataDto extends createZodDto(
  UpdateTableMetadataSchema,
) {}

const UpdateColumnMetadataSchema = z.object({
  description: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional()
    .describe('Team description, null to clear, omit to keep'),
  isPii: z.boolean().optional().describe('PII flag, omit to keep'),
});

export class UpdateColumnMetadataDto extends createZodDto(
  UpdateColumnMetadataSchema,
) {}

const SyncResultSchema = z.object({
  tablesCreated: z.number().int().describe('Tables new since the last sync'),
  tablesRemoved: z
    .number()
    .int()
    .describe('Tables that disappeared from the database'),
  tablesKept: z
    .number()
    .int()
    .describe('Tables still present (structure refreshed)'),
});

export class SyncResultDto extends createZodDto(SyncResultSchema) {}
