// better-auth is ESM only and unreachable from the CJS unit runner. The guard
// pulls it in transitively (auth.guard.ts → auth.instance.ts). Mock the
// boundary modules so the guard's own logic runs unchanged; fromNodeHeaders is
// stubbed to a pass-through since the guard only forwards the headers.
jest.mock('better-auth', () => ({ betterAuth: jest.fn() }));
jest.mock('better-auth/adapters/prisma', () => ({ prismaAdapter: jest.fn() }));
jest.mock('better-auth/node', () => ({
  fromNodeHeaders: (headers: unknown) => headers,
}));
// Pulled in transitively via auth.instance.ts → auth-options.ts.
jest.mock('better-auth/plugins', () => ({ emailOTP: jest.fn() }));

import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import type { AuthInstance } from './auth.instance';

type RequestLike = { headers: Record<string, string>; userId?: string };

function httpContext(request: RequestLike): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => jest.fn(),
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function createGuard(opts: {
  isPublic: boolean;
  session: { user: { id: string } } | null;
}) {
  const getSession = jest.fn().mockResolvedValue(opts.session);
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(opts.isPublic),
  } as unknown as Reflector;
  const auth = { api: { getSession } } as unknown as AuthInstance;
  return { guard: new AuthGuard(reflector, auth), getSession };
}

describe('AuthGuard', () => {
  it('allows @Public() handlers without resolving a session', async () => {
    const { guard, getSession } = createGuard({
      isPublic: true,
      session: null,
    });

    await expect(guard.canActivate(httpContext({ headers: {} }))).resolves.toBe(
      true,
    );
    expect(getSession).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when there is no session', async () => {
    const { guard } = createGuard({ isPublic: false, session: null });

    await expect(
      guard.canActivate(httpContext({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('populates request.userId from the resolved session', async () => {
    const request: RequestLike = { headers: {} };
    const { guard, getSession } = createGuard({
      isPublic: false,
      session: { user: { id: 'user-1' } },
    });

    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true);
    expect(request.userId).toBe('user-1');
    expect(getSession).toHaveBeenCalledTimes(1);
    // Authorization must reflect server-side revocation immediately, so the
    // guard bypasses the signed-cookie session cache.
    expect(getSession).toHaveBeenCalledWith(
      expect.objectContaining({ query: { disableCookieCache: true } }),
    );
  });
});
