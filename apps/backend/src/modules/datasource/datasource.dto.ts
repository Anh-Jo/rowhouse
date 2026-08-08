import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DatasourceNameSchema = z
  .string()
  .trim()
  .min(1, 'Datasource name is required')
  .max(100, 'Datasource name must be 100 characters or fewer')
  .describe('Human-readable datasource name, unique inside the project');

/**
 * One database role's credentials, write-only: they appear in request DTOs
 * and nowhere else — no response schema ever carries a password.
 */
const RoleCredentialsSchema = z.object({
  username: z.string().trim().min(1).max(128).describe('Database role name'),
  password: z.string().min(1).max(512).describe('Database role password'),
});

/**
 * Cloud SQL variant: the password is per-authType — required with BUILT_IN
 * database users, forbidden with IAM (ephemeral tokens, no stored secret).
 * The cross-field rule lives on the payload schema below.
 */
const CloudSqlRoleCredentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .describe(
      'Database user name. For IAM auth this is the service-account email with ".gserviceaccount.com" truncated',
    ),
  password: z
    .string()
    .min(1)
    .max(512)
    .optional()
    .describe('Database user password — BUILT_IN auth only'),
});

const SslModeSchema = z
  .enum(['REQUIRE', 'DISABLE'])
  .describe(
    'TLS on the target connection. REQUIRE is the default (decision D11); DISABLE is an explicit opt-out for local databases',
  );

const CaCertSchema = z
  .string()
  .trim()
  .min(1)
  .max(65_536)
  .refine((value) => value.includes('-----BEGIN CERTIFICATE-----'), {
    message: 'caCert must be a PEM-encoded certificate',
  })
  .describe(
    'PEM CA certificate of the target server. When provided, the connection verifies the server chain against it (VERIFY_CA) instead of unverified TLS',
  );

const InstanceConnectionNameSchema = z
  .string()
  .trim()
  .regex(
    /^[a-z][-a-z0-9]*:[a-z0-9-]+:[a-z][-a-z0-9]*$/,
    'Must be "project:region:instance" (the Cloud SQL instance connection name)',
  )
  .describe('Cloud SQL instance connection name: project:region:instance');

const CloudSqlAuthTypeSchema = z
  .enum(['IAM', 'BUILT_IN'])
  .describe(
    'IAM: passwordless database users via ephemeral tokens (the zero-stored-password path). BUILT_IN: classic database users with passwords, the connector only carries the transport',
  );

const SaKeyJsonSchema = z
  .string()
  .min(1)
  .max(32_768)
  .refine(
    (value) => {
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'saKeyJson must be valid JSON (a service-account key file)' },
  )
  .describe(
    'Service-account key JSON, write-only: sealed on save (decision D10), never returned by any API',
  );

/**
 * DIRECT method payload — today's connect-form fields, plus an optional CA
 * certificate for real TLS verification. `method` is optional (DIRECT is
 * the implied default) so pre-D12 clients (and the P1 webapp) that send the
 * flat shape keep working — `.optional()` rather than `.default(...)` on
 * purpose: openapi-typescript marks defaulted properties as required
 * (defaultNonNullable), which would force `method` on those clients.
 */
const CreateDirectDatasourceSchema = z.object({
  method: z
    .literal('DIRECT')
    .optional()
    .describe('Connection method discriminator (decision D12)'),
  name: DatasourceNameSchema,
  host: z.string().trim().min(1).max(253).describe('Database host'),
  port: z.coerce.number().int().min(1).max(65535).describe('Database port'),
  database: z.string().trim().min(1).max(128).describe('Database name'),
  sslMode: SslModeSchema.default('REQUIRE'),
  caCert: CaCertSchema.optional(),
  readOnly: RoleCredentialsSchema.describe(
    'Credentials of the read-only role (default execution path, decision D2)',
  ),
  readWrite: RoleCredentialsSchema.describe(
    'Credentials of the read-write role (used only behind approvals, from P2)',
  ),
});

/** CLOUDSQL method payload (decision D12). */
const CreateCloudSqlDatasourceSchema = z
  .object({
    method: z
      .literal('CLOUDSQL')
      .describe('Connection method discriminator (decision D12)'),
    name: DatasourceNameSchema,
    instanceConnectionName: InstanceConnectionNameSchema,
    database: z.string().trim().min(1).max(128).describe('Database name'),
    authType: CloudSqlAuthTypeSchema,
    saKeyJson: SaKeyJsonSchema,
    readOnly: CloudSqlRoleCredentialsSchema.describe(
      'Read-only database user (default execution path, decision D2)',
    ),
    readWrite: CloudSqlRoleCredentialsSchema.describe(
      'Read-write database user (used only behind approvals, from P2)',
    ),
  })
  .superRefine((value, ctx) => {
    for (const role of ['readOnly', 'readWrite'] as const) {
      const hasPassword = value[role].password !== undefined;
      if (value.authType === 'BUILT_IN' && !hasPassword) {
        ctx.addIssue({
          code: 'custom',
          path: [role, 'password'],
          message: 'BUILT_IN auth requires a password for each database user',
        });
      }
      if (value.authType === 'IAM' && hasPassword) {
        ctx.addIssue({
          code: 'custom',
          path: [role, 'password'],
          message:
            'IAM auth uses ephemeral tokens — database users hold no password',
        });
      }
    }
  });

/**
 * Plain union (not discriminatedUnion) on purpose: the DIRECT branch's
 * discriminator is optional, so a flat pre-D12 payload without `method`
 * still parses.
 */
const CreateDatasourceSchema = z.union([
  CreateDirectDatasourceSchema,
  CreateCloudSqlDatasourceSchema,
]);

