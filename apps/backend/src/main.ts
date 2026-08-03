import 'dotenv/config';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { Logger } from 'nestjs-pino';
import type { FastifyRequest } from 'fastify';
import { env } from '@/config/env';
import { AppModule } from './app.module';

// Swagger UI (/api-docs) exposes the full REST surface; keep it out of
// production. (NODE_ENV is the one env var read directly — see the eslint
// guardrail exception.)
const isProduction = process.env['NODE_ENV'] === 'production';

/** Paths exempt from the global rate limit (liveness/scrape probes). */
const RATE_LIMIT_ALLOWLIST = new Set(['/health', '/metrics']);

async function bootstrap() {
  env.init();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // `trustProxy` (enabled in prod behind the reverse proxy) makes `req.ip`
    // resolve from `X-Forwarded-For`, so the rate limit keys on the real
    // client IP instead of the proxy socket.
    new FastifyAdapter({ trustProxy: env.get('TRUST_PROXY') }),
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));

  // Global rate limit running as a Fastify onRequest hook — it counts requests
  // before routing/parsing, which the route-level throttler guard cannot see.
  // Probes are exempt.
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    // Match on the pathname only — a query string (e.g. `/health?check=db`
    // from a probe) must not fold the request back into the shared budget.
    allowList: (req: FastifyRequest) =>
      RATE_LIMIT_ALLOWLIST.has(req.url.split('?')[0]),
  });

  // Multipart parsing for file-upload routes (see `parseSingleFileUpload` in
  // src/helpers/multipart.ts). One file per request, 10 MB cap; the text-field
  // caps bound sibling fields buffered before Zod validation runs. JSON routes
  // are unaffected.
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1,
      fieldSize: 1024 * 1024,
      fields: 10,
      parts: 15,
    },
  });

  app.enableCors({
    origin: env.get('FRONTEND_URL'),
    credentials: true,
  });

  // Contracts for codegen are exported by scripts/generate-contracts.ts, not
  // here; this only mounts the live Swagger UI, which we never expose in
  // production.
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Rowhouse API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api-docs', app, cleanupOpenApiDoc(document));
  }

  await app.listen(env.get('PORT'), '0.0.0.0');
}
void bootstrap();
