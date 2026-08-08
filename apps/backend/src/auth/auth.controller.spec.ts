// better-auth is ESM only and unreachable from the CJS unit runner; mock the
// boundary modules (same pattern as auth.guard.spec.ts) so the controller's
// own bridging logic runs unchanged.
jest.mock('better-auth', () => ({ betterAuth: jest.fn() }));
jest.mock('better-auth/adapters/prisma', () => ({ prismaAdapter: jest.fn() }));
jest.mock('better-auth/node', () => ({
  fromNodeHeaders: (headers: Record<string, string>) => headers,
}));
jest.mock('better-auth/plugins', () => ({ emailOTP: jest.fn() }));

import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthController } from './auth.controller';
import type { AuthInstance } from './auth.instance';

function fastifyRequest(overrides: Partial<FastifyRequest> = {}) {
  return {
    url: '/api/auth/get-session',
    method: 'GET',
    protocol: 'http',
    headers: { host: 'localhost:3000' },
    body: undefined,
    ...overrides,
  } as unknown as FastifyRequest;
}

function fastifyReply() {
  const reply = {
    status: jest.fn(),
    header: jest.fn(),
    send: jest.fn().mockResolvedValue(undefined),
  };
  reply.status.mockReturnValue(reply);
  return reply as unknown as FastifyReply & {
    status: jest.Mock;
    header: jest.Mock;
    send: jest.Mock;
  };
}

function controllerWithHandler(response: Response) {
  // Captures forwarded requests through the implementation instead of
  // mock.calls: keeps them typed as Request without reaching into jest's
  // generics.
  const forwarded: Request[] = [];
  const handler = jest.fn((request: Request) => {
    forwarded.push(request);
    return Promise.resolve(response);
  });
  const auth = { handler } as unknown as AuthInstance;
  return { controller: new AuthController(auth), forwarded };
}

describe('AuthController', () => {
  it('forwards the request to better-auth and mirrors status, headers and body', async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    const { controller, forwarded } = controllerWithHandler(response);
    const reply = fastifyReply();

    await controller.handle(fastifyRequest(), reply);

    expect(forwarded[0].method).toBe('GET');
    expect(forwarded[0].url).toBe('http://localhost:3000/api/auth/get-session');

    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.header).toHaveBeenCalledWith(
      'content-type',
      'application/json',
    );
    expect(reply.send).toHaveBeenCalledWith(JSON.stringify({ ok: true }));
  });

  it('serializes the JSON body for non-GET requests', async () => {
    const { controller, forwarded } = controllerWithHandler(
      new Response(null, { status: 200 }),
    );

    await controller.handle(
      fastifyRequest({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        body: { email: 'a@b.c', password: 'pw' },
      } as Partial<FastifyRequest>),
      fastifyReply(),
    );

    expect(forwarded[0].method).toBe('POST');
    await expect(forwarded[0].text()).resolves.toBe(
      JSON.stringify({ email: 'a@b.c', password: 'pw' }),
    );
  });

  it('copies every Set-Cookie entry through getSetCookie()', async () => {
    const response = new Response(null, { status: 200 });
    response.headers.append('set-cookie', 'a=1; Path=/');
    response.headers.append('set-cookie', 'b=2; Path=/');
    const { controller } = controllerWithHandler(response);
    const reply = fastifyReply();

    await controller.handle(fastifyRequest(), reply);

    expect(reply.header).toHaveBeenCalledWith('set-cookie', [
      'a=1; Path=/',
      'b=2; Path=/',
    ]);
  });

  it('sends null when better-auth returns no body', async () => {
    const { controller } = controllerWithHandler(
      new Response(null, { status: 204 }),
    );
    const reply = fastifyReply();

    await controller.handle(fastifyRequest(), reply);

    expect(reply.status).toHaveBeenCalledWith(204);
    expect(reply.send).toHaveBeenCalledWith(null);
  });
});