/**
 * Exported as `const + type` instead of `class extends createZodDto(...)`:
 * a class cannot extend a union instance type (TS2509), but the DTO object
 * itself is a perfectly valid Zod DTO for the global validation pipe, and
 * the type alias gives handlers the discriminated-union typing.
 */
export const CreateDatasourceDto = createZodDto(CreateDatasourceSchema);
export type CreateDatasourceDto = z.output<typeof CreateDatasourceSchema>;
// Swagger names schemas after the class; without `extends` the DTO would
// register under nestjs-zod's internal wrapper name (AugmentedZodDto).
Object.defineProperty(CreateDatasourceDto, 'name', {
  value: 'CreateDatasourceDto',
});

const CloudSqlInfoSchema = z
  .object({
    instanceConnectionName: InstanceConnectionNameSchema,
    database: z.string().describe('Database name'),
    authType: CloudSqlAuthTypeSchema,
  })
  .describe(
    'Cloud SQL method settings — present when method is CLOUDSQL. The sealed service-account key is never exposed',
  );

/**
 * Response shape. The DIRECT method fields stay top-level (present when
 * `method` is DIRECT, like every pre-D12 datasource) so P1 clients keep
 * working; CLOUDSQL settings arrive as a nested object. No branch ever
 * carries a secret: no password, no service-account key.
 */
const DatasourceSchema = z.object({
  id: z.string().describe('Datasource id'),
  projectId: z.string().describe('Owning project id'),
  name: DatasourceNameSchema,
  type: z.literal('POSTGRES').describe('Database engine (Postgres-only in V1)'),
  method: z
    .enum(['DIRECT', 'CLOUDSQL'])
    .describe('Connection method (decision D12)'),
  host: z.string().optional().describe('Database host (DIRECT method only)'),
  port: z
    .number()
    .int()
    .optional()
    .describe('Database port (DIRECT method only)'),
  database: z
    .string()
    .optional()
    .describe('Database name (DIRECT method only)'),
  sslMode: SslModeSchema.optional().describe(
    'TLS mode (DIRECT method only). With a stored CA certificate, REQUIRE is enforced as full chain verification',
  ),
  caCert: z
    .string()
    .nullable()
    .optional()
    .describe(
      'Stored CA certificate PEM (DIRECT method only) — public-key material, not a secret',
    ),
  cloudSql: CloudSqlInfoSchema.optional(),
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

const PostgresIdentifierSchema = z
  .string()
  .regex(/^[a-z_][a-z0-9_]{0,62}$/, 'Must be a lowercase Postgres identifier');

const RoleSnippetRequestSchema = z.object({
  database: PostgresIdentifierSchema.describe(
    'Name of the customer database the roles are created on',
  ),
  schema: PostgresIdentifierSchema.optional().describe(
    'Target schema, defaults to public',
  ),
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

const CloudSqlSnippetRequestSchema = z.object({
  instanceConnectionName: InstanceConnectionNameSchema,
  database: PostgresIdentifierSchema.describe(
    'Name of the customer database the users are granted on',
  ),
  schema: PostgresIdentifierSchema.optional().describe(
    'Target schema, defaults to public',
  ),
});

export class CloudSqlSnippetRequestDto extends createZodDto(
  CloudSqlSnippetRequestSchema,
) {}

const CloudSqlSnippetSchema = z.object({
  script: z
    .string()
    .describe(
      'Ready-to-run gcloud + SQL script: service accounts with roles/cloudsql.client, IAM database users, least-privilege grants (decision D11)',
    ),
});

export class CloudSqlSnippetDto extends createZodDto(CloudSqlSnippetSchema) {}

/**
 * PATCH payload. Deliberately flat (one object, optional fields) so partial
 * edits stay ergonomic; per-method rules are enforced by the service against
 * the stored datasource: fields of the *other* method are rejected, and
 * `method` itself cannot change in P1.5 — create a new datasource instead.
 */
const UpdateDatasourceSchema = z
  .object({
    method: z
      .enum(['DIRECT', 'CLOUDSQL'])
      .optional()
      .describe(
        'Must match the stored method when provided — changing the connection method means creating a new datasource (P1.5)',
      ),
    name: DatasourceNameSchema.optional(),
    host: z
      .string()
      .trim()
      .min(1)
      .max(253)
      .optional()
      .describe('Database host (DIRECT method only)'),
    port: z.coerce
      .number()
      .int()
      .min(1)
      .max(65535)
      .optional()
      .describe('Database port (DIRECT method only)'),
    database: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .optional()
      .describe('Database name (DIRECT method only)'),
    sslMode: SslModeSchema.optional(),
    caCert: CaCertSchema.nullable()
      .optional()
      .describe(
        'DIRECT method only: a PEM upgrades TLS to chain verification, null removes the stored certificate',
      ),
    cloudSql: z
      .object({
        instanceConnectionName: InstanceConnectionNameSchema.optional(),
        database: z
          .string()
          .trim()
          .min(1)
          .max(128)
          .optional()
          .describe('Database name'),
        saKeyJson: SaKeyJsonSchema.optional(),
      })
      .optional()
      .describe(
        'CLOUDSQL method only. authType is fixed at creation — its credentials model differs too much to flip in place',
      ),
    readOnly: CloudSqlRoleCredentialsSchema.optional().describe(
      'Replacement credentials for the read-only role (re-sealed on save). Password rules follow the stored method: required except under Cloud SQL IAM auth',
    ),
    readWrite: CloudSqlRoleCredentialsSchema.optional().describe(
      'Replacement credentials for the read-write role (re-sealed on save). Password rules follow the stored method: required except under Cloud SQL IAM auth',
    ),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: 'Provide at least one field to update',
  });

export class UpdateDatasourceDto extends createZodDto(UpdateDatasourceSchema) {}
