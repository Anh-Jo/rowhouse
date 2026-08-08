import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const ListRowsQuerySchema = z.object({
  cursor: z.string().optional().describe('Opaque cursor from a previous page'),
  limit: z.coerce
    .number()
    .int()
    .optional()
    .describe('Page size (clamped server-side)'),
  filters: z
    .string()
    .optional()
    .describe(
      'JSON array of {column, op, value} — op in eq|neq|contains|gt|gte|lt|lte|isnull|notnull; columns validated against the snapshot',
    ),
  sort: z
    .string()
    .optional()
    .describe('`column:direction` — snapshot-validated column, asc|desc'),
  search: z
    .string()
    .optional()
    .describe(
      'Substring searched (ILIKE) across the table’s text-ish columns — the server picks which',
    ),
});

export class ListRowsQueryDto extends createZodDto(ListRowsQuerySchema) {}

const RowSchema = z.object({
  key: z
    .string()
    .nullable()
    .describe(
      'Opaque row key (encodes the primary key) — null when the table has no PK; feeds the record-detail route',
    ),
  values: z
    .record(z.string(), z.unknown())
    .describe('Column name → JSON-safe value'),
});

const RowPageSchema = z.object({
  items: z
    .array(RowSchema)
    .describe('Rows in primary-key order (or the requested sort order)'),
  nextCursor: z
    .string()
    .nullable()
    .describe(
      'Cursor for the next page — null on the last page or when the table has no PK (first page only)',
    ),
});

export class RowPageDto extends createZodDto(RowPageSchema) {}

const RecordRefSchema = z.object({
  column: z.string().describe('FK column on this record'),
  tableId: z
    .string()
    .nullable()
    .describe('Snapshot id of the referenced table (null if not synced)'),
  tableName: z.string().describe('Referenced table name'),
  row: RowSchema.nullable().describe(
    'The referenced row, resolved — null when the FK value is null or the row is gone',
  ),
});

const ReferencedBySchema = z.object({
  tableId: z.string().describe('Snapshot id of the referencing table'),
  tableName: z.string().describe('Referencing table name'),
  viaColumn: z.string().describe('Column on that table pointing here'),
  count: z.number().int().describe('Total referencing rows'),
  rows: z.array(RowSchema).describe('First referencing rows (capped)'),
});

const RecordDetailSchema = z.object({
  row: RowSchema.describe('The record itself'),
  references: z
    .array(RecordRefSchema)
    .describe('Outgoing relations: what this record points at'),
  referencedBy: z
    .array(ReferencedBySchema)
    .describe('Incoming relations: what points at this record'),
});

export class RecordDetailDto extends createZodDto(RecordDetailSchema) {}
