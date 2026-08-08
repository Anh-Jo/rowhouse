import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthGuard } from './auth/auth.guard';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { PrismaQueryLogger } from './interceptors/prisma-query-logger.service';
import { RequestTimingInterceptor } from './interceptors/request-timing.interceptor';
import { LoggerModule } from './logger/logger.module';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { DatasourceModule } from './modules/datasource/datasource.module';
import { IntrospectionModule } from './modules/introspection/introspection.module';
import { ProjectModule } from './modules/project/project.module';
import { MetricsInterceptor } from './modules/metrics/metrics.interceptor';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    LoggerModule,
    PrismaModule,
    AuthModule,
    AuditModule,
    HealthModule,
    MetricsModule,
    ProjectModule,
    DatasourceModule,
    IntrospectionModule,
    ThrottlerModule.forRoot({
      skipIf: () => process.env['NODE_ENV'] === 'test',
      throttlers: [{ ttl: 60_000, limit: 60 }],
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaQueryLogger,
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Both global guards are declared here, in execution order: the throttler
    // runs before the auth guard so unauthenticated traffic is still rate
    // limited. Keep this order — moving a registration changes it.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestTimingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
})
export class AppModule {}
