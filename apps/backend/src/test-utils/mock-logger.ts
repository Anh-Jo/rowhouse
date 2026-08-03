import { PinoLogger } from 'nestjs-pino';

export function createMockLogger(): jest.Mocked<
  Pick<PinoLogger, 'debug' | 'info' | 'warn' | 'error' | 'setContext'>
> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setContext: jest.fn(),
  };
}
