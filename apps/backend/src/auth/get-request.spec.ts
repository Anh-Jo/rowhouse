import type { ExecutionContext } from '@nestjs/common';
import { getRequestFromContext } from './get-request';

describe('getRequestFromContext', () => {
  it('reads the request from the HTTP argument host', () => {
    const req = { userId: 'http-user', headers: {} };
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    expect(getRequestFromContext(context)).toBe(req);
  });
});
