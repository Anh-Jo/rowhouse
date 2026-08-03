import { ExecutionContext, CallHandler } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Observable, of } from 'rxjs';
import { createMockLogger } from '../test-utils/mock-logger';
import { RequestTimingInterceptor } from './request-timing.interceptor';

function createMockExecutionContext(
  method: string,
  url: string,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, url }),
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getClass: () => Object,
    getHandler: () => jest.fn(),
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({}) as ReturnType<ExecutionContext['switchToRpc']>,
    switchToWs: () => ({}) as ReturnType<ExecutionContext['switchToWs']>,
    getType: () => 'http',
  } as unknown as ExecutionContext;
}

function createMockCallHandler(result: unknown = 'ok'): CallHandler {
  return { handle: () => of(result) };
}

describe('RequestTimingInterceptor', () => {
  it('should be defined', () => {
    const logger = createMockLogger();
    const interceptor = new RequestTimingInterceptor(
      logger as unknown as PinoLogger,
    );
    expect(interceptor).toBeDefined();
  });

  it('should not warn for fast requests', (done) => {
    const logger = createMockLogger();
    const interceptor = new RequestTimingInterceptor(
      logger as unknown as PinoLogger,
    );
    const context = createMockExecutionContext('GET', '/api/deals');
    const next = createMockCallHandler();

    interceptor.intercept(context, next).subscribe({
      complete: () => {
        expect(logger.warn).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('should warn for slow requests (>500ms)', (done) => {
    const logger = createMockLogger();
    const interceptor = new RequestTimingInterceptor(
      logger as unknown as PinoLogger,
    );
    const context = createMockExecutionContext('POST', '/api/referrals');

    // Simulate a slow handler by delaying the observable
    const slowHandler: CallHandler = {
      handle: () =>
        new Observable<string>((subscriber) => {
          setTimeout(() => {
            subscriber.next('ok');
            subscriber.complete();
          }, 550);
        }),
    };

    interceptor.intercept(context, slowHandler).subscribe({
      complete: () => {
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            url: '/api/referrals',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            duration: expect.any(Number),
          }),
          'Slow request detected',
        );
        done();
      },
    });
  }, 10000);
});
