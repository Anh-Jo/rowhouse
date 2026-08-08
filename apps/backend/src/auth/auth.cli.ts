import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { buildAuthOptions } from './auth-options';

/**
 * Standalone better-auth instance consumed **only** by `@better-auth/cli generate`
 * to emit `prisma/auth/schema.prisma` (see the `database:generate-schema:auth`
 * script). It reuses `buildAuthOptions` so the generated schema always matches
 * the plugin set of the runtime instance (`auth.instance.ts`).
 *
 * The Prisma client and secrets are placeholders: schema generation reads the
 * plugin/adapter shape only and never opens a connection.
 */
export const auth = betterAuth(
  buildAuthOptions({
    database: prismaAdapter(
      {},
      {
        provider: 'postgresql',
      },
    ),
    secret: 'cli-schema-generation-placeholder-secret-000',
    baseURL: 'http://localhost:3000',
    frontendUrl: 'http://localhost:5173',
    hooks: {
      handleUserCreated: async () => {},
      handleUserDeleted: async () => {},
    },
    sendResetOtp: async () => {},
    // Schema generation reads the plugin/adapter shape only; proxy trust and
    // Google SSO do not affect the emitted Prisma schema.
    trustProxy: false,
  }),
);
