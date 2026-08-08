import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const ListRowsQuerySchema = z.object({
  cursor: z.string().optional().describe('Opaque cursor from a previous page'),
  limit: z.coerce
    .number()
    .int()
    .optional()
    .describe('Page size (clamped server-side)'),
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
  items: z.array(RowSchema).describe('Rows in primary-key order'),
  nextCursor: z
    .string()
    .nullable()
    .describe(
      'Cursor for the next page — null on the last page or when the table has no PK (first page only)',
    ),
});

export class RowPageDto extends createZodDto(RowPageSchema) {}
