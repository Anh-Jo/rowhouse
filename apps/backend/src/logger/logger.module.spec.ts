import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { LoggerModule, shouldSkipHttpAutoLogging } from './logger.module';

describe('shouldSkipHttpAutoLogging', () => {
  it.each(['/health', '/metrics'])(
    'skips the HTTP request log for %s',
    (url) => {
      expect(shouldSkipHttpAutoLogging(url)).toBe(true);
    },
  );

  it('skips probes regardless of the query string', () => {
    expect(shouldSkipHttpAutoLogging('/health?check=db')).toBe(true);
    expect(shouldSkipHttpAutoLogging('/metrics?format=prometheus')).toBe(true);
  });

  it.each(['/', '/healthz', '/api/users', undefined])(
    'keeps logging %s',
    (url) => {
      expect(shouldSkipHttpAutoLogging(url)).toBe(false);
    },
  );
});

describe('LoggerModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [LoggerModule],
    }).compile();
  });

  it('should compile successfully', () => {
    expect(module).toBeDefined();
  });

  it('should provide the pino Logger', () => {
    const logger = module.get(Logger);
    expect(logger).toBeDefined();
  });
});
