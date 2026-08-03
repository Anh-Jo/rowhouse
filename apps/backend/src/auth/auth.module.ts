import { Global, Module } from '@nestjs/common';
import { env } from '@/config/env';
import { MailModule } from '@/mail/mail.module';
import { MailService } from '@/mail/mail.service';
import { AuthController } from './auth.controller';
import { AuthHooks } from './auth-hooks.service';
import { AuthPrismaService } from './auth-prisma.service';
import { AUTH_INSTANCE, createAuth } from './auth.instance';
import type { GoogleCredentials } from './auth.d.ts';

/**
 * Google SSO is enabled only when both credentials are present (SMTP-style
 * optional env pattern). Read at runtime in the factory, never at decoration.
 */
function resolveGoogleCredentials(): GoogleCredentials | undefined {
  const clientId = env.get('GOOGLE_CLIENT_ID');
  const clientSecret = env.get('GOOGLE_CLIENT_SECRET');
  return clientId && clientSecret ? { clientId, clientSecret } : undefined;
}

/**
 * Owns everything better-auth: the auth-database Prisma client, the user
 * lifecycle hooks, the singleton auth instance and the `/api/auth/*` bridge.
 * `@Global()` so `AUTH_INSTANCE` is available app-wide without re-importing.
 * The global `AuthGuard` is registered in `AppModule` alongside the throttler
 * guard so their order is explicit.
 */
@Global()
@Module({
  imports: [MailModule],
  controllers: [AuthController],
  providers: [
    AuthPrismaService,
    AuthHooks,
    {
      provide: AUTH_INSTANCE,
      inject: [AuthPrismaService, MailService, AuthHooks],
      // Env is read here (runtime), never at module decoration time.
      useFactory: (
        authPrisma: AuthPrismaService,
        mail: MailService,
        hooks: AuthHooks,
      ) =>
        createAuth({
          authPrisma,
          mail,
          hooks,
          secret: env.get('BETTER_AUTH_SECRET'),
          baseURL: env.get('BETTER_AUTH_URL'),
          frontendUrl: env.get('FRONTEND_URL'),
          trustProxy: env.get('TRUST_PROXY'),
          google: resolveGoogleCredentials(),
        }),
    },
  ],
  exports: [AUTH_INSTANCE, AuthPrismaService],
})
export class AuthModule {}
