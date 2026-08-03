import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap, catchError } from 'rxjs';
import { MetricsService } from './metrics.service';

interface HttpRequest {
  method: string;
  url: string;
  // Fastify exposes the matched route pattern (e.g. /users/:id) here
  routeOptions?: { url?: string };
}

interface HttpResponse {
  statusCode: number;
}

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<HttpRequest>();
    const method = req.method;
    // Prefer the route pattern over the raw URL to keep label cardinality low
    const route = req.routeOptions?.url ?? req.url;
    const start = performance.now();

    return next.handle().pipe(
      tap(() => {
        const duration = (performance.now() - start) / 1000;
        const statusCode = context
          .switchToHttp()
          .getResponse<HttpResponse>().statusCode;
        this.metrics.recordHttpRequest(method, route, statusCode, duration);
      }),
      catchError((error: unknown) => {
        const duration = (performance.now() - start) / 1000;
        const statusCode =
          error instanceof HttpException ? error.getStatus() : 500;
        this.metrics.recordHttpRequest(method, route, statusCode, duration);
        throw error;
      }),
    );
  }
}
