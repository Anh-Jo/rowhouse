import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import { AUTH_INSTANCE, type AuthInstance } from './auth.instance';
import { IS_PUBLIC_KEY } from './decorators';
import { getRequestFromContext } from './get-request';

/**
 * Global guard (registered as APP_GUARD) enforcing an authenticated session on
 * every route, unless flagged with `@Public()` — protected by default.
 *
 * Resolves the session through better-auth (`auth.api.getSession`) from the
 * request cookies/headers and exposes the app user id as `request.userId`
 * (read by `@CurrentUser()`).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_INSTANCE) private readonly auth: AuthInstance,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = getRequestFromContext(context);
    // `disableCookieCache` forces a DB lookup so authorization reflects
    // server-side revocation immediately (e.g. sessions revoked on password
    // reset) instead of trusting the signed session cookie for up to its cache
    // maxAge. The cookie cache still serves the client's own get-session polling.
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
      query: { disableCookieCache: true },
    });

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    request.userId = session.user.id;
    return true;
  }
}
