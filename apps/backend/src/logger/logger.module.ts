import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { IncomingMessage } from 'http';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Paths excluded from the generic pino-http request log:
 * `/health` and `/metrics` are liveness/scrape probe noise.
 */
const HTTP_AUTOLOG_SKIP_PATHS = new Set(['/health', '/metrics']);

/**
 * Whether the generic HTTP request logger should stay silent for this URL.
 * The query string is stripped so a probe like `/health?check=db` is matched
 * too (a strict `===` comparison would let it through). Exported for unit
 * testing.
 */
export function shouldSkipHttpAutoLogging(url: string | undefined): boolean {
  if (!url) {
    return false;
  }
  return HTTP_AUTOLOG_SKIP_PATHS.has(url.split('?')[0]);
}

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        // Evaluated at import time, before env.init() runs in bootstrap —
        // raw read is deliberate; the value is still validated by EnvSchema.
        // eslint-disable-next-line no-restricted-syntax
        level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),

        transport: isProduction
          ? undefined
          : { target: 'pino-pretty', options: { colorize: true } },

        genReqId: (req: IncomingMessage) => {
          const requestId = req.headers['x-request-id'];
          return typeof requestId === 'string' ? requestId : randomUUID();
        },

        redact: ['req.headers.authorization', 'req.headers.cookie'],

        customLogLevel: (_req, res, err) => {
          if (err || (res.statusCode && res.statusCode >= 500)) return 'error';
          if (res.statusCode && res.statusCode >= 400) return 'warn';
          return 'info';
        },

        autoLogging: {
          ignore: (req: IncomingMessage) => shouldSkipHttpAutoLogging(req.url),
        },
      },
    }),
  ],
})
export class LoggerModule {}
