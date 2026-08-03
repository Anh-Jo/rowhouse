import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

const SLOW_QUERY_THRESHOLD_MS = 100;

// Interfaces kept inline due to TS error 1272: isolatedModules + emitDecoratorMetadata
// prevents importing type-only declarations for decorated constructor parameters.
export interface PrismaQueryEvent {
  query: string;
  params: string;
  duration: number;
  target: string;
}

interface PrismaClientWithEvents {
  $on(event: 'query', callback: (e: PrismaQueryEvent) => void): void;
}

@Injectable()
export class PrismaQueryLogger implements OnModuleInit {
  constructor(
    private readonly logger: PinoLogger,
    @Optional() private readonly prisma?: PrismaClientWithEvents,
  ) {
    this.logger.setContext(PrismaQueryLogger.name);
  }

  onModuleInit() {
    if (!this.prisma) {
      this.logger.debug(
        'No PrismaClient injected — SQL query logging is disabled',
      );
      return;
    }

    this.prisma.$on('query', (event: PrismaQueryEvent) => {
      const { query, params, duration } = event;

      if (duration > SLOW_QUERY_THRESHOLD_MS) {
        this.logger.warn(
          { query, params, duration },
          'Slow SQL query detected',
        );
      } else {
        this.logger.debug({ query, params, duration }, 'SQL query executed');
      }
    });

    this.logger.info('Prisma SQL query logging enabled');
  }
}
