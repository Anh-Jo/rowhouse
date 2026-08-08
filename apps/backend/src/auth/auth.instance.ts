import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { buildAuthOptions } from './auth-options';
import type { CreateAuthDeps } from './auth.d.ts';

/** DI token for the singleton better-auth instance (built via useFactory). */
export const AUTH_INSTANCE = Symbol('AUTH_INSTANCE');

// Resolved better-auth instance type — re-exported from the folder's `.d.ts`
// (per the 2+-types-per-folder convention) so existing importers of
// `./auth.instance` keep working.
export type { AuthInstance } from './auth.d.ts';

/**
 * Builds the runtime better-auth instance: the Prisma adapter over the auth
 * database, the app-side user hooks, and the OTP mailer. Env is read lazily by
 * the caller (module useFactory), never at module decoration time.
 */
export function createAuth(deps: CreateAuthDeps) {
  return betterAuth(
    buildAuthOptions({
      database: prismaAdapter(deps.authPrisma.client, {
        provider: 'postgresql',
      }),
      secret: deps.secret,
      baseURL: deps.baseURL,
      frontendUrl: deps.frontendUrl,
      hooks: deps.hooks,
      trustProxy: deps.trustProxy,
      google: deps.google,
      sendResetOtp: async (email, otp) => {
        await deps.mail.sendMail({
          to: email,
          subject: 'Your password reset code',
          text: `Your password reset code is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email.`,
          html: `<p>Your password reset code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes. If you did not request this, ignore this email.</p>`,
        });
      },
    }),
  );
}
