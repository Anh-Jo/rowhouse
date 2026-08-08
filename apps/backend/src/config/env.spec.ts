import { EnvStore } from './env';

const BASE_ENV = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  AUTH_DATABASE_URL: 'postgresql://user:pass@localhost:5432/auth',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3000',
  FRONTEND_URL: 'http://localhost:5173',
  // 32 zero bytes, base64 — deterministic and obviously not a real key.
  CREDENTIALS_KEK: Buffer.alloc(32).toString('base64'),
};

describe('EnvStore', () => {
  describe('init', () => {
    it('returns typed values for a valid environment', () => {
      const env = new EnvStore({
        ...BASE_ENV,
        PORT: '4000',
        SMTP_HOST: 'localhost',
        SMTP_PORT: '1025',
        SMTP_SECURE: 'true',
        LOG_LEVEL: 'warn',
        TRUST_PROXY: 'true',
        GOOGLE_CLIENT_ID: 'google-id',
        GOOGLE_CLIENT_SECRET: 'google-secret',
      }).init();

      expect(env.DATABASE_URL).toBe(BASE_ENV.DATABASE_URL);
      expect(env.AUTH_DATABASE_URL).toBe(BASE_ENV.AUTH_DATABASE_URL);
      expect(env.BETTER_AUTH_SECRET).toBe(BASE_ENV.BETTER_AUTH_SECRET);
      expect(env.BETTER_AUTH_URL).toBe(BASE_ENV.BETTER_AUTH_URL);
      expect(env.PORT).toBe(4000);
      expect(env.SMTP_PORT).toBe(1025);
      expect(env.SMTP_SECURE).toBe(true);
      expect(env.LOG_LEVEL).toBe('warn');
      expect(env.TRUST_PROXY).toBe(true);
      expect(env.GOOGLE_CLIENT_ID).toBe('google-id');
      expect(env.GOOGLE_CLIENT_SECRET).toBe('google-secret');
    });

    it('applies defaults for unset variables', () => {
      const env = new EnvStore(BASE_ENV).init();

      expect(env.PORT).toBe(3000);
      expect(env.SMTP_SECURE).toBe(false);
      expect(env.TRUST_PROXY).toBe(false);
      expect(env.MAIL_FROM).toBe('noreply@rowhouse.local');
      expect(env.SMTP_HOST).toBeUndefined();
      expect(env.LOG_LEVEL).toBeUndefined();
    });

    it('throws a readable error listing missing required variables', () => {
      expect(() => new EnvStore({}).init()).toThrow(
        /Invalid environment variables/,
      );
      expect(() => new EnvStore({}).init()).toThrow(/DATABASE_URL/);
      expect(() => new EnvStore({}).init()).toThrow(/FRONTEND_URL/);
    });

    it('treats empty strings as unset', () => {
      const env = new EnvStore({ ...BASE_ENV, PORT: '', SMTP_HOST: '' }).init();
      expect(env.PORT).toBe(3000);
      expect(env.SMTP_HOST).toBeUndefined();

      expect(() =>
        new EnvStore({ ...BASE_ENV, DATABASE_URL: '' }).init(),
      ).toThrow(/DATABASE_URL/);
    });

    it('rejects invalid values', () => {
      expect(() =>
        new EnvStore({ ...BASE_ENV, PORT: 'not-a-number' }).init(),
      ).toThrow(/PORT/);
      expect(() =>
        new EnvStore({ ...BASE_ENV, LOG_LEVEL: 'verbose' }).init(),
      ).toThrow(/LOG_LEVEL/);
      expect(() =>
        new EnvStore({ ...BASE_ENV, TRUST_PROXY: 'maybe' }).init(),
      ).toThrow(/TRUST_PROXY/);
      expect(() =>
        new EnvStore({ ...BASE_ENV, BETTER_AUTH_SECRET: 'too-short' }).init(),
      ).toThrow(/BETTER_AUTH_SECRET/);
      expect(() =>
        new EnvStore({ ...BASE_ENV, BETTER_AUTH_URL: 'not-a-url' }).init(),
      ).toThrow(/BETTER_AUTH_URL/);
      expect(() =>
        new EnvStore({ ...BASE_ENV, FRONTEND_URL: 'not-a-url' }).init(),
      ).toThrow(/FRONTEND_URL/);
    });

    it('ignores unknown variables', () => {
      const env = new EnvStore({ ...BASE_ENV, UNRELATED_VAR: 'x' }).init();
      expect(env).not.toHaveProperty('UNRELATED_VAR');
    });
  });

  describe('get', () => {
    it('returns typed values after init()', () => {
      const store = new EnvStore({
        ...BASE_ENV,
        PORT: '4000',
        SMTP_SECURE: 'true',
      });
      store.init();

      expect(store.get('DATABASE_URL')).toBe(BASE_ENV.DATABASE_URL);
      expect(store.get('PORT')).toBe(4000);
      expect(store.get('SMTP_SECURE')).toBe(true);
      expect(store.get('SMTP_HOST')).toBeUndefined();
    });

    it('lazily initializes when init() was not called', () => {
      const store = new EnvStore({ ...BASE_ENV, PORT: '5000' });
      expect(store.get('PORT')).toBe(5000);
    });

    it('parses only once and caches the result', () => {
      const source = { ...BASE_ENV, PORT: '5000' };
      const store = new EnvStore(source);
      expect(store.get('PORT')).toBe(5000);

      source.PORT = '6000';
      expect(store.get('PORT')).toBe(5000);
    });
  });
});
