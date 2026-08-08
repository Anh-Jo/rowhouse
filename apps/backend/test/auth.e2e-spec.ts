import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthPrismaService } from '@/auth/auth-prisma.service';
import { MailProvider } from '@/mail/mail.provider';
import { InMemoryMailProvider } from '@/mail/in-memory-mail.provider';
import { createPGliteDatabases } from './helpers/pglite-prisma.helper';

type SignUpBody = { user?: { id?: string } };
type MeBody = { id?: string; displayName?: string };

/** Rebuilds a `Cookie` header from a supertest `set-cookie` response header. */
function cookieHeader(setCookie: string[] | undefined): string {
  return (setCookie ?? []).map((entry) => entry.split(';')[0]).join('; ');
}

describe('Auth (e2e smoke)', () => {
  let app: NestFastifyApplication;
  let prismaService: PrismaService;
  let cleanup: () => Promise<void>;

  const email = 'smoke@rowhouse.test';
  const password = 'sup3r-secret-pw';
  const name = 'Smoke Tester';

  beforeAll(async () => {
    const {
      prismaService: prisma,
      authPrismaService,
      cleanup: cleanupFn,
    } = await createPGliteDatabases();
    prismaService = prisma;
    cleanup = cleanupFn;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaService)
      .overrideProvider(AuthPrismaService)
      .useValue(authPrismaService)
      .overrideProvider(MailProvider)
      .useClass(InMemoryMailProvider)
      .compile();

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

  it('signs up, opens a session, and reaches the protected /me route', async () => {
    const signUp = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Content-Type', 'application/json')
      .send({ email, password, name });

    expect(signUp.status).toBe(200);
    const signUpBody = signUp.body as SignUpBody;
    const userId = signUpBody.user?.id;
    expect(userId).toBeDefined();

    const cookie = cookieHeader(
      signUp.headers['set-cookie'] as unknown as string[] | undefined,
    );
    expect(cookie).not.toBe('');

    // The create hook mirrored the better-auth user into the app database.
    const appUser = await prismaService.client.user.findUnique({
      where: { id: userId },
    });
    expect(appUser).not.toBeNull();
    expect(appUser?.displayName).toBe(name);

    const me = await request(app.getHttpServer())
      .get('/me')
      .set('Cookie', cookie);

    expect(me.status).toBe(200);
    const meBody = me.body as MeBody;
    expect(meBody.id).toBe(userId);
    expect(meBody.displayName).toBe(name);
  });

  it('rejects /me without a session (401)', async () => {
    await request(app.getHttpServer()).get('/me').expect(401);
  });
});
