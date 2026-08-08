import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthPrismaService } from '@/auth/auth-prisma.service';
import { createPGliteDatabases } from './helpers/pglite-prisma.helper';

describe('AppController (e2e)', () => {
  let app: NestFastifyApplication;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const {
      prismaService,
      authPrismaService,
      cleanup: cleanupFn,
    } = await createPGliteDatabases();
    cleanup = cleanupFn;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaService)
      .overrideProvider(AuthPrismaService)
      .useValue(authPrismaService)
      .compile();

    // Fastify adapter, like production main.ts — the auth catch-all route
    // (`api/auth/*`) relies on Fastify's wildcard syntax.
    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
    await cleanup();
  });

  it('/ (GET) is public', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({ message: 'Hello World!' });
  });

  it('/me (GET) requires a session (protected by default)', () => {
    return request(app.getHttpServer()).get('/me').expect(401);
  });
});
