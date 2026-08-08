import { All, Controller, Inject, Req, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiExcludeController } from '@nestjs/swagger';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AUTH_INSTANCE, type AuthInstance } from './auth.instance';
import { Public } from './decorators';

/**
 * Catch-all bridge exposing better-auth's REST surface under `/api/auth/*`.
 * These routes live outside the OpenAPI contract; the webapp consumes them
 * through the typed better-auth client.
 *
 * The controller converts the Fastify request into a Fetch `Request`, delegates
 * to `auth.handler`, and mirrors the resulting status/headers/body back —
 * `Set-Cookie` is copied via `getSetCookie()` to preserve multiple cookies.
 */
// `/api/auth/*` is already protected by the Fastify route-level rate limit and
// better-auth's own limiter; skip Nest's throttler so normal traffic (e.g.
// `get-session` polling) is never 429'd by the shared bucket.
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller()
export class AuthController {
  constructor(@Inject(AUTH_INSTANCE) private readonly auth: AuthInstance) {}

  // Fastify's router requires the wildcard as the last character (find-my-way);
  // the matched suffix is unused — the full path is read back from `req.url`.
  @All('api/auth/*')
  async handle(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const url = new URL(req.url, `${req.protocol}://${req.headers.host}`);
    const request = new Request(url.toString(), {
      method: req.method,
      headers: fromNodeHeaders(req.headers),
      body: req.body ? JSON.stringify(req.body) : undefined,
    });

    const response = await this.auth.handler(request);

    reply.status(response.status);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'set-cookie') {
        reply.header(key, value);
      }
    });
    const setCookies = response.headers.getSetCookie();
    if (setCookies.length > 0) {
      reply.header('set-cookie', setCookies);
    }

    await reply.send(response.body ? await response.text() : null);
  }
}
