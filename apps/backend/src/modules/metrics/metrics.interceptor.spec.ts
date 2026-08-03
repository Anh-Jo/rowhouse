import { CallHandler, ExecutionContext, HttpException } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';

describe('MetricsInterceptor', () => {
  let interceptor: MetricsInterceptor;
  let recordHttpRequest: jest.Mock;

  const contextFor = (request: unknown, statusCode = 200): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ statusCode }),
      }),
    }) as unknown as ExecutionContext;

  const handlerOf = (result$: CallHandler['handle']): CallHandler =>
    ({ handle: result$ }) as CallHandler;

  beforeEach(() => {
    recordHttpRequest = jest.fn();
    interceptor = new MetricsInterceptor({
      recordHttpRequest,
    } as unknown as MetricsService);
  });

  it('records the Fastify route pattern, not the raw URL', async () => {
    const context = contextFor({
      method: 'GET',
      url: '/users/42',
      routeOptions: { url: '/users/:id' },
    });

    await firstValueFrom(
      interceptor.intercept(
        context,
        handlerOf(() => of('ok')),
      ),
    );

    expect(recordHttpRequest).toHaveBeenCalledWith(
      'GET',
      '/users/:id',
      200,
      expect.any(Number),
    );
  });

  it('falls back to the raw URL when no route pattern is available', async () => {
    const context = contextFor({ method: 'GET', url: '/raw-url' });

    await firstValueFrom(
      interceptor.intercept(
        context,
        handlerOf(() => of('ok')),
      ),
    );

    expect(recordHttpRequest).toHaveBeenCalledWith(
      'GET',
      '/raw-url',
      200,
      expect.any(Number),
    );
  });

  it('records the exception status code on errors', async () => {
    const context = contextFor({
      method: 'POST',
      url: '/things',
      routeOptions: { url: '/things' },
    });

    await expect(
      firstValueFrom(
        interceptor.intercept(
          context,
          handlerOf(() => throwError(() => new HttpException('nope', 418))),
        ),
      ),
    ).rejects.toThrow('nope');

    expect(recordHttpRequest).toHaveBeenCalledWith(
      'POST',
      '/things',
      418,
      expect.any(Number),
    );
  });
});
