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

/** Rebuilds a `Cookie` header from a supertest `set-cookie` response header. */
function cookieHeader(setCookie: string[] | undefined): string {
  return (setCookie ?? []).map((entry) => entry.split(';')[0]).join('; ');
}

describe('Auth password flows (e2e)', () => {
  let app: NestFastifyApplication;
  let prismaService: PrismaService;
  let authPrismaService: AuthPrismaService;
  let mail: InMemoryMailProvider;
  let cleanup: () => Promise<void>;

  async function signUp(email: string, password: string, name: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Content-Type', 'application/json')
      .send({ email, password, name });
    const cookie = cookieHeader(
      res.headers['set-cookie'] as unknown as string[] | undefined,
    );
    const userId = (res.body as { user?: { id?: string } }).user?.id;
    return { res, cookie, userId };
  }

  function signIn(email: string, password: string) {
    return request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .set('Content-Type', 'application/json')
      .send({ email, password });
  }

  /** Polls the in-memory mailbox for the latest 6-digit reset code sent to `to`. */
  async function waitForResetOtp(to: string): Promise<string> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const mailForTarget = [...mail.sentMails]
        .reverse()
        .find((m) => m.to === to);
      const match = /\b(\d{6})\b/.exec(mailForTarget?.text ?? '');
      if (match) {
        return match[1];
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`No reset OTP captured for ${to}`);
  }

  beforeAll(async () => {
    const {
      prismaService: prisma,
      authPrismaService: authPrisma,
      cleanup: cleanupFn,
    } = await createPGliteDatabases();
    prismaService = prisma;
    authPrismaService = authPrisma;
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

    mail = app.get(MailProvider);
  });

  afterAll(async () => {
    await app.close();
    await cleanup();
  });

  describe('sign-in errors are indistinguishable (non-enumeration)', () => {
    const email = 'signin@rowhouse.test';
    const password = 'sup3r-secret-pw';

    beforeAll(async () => {
      await signUp(email, password, 'Sign In User');
    });

    it('rejects a wrong password and an unknown email with the same status and message', async () => {
      const wrongPassword = await signIn(email, 'not-the-password');
      const unknownEmail = await signIn('nobody@rowhouse.test', password);

      expect(wrongPassword.status).toBeGreaterThanOrEqual(400);
      expect(unknownEmail.status).toBe(wrongPassword.status);

      const wrongMessage = (wrongPassword.body as { message?: string }).message;
      const unknownMessage = (unknownEmail.body as { message?: string })
        .message;
      expect(wrongMessage).toBeDefined();
      expect(unknownMessage).toBe(wrongMessage);
    });

    it('accepts the correct credentials', async () => {
      const ok = await signIn(email, password);
      expect(ok.status).toBe(200);
    });
  });

  describe('forgot-password does not reveal account existence', () => {
    it('returns the same status for a known and an unknown email', async () => {
      await signUp('known@rowhouse.test', 'sup3r-secret-pw', 'Known User');

      const known = await request(app.getHttpServer())
        .post('/api/auth/email-otp/request-password-reset')
        .set('Content-Type', 'application/json')
        .send({ email: 'known@rowhouse.test' });
      const unknown = await request(app.getHttpServer())
        .post('/api/auth/email-otp/request-password-reset')
        .set('Content-Type', 'application/json')
        .send({ email: 'ghost@rowhouse.test' });

      expect(known.status).toBeLessThan(400);
      expect(unknown.status).toBe(known.status);
    });
  });

  describe('OTP password reset', () => {
    const oldPassword = 'old-secret-pw-01';
    const newPassword = 'new-secret-pw-02';

    it('lets the new password sign in and rejects the old one', async () => {
      const email = 'reset@rowhouse.test';
      await signUp(email, oldPassword, 'Reset User');

      // Trigger the reset code and read it from the captured email.
      await request(app.getHttpServer())
        .post('/api/auth/email-otp/request-password-reset')
        .set('Content-Type', 'application/json')
        .send({ email });
      const otp = await waitForResetOtp(email);

      const reset = await request(app.getHttpServer())
        .post('/api/auth/email-otp/reset-password')
        .set('Content-Type', 'application/json')
        .send({ email, otp, password: newPassword });
      expect(reset.status).toBeLessThan(400);

      expect((await signIn(email, newPassword)).status).toBe(200);
      expect((await signIn(email, oldPassword)).status).toBeGreaterThanOrEqual(
        400,
      );
    });

    // Security requirement: resetting the password must revoke every other
    // active session, so a stolen/leftover cookie cannot survive the reset.
    // Enforced via `emailAndPassword.revokeSessionsOnPasswordReset` (honored by
    // the emailOTP reset-password route in better-auth >=1.6).
    it('revokes pre-reset sessions on password reset', async () => {
      const revokeEmail = 'revoke@rowhouse.test';
      const { cookie: oldCookie, userId } = await signUp(
        revokeEmail,
        oldPassword,
        'Revoke User',
      );

      await request(app.getHttpServer())
        .post('/api/auth/email-otp/request-password-reset')
        .set('Content-Type', 'application/json')
        .send({ email: revokeEmail });
      const otp = await waitForResetOtp(revokeEmail);

      await request(app.getHttpServer())
        .post('/api/auth/email-otp/reset-password')
        .set('Content-Type', 'application/json')
        .send({ email: revokeEmail, otp, password: newPassword });

      // Expected: the auth-db session is gone…
      const sessionsAfter = await authPrismaService.client.session.count({
        where: { userId: userId! },
      });
      expect(sessionsAfter).toBe(0);

      // …and the pre-reset cookie no longer authenticates.
      await request(app.getHttpServer())
        .get('/me')
        .set('Cookie', oldCookie)
        .expect(401);
    });

    it('rejects a wrong OTP and a replayed OTP', async () => {
      const replayEmail = 'replay@rowhouse.test';
      await signUp(replayEmail, 'old-secret-pw-01', 'Replay User');

      await request(app.getHttpServer())
        .post('/api/auth/email-otp/request-password-reset')
        .set('Content-Type', 'application/json')
        .send({ email: replayEmail });
      const otp = await waitForResetOtp(replayEmail);

      // Wrong code is refused.
      const wrong = await request(app.getHttpServer())
        .post('/api/auth/email-otp/reset-password')
        .set('Content-Type', 'application/json')
        .send({ email: replayEmail, otp: '000000', password: 'whatever-pw-1' });
      expect(wrong.status).toBeGreaterThanOrEqual(400);

      // First valid use succeeds, replay of the same code fails.
      const first = await request(app.getHttpServer())
        .post('/api/auth/email-otp/reset-password')
        .set('Content-Type', 'application/json')
        .send({ email: replayEmail, otp, password: 'fresh-secret-pw-2' });
      expect(first.status).toBeLessThan(400);

      const replay = await request(app.getHttpServer())
        .post('/api/auth/email-otp/reset-password')
        .set('Content-Type', 'application/json')
        .send({ email: replayEmail, otp, password: 'another-secret-pw-3' });
      expect(replay.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('account deletion', () => {
    it('deletes the app User row when the password is correct', async () => {
      const email = 'delete-ok@rowhouse.test';
      const password = 'delete-me-please1';
      const { cookie, userId } = await signUp(email, password, 'Delete Me');

      expect(
        await prismaService.client.user.findUnique({ where: { id: userId! } }),
      ).not.toBeNull();

      const res = await request(app.getHttpServer())
        .post('/api/auth/delete-user')
        .set('Content-Type', 'application/json')
        .set('Cookie', cookie)
        .send({ password });
      expect(res.status).toBeLessThan(400);

      expect(
        await prismaService.client.user.findUnique({ where: { id: userId! } }),
      ).toBeNull();
    });

    it('refuses deletion with a wrong password and keeps the app User row', async () => {
      const email = 'delete-ko@rowhouse.test';
      const password = 'keep-me-around-1';
      const { cookie, userId } = await signUp(email, password, 'Keep Me');

      const res = await request(app.getHttpServer())
        .post('/api/auth/delete-user')
        .set('Content-Type', 'application/json')
        .set('Cookie', cookie)
        .send({ password: 'wrong-password-99' });
      expect(res.status).toBeGreaterThanOrEqual(400);

      expect(
        await prismaService.client.user.findUnique({ where: { id: userId! } }),
      ).not.toBeNull();
    });
  });
});
