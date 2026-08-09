import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const AuditEventSchema = z.object({
  id: z.string().describe('Audit event id'),
  actorId: z.string().describe('User who triggered the execution'),
  datasourceId: z
    .string()
    .nullable()
    .describe('Target datasource, when the action involved one'),
  role: z
    .enum(['READ_ONLY', 'READ_WRITE'])
    .nullable()
    .describe('Connection role the execution used'),
  action: z
    .enum(['CONNECTION_TEST', 'INTROSPECT', 'READ', 'WRITE'])
    .describe('What kind of execution was journaled'),
  statement: z
    .string()
    .nullable()
    .describe('The SQL that ran (our generated statements, never row data)'),
  rowCount: z.number().int().nullable().describe('Rows returned, when known'),
  durationMs: z.number().int().describe('Execution duration in milliseconds'),
  status: z.enum(['OK', 'ERROR']).describe('Outcome'),
  errorMessage: z.string().nullable().describe('Error detail on failure'),
  approvedBy: z
    .string()
    .nullable()
    .describe('Approver of a sensitive action (used from P2)'),
  createdAt: z.iso.datetime().describe('When the execution happened'),
});

export class AuditEventDto extends createZodDto(AuditEventSchema) {}

const ListAuditEventsQuerySchema = z.object({
  cursor: z.string().optional().describe('Opaque cursor from a previous page'),
  limit: z.coerce
    .number()
    .int()
    .optional()
    .describe('Page size (clamped server-side)'),
});

export class ListAuditEventsQueryDto extends createZodDto(
  ListAuditEventsQuerySchema,
) {}

const AuditEventPageSchema = z.object({
  items: z.array(AuditEventSchema).describe('Audit events, newest first'),
  nextCursor: z
    .string()
    .nullable()
    .describe('Cursor for the next page, null on the last page'),
});

export class AuditEventPageDto extends createZodDto(AuditEventPageSchema) {}
