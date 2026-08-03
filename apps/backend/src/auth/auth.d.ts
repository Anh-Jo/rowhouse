import type { FastifyRequest } from 'fastify';
import type { MailService } from '@/mail/mail.service';
import type { AuthPrismaService } from './auth-prisma.service';

/**
 * Shared auth types (extracted to a `.d.ts` per repo convention: 2+ types in
 * the folder). Runtime-free: only type-only imports.
 */

/** Fastify request augmented by AuthGuard with the resolved app user id. */
export type RequestWithUser = FastifyRequest & {
  userId?: string;
  /** Set by WorkspaceMemberGuard after verifying membership. */
  workspaceId?: string;
  /** The caller's role in the workspace (owner|admin|member), same source. */
  workspaceRole?: string;
};

/**
 * Port the better-auth database hooks delegate to. Implemented by AuthHooks,
 * which owns the app-side `User` row lifecycle (kept in sync with the auth db).
 */
export interface AuthHooksPort {
  /** better-auth created a user → create the mirror app `User` (same id). */
  handleUserCreated(user: { id: string; name: string }): Promise<void>;
  /** better-auth is deleting a user → remove the app `User` (cascades). */
  handleUserDeleted(user: { id: string }): Promise<void>;
}

/** The database adapter instance produced by `prismaAdapter(...)`. */
export type PrismaDatabaseAdapter = ReturnType<
  typeof import('better-auth/adapters/prisma').prismaAdapter
>;

/** OAuth client credentials for a social provider (Google here). */
export type GoogleCredentials = {
  clientId: string;
  clientSecret: string;
};

/** Dependencies required to build the better-auth options object. */
export type BuildAuthOptionsParams = {
  database: PrismaDatabaseAdapter;
  secret: string;
  baseURL: string;
  /** Frontend origin allowed to call the auth routes (CORS/CSRF trust). */
  frontendUrl: string;
  hooks: AuthHooksPort;
  sendResetOtp: (email: string, otp: string) => Promise<void>;
  /**
   * Trust `X-Forwarded-For` for client-IP resolution (rate limiting). Enable
   * only behind a trusted reverse proxy — must match Fastify's `trustProxy`.
   */
  trustProxy: boolean;
  /** Google SSO credentials; when omitted the provider stays disabled. */
  google?: GoogleCredentials;
};

/**
 * Dependencies required to build the runtime better-auth instance. Env is read
 * by the caller (module useFactory), never at module decoration time.
 */
export type CreateAuthDeps = {
  authPrisma: AuthPrismaService;
  mail: MailService;
  hooks: AuthHooksPort;
  secret: string;
  baseURL: string;
  frontendUrl: string;
  trustProxy: boolean;
  google?: GoogleCredentials;
};

/** Resolved better-auth instance type, used by the controller and guard. */
export type AuthInstance = ReturnType<
  typeof import('./auth.instance').createAuth
>;
