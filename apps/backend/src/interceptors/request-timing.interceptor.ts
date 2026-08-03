import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Observable, tap } from 'rxjs';

interface HttpRequest {
  method: string;
  url: string;
}

const SLOW_REQUEST_THRESHOLD_MS = 500;

@Injectable()
export class RequestTimingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(RequestTimingInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const req = context.switchToHttp().getRequest<HttpRequest>();
    const { method, url } = req;

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;

        if (duration > SLOW_REQUEST_THRESHOLD_MS) {
          this.logger.warn({ method, url, duration }, 'Slow request detected');
        }
      }),
    );
  }
}
