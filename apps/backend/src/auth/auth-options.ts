import type { BetterAuthOptions } from 'better-auth';
import { emailOTP, organization } from 'better-auth/plugins';
import type { BuildAuthOptionsParams } from './auth.d.ts';

/** OTP configuration for the email-based password reset flow. */
const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 10 * 60;
/** Session cache lifetime kept in the signed cookie (avoids a db hit per request). */
const SESSION_COOKIE_CACHE_SECONDS = 5 * 60;

/**
 * Builds the better-auth options. Pure and dependency-injected so the same
 * shape drives both the runtime instance (`createAuth`) and the `@better-auth/cli`
 * schema generation (`auth.cli.ts`), keeping the generated schema in sync.
 */
export function buildAuthOptions(
  params: BuildAuthOptionsParams,
): BetterAuthOptions {
  const {
    database,
    secret,
    baseURL,
    frontendUrl,
    hooks,
    sendResetOtp,
    trustProxy,
    google,
  } = params;

  return {
    appName: 'Rowhouse',
    secret,
    baseURL,
    database,
    // The webapp authenticates cross-origin (Vite dev server / deployed SPA);
    // add mobile deep-link schemes here if a native client joins later.
    trustedOrigins: [frontendUrl],
    emailAndPassword: {
      enabled: true,
      // Invalidate every other active session on a password reset. The emailOTP
      // reset-password route honors this flag (better-auth >=1.6), so a stolen
      // or leftover cookie cannot survive a self-service reset.
      revokeSessionsOnPasswordReset: true,
    },
    // Google SSO — enabled only when both credentials are provided (the module
    // reads the optional env vars and passes them through). No env access here.
    ...(google ? { socialProviders: { google } } : {}),
    // Behind a trusted reverse proxy (prod), resolve the client IP from the
    // proxy-set `X-Forwarded-For` so better-auth's rate limit keys on the real
    // client instead of the proxy socket — kept consistent with Fastify's
    // `trustProxy`. Left off in dev/test where the header is untrusted.
    ...(trustProxy
      ? { advanced: { ipAddress: { ipAddressHeaders: ['x-forwarded-for'] } } }
      : {}),
    user: {
      // Self-service account deletion (password re-check enforced by better-auth).
      deleteUser: {
        enabled: true,
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: SESSION_COOKIE_CACHE_SECONDS,
      },
    },
    // better-auth enables its own rate limit on /api/auth/* in production.
    // Values pin the vendor defaults intentionally, as an explicit contract.
    rateLimit: {
      window: 10,
      max: 100,
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user, context) => {
            try {
              await hooks.handleUserCreated({ id: user.id, name: user.name });
            } catch (error) {
              // Compensation across the two databases: the better-auth account
              // is already committed but the mirror app `User` failed to
              // create. Delete the orphan auth account so the email is freed —
              // never leave an auth account without a profile. Best-effort;
              // re-throw to surface the sign-up failure to the client.
              await context?.context.internalAdapter
                .deleteUser(user.id)
                .catch(() => undefined);
              throw error;
            }
          },
        },
        delete: {
          before: async (user) => {
            await hooks.handleUserDeleted({ id: user.id });
          },
        },
      },
    },
    plugins: [
      // Workspaces are better-auth organizations (transverse decision D9):
      // membership, roles and invitations come from the plugin, never rebuilt.
      // Invitation emails ship with the collaboration UI (phase 2) — until
      // then invitations only flow through the API surface.
      organization(),
      emailOTP({
        otpLength: OTP_LENGTH,
        expiresIn: OTP_TTL_SECONDS,
        async sendVerificationOTP({ email, otp, type }) {
          // The template only uses OTP for the password reset flow.
          if (type === 'forget-password') {
            await sendResetOtp(email, otp);
          }
        },
      }),
    ],
  };
}
