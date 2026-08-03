import { z } from 'zod';

/**
 * Single source of truth for environment variables — declaration only.
 * The schema drives runtime validation (see env.ts), the inferred AppEnv
 * type, and process.env completion (see env.d.ts).
 */
export const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1).describe('PostgreSQL connection string'),
  PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(3000)
    .describe('HTTP port the API listens on'),
  FRONTEND_URL: z
    .url()
    .describe('Frontend origin, used for CORS and links in emails'),
  TRUST_PROXY: z
    .stringbool()
    .default(false)
    .describe(
      'Trust X-Forwarded-For for client-IP resolution (enable in prod behind a reverse proxy)',
    ),
  SMTP_HOST: z
    .string()
    .optional()
    .describe(
      'SMTP server host (Mailpit in dev); mail falls back to a stream transport when unset',
    ),
  SMTP_PORT: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .describe('SMTP server port'),
  SMTP_SECURE: z
    .stringbool()
    .default(false)
    .describe('Use TLS for SMTP ("true"/"false")'),
  SMTP_USER: z.string().optional().describe('SMTP username'),
  SMTP_PASS: z.string().optional().describe('SMTP password'),
  MAIL_FROM: z
    .string()
    .default('noreply@starter.local')
    .describe('Default From address for outgoing mail'),
  MAILPIT_API: z
    .url()
    .optional()
    .describe('Mailpit REST API base URL (used by e2e tests)'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .optional()
    .describe(
      'Pino log level; defaults to info in production, debug otherwise',
    ),
});

export type AppEnv = z.infer<typeof EnvSchema>;
