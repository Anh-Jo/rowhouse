import { PinoLogger } from 'nestjs-pino';
import { createMockLogger } from '../test-utils/mock-logger';
import {
  PrismaQueryEvent,
  PrismaQueryLogger,
} from './prisma-query-logger.service';

describe('PrismaQueryLogger', () => {
  describe('without PrismaClient', () => {
    it('should be defined', () => {
      const logger = createMockLogger();
      const service = new PrismaQueryLogger(logger as unknown as PinoLogger);
      expect(service).toBeDefined();
    });

    it('should log a debug message when no PrismaClient is available', () => {
      const logger = createMockLogger();
      const service = new PrismaQueryLogger(logger as unknown as PinoLogger);

      service.onModuleInit();

      expect(logger.debug).toHaveBeenCalledWith(
        'No PrismaClient injected — SQL query logging is disabled',
      );
    });
  });

  describe('with PrismaClient', () => {
    let queryCallback: ((event: PrismaQueryEvent) => void) | undefined;
    const mockPrisma = {
      $on: jest.fn((event: string, cb: (e: PrismaQueryEvent) => void) => {
        if (event === 'query') queryCallback = cb;
      }),
    };

    beforeEach(() => {
      queryCallback = undefined;
      mockPrisma.$on.mockClear();
    });

    it('should register a query listener on module init', () => {
      const logger = createMockLogger();
      const service = new PrismaQueryLogger(
        logger as unknown as PinoLogger,
        mockPrisma,
      );

      service.onModuleInit();

      expect(mockPrisma.$on).toHaveBeenCalledWith(
        'query',
        expect.any(Function),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Prisma SQL query logging enabled',
      );
    });

    it('should log debug for normal queries', () => {
      const logger = createMockLogger();
      const service = new PrismaQueryLogger(
        logger as unknown as PinoLogger,
        mockPrisma,
      );

      service.onModuleInit();

      queryCallback?.({
        query: 'SELECT * FROM users',
        params: '[]',
        duration: 5,
        target: 'postgresql',
      });

      expect(logger.debug).toHaveBeenCalledWith(
        { query: 'SELECT * FROM users', params: '[]', duration: 5 },
        'SQL query executed',
      );
    });

    it('should log warn for slow queries (>100ms)', () => {
      const logger = createMockLogger();
      const service = new PrismaQueryLogger(
        logger as unknown as PinoLogger,
        mockPrisma,
      );

      service.onModuleInit();

      queryCallback?.({
        query: 'SELECT * FROM deals',
        params: '[]',
        duration: 150,
        target: 'postgresql',
      });

      expect(logger.warn).toHaveBeenCalledWith(
        { query: 'SELECT * FROM deals', params: '[]', duration: 150 },
        'Slow SQL query detected',
      );
    });
  });
});
