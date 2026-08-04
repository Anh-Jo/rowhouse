import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DatasourceNameSchema = z
  .string()
  .trim()
  .min(1, 'Datasource name is required')
  .max(100, 'Datasource name must be 100 characters or fewer')
  .describe('Human-readable datasource name, unique inside the project');

/**
 * One database role's credentials, write-only: they appear in this request
 * DTO and nowhere else — no response schema ever carries a password.
 */
const RoleCredentialsSchema = z.object({
  username: z.string().trim().min(1).max(128).describe('Database role name'),
  password: z.string().min(1).max(512).describe('Database role password'),
});

const SslModeSchema = z
  .enum(['REQUIRE', 'DISABLE'])
  .describe(
    'TLS on the target connection. REQUIRE is the default (decision D11); DISABLE is an explicit opt-out for local databases',
  );

const CreateDatasourceSchema = z.object({
  name: DatasourceNameSchema,
  host: z.string().trim().min(1).max(253).describe('Database host'),
  port: z.coerce.number().int().min(1).max(65535).describe('Database port'),
  database: z.string().trim().min(1).max(128).describe('Database name'),
  sslMode: SslModeSchema.default('REQUIRE'),
  readOnly: RoleCredentialsSchema.describe(
    'Credentials of the read-only role (default execution path, decision D2)',
  ),
  readWrite: RoleCredentialsSchema.describe(
    'Credentials of the read-write role (used only behind approvals, from P2)',
  ),
});

export class CreateDatasourceDto extends createZodDto(CreateDatasourceSchema) {}

const DatasourceSchema = z.object({
  id: z.string().describe('Datasource id'),
  projectId: z.string().describe('Owning project id'),
  name: DatasourceNameSchema,
  type: z.literal('POSTGRES').describe('Database engine (Postgres-only in V1)'),
  host: z.string().describe('Database host'),
  port: z.number().int().describe('Database port'),
  database: z.string().describe('Database name'),
  sslMode: SslModeSchema,
  roles: z
    .array(
      z.object({
        role: z.enum(['READ_ONLY', 'READ_WRITE']).describe('Connection role'),
        username: z.string().describe('Database role name (never the secret)'),
      }),
    )
    .describe('Configured connection roles — passwords are never returned'),
  createdAt: z.iso.datetime().describe('Creation timestamp (ISO 8601)'),
  updatedAt: z.iso.datetime().describe('Last update timestamp (ISO 8601)'),
});

export class DatasourceDto extends createZodDto(DatasourceSchema) {}

const ListDatasourcesQuerySchema = z.object({
  cursor: z.string().optional().describe('Opaque cursor from a previous page'),
  limit: z.coerce
    .number()
    .int()
    .optional()
    .describe('Page size (clamped server-side)'),
});

export class ListDatasourcesQueryDto extends createZodDto(
  ListDatasourcesQuerySchema,
) {}

const DatasourcePageSchema = z.object({
  items: z.array(DatasourceSchema).describe('Datasources, newest first'),
  nextCursor: z
    .string()
    .nullable()
    .describe('Cursor for the next page, null on the last page'),
});

export class DatasourcePageDto extends createZodDto(DatasourcePageSchema) {}

const ConnectionTestSchema = z.object({
  ok: z
    .boolean()
    .describe('True when both roles connect and the guardrail check passes'),
  problems: z
    .array(z.string())
    .describe(
      'Human-readable failures: unreachable host, bad credentials, or a read-only role that can actually write',
    ),
});

export class ConnectionTestDto extends createZodDto(ConnectionTestSchema) {}

const RoleSnippetRequestSchema = z.object({
  database: z
    .string()
    .regex(
      /^[a-z_][a-z0-9_]{0,62}$/,
      'Database name must be a lowercase Postgres identifier',
    )
    .describe('Name of the customer database the roles are created on'),
  schema: z
    .string()
    .regex(
      /^[a-z_][a-z0-9_]{0,62}$/,
      'Schema must be a lowercase Postgres identifier',
    )
    .optional()
    .describe('Target schema, defaults to public'),
});

export class RoleSnippetRequestDto extends createZodDto(
  RoleSnippetRequestSchema,
) {}

const RoleSnippetSchema = z.object({
  sql: z
    .string()
    .describe(
      'Ready-to-run script creating rowhouse_ro / rowhouse_rw with minimal grants — passwords are placeholders the customer fills in',
    ),
});

export class RoleSnippetDto extends createZodDto(RoleSnippetSchema) {}

const UpdateDatasourceSchema = z
  .object({
    name: DatasourceNameSchema.optional(),
    host: z
      .string()
      .trim()
      .min(1)
      .max(253)
      .optional()
      .describe('Database host'),
    port: z.coerce
      .number()
      .int()
      .min(1)
      .max(65535)
      .optional()
      .describe('Database port'),
    database: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .optional()
      .describe('Database name'),
    sslMode: SslModeSchema.optional(),
    readOnly: RoleCredentialsSchema.optional().describe(
      'Replacement credentials for the read-only role (re-sealed on save)',
    ),
    readWrite: RoleCredentialsSchema.optional().describe(
      'Replacement credentials for the read-write role (re-sealed on save)',
    ),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: 'Provide at least one field to update',
  });

export class UpdateDatasourceDto extends createZodDto(UpdateDatasourceSchema) {}
