// better-auth ships ESM only; the CJS unit-test runner can't load its real
// plugin modules. Mock the plugin factories at the boundary — the code under
// test (buildAuthOptions) and its closures still run for real. Each mock echoes
// the options it receives so the config passed to the plugin can be asserted.
jest.mock('better-auth/plugins', () => ({
  emailOTP: (options: unknown) => ({ id: 'email-otp', options }),
  organization: (options: unknown) => ({ id: 'organization', options }),
}));

import type { BetterAuthOptions } from 'better-auth';
import { buildAuthOptions } from './auth-options';
import type {
  AuthHooksPort,
  BuildAuthOptionsParams,
  PrismaDatabaseAdapter,
} from './auth.d.ts';

/** Minimal emailOTP plugin surface the config exposes its callback through. */
type EmailOtpPlugin = {
  id: string;
  options: {
    otpLength: number;
    expiresIn: number;
    sendVerificationOTP: (args: {
      email: string;
      otp: string;
      type: 'email-verification' | 'sign-in' | 'forget-password';
    }) => Promise<void>;
  };
};

function buildParams(overrides: Partial<BuildAuthOptionsParams> = {}) {
  // Standalone mock refs (not typed methods on an object) so assertions don't
  // trip @typescript-eslint/unbound-method.
  const handleUserCreated = jest.fn().mockResolvedValue(undefined);
  const handleUserDeleted = jest.fn().mockResolvedValue(undefined);
  const sendResetOtp = jest.fn().mockResolvedValue(undefined);
  const hooks: AuthHooksPort = { handleUserCreated, handleUserDeleted };
  const params: BuildAuthOptionsParams = {
    database: {} as PrismaDatabaseAdapter,
    secret: 'a'.repeat(32),
    baseURL: 'http://localhost:3000',
    frontendUrl: 'http://localhost:5173',
    hooks,
    sendResetOtp,
    trustProxy: false,
    ...overrides,
  };
  return { params, handleUserCreated, handleUserDeleted, sendResetOtp };
}

function emailOtpPlugin(options: BetterAuthOptions): EmailOtpPlugin {
  const plugin = (options.plugins ?? []).find(
    (p): p is EmailOtpPlugin => (p as { id?: string }).id === 'email-otp',
  );
  if (!plugin) {
    throw new Error('email-otp plugin not found in auth options');
  }
  return plugin;
}

describe('buildAuthOptions', () => {
  it('wires the injected database, secret and base URL', () => {
    const { params } = buildParams();
    const options = buildAuthOptions(params);

    expect(options.appName).toBe('Rowhouse');
    expect(options.secret).toBe(params.secret);
    expect(options.baseURL).toBe(params.baseURL);
    expect(options.database).toBe(params.database);
  });

  it('trusts the frontend origin', () => {
    const options = buildAuthOptions(buildParams().params);
    expect(options.trustedOrigins).toEqual(['http://localhost:5173']);
  });

  it('registers the organization plugin (workspaces, decision D9)', () => {
    const options = buildAuthOptions(buildParams().params);
    const ids = (options.plugins ?? []).map((p) => (p as { id?: string }).id);
    expect(ids).toContain('organization');
  });

  it('enables email/password auth and self-service account deletion', () => {
    const options = buildAuthOptions(buildParams().params);

    expect(options.emailAndPassword?.enabled).toBe(true);
    expect(options.user?.deleteUser?.enabled).toBe(true);
  });

  it('revokes other sessions on a password reset', () => {
    const options = buildAuthOptions(buildParams().params);

    expect(options.emailAndPassword?.revokeSessionsOnPasswordReset).toBe(true);
  });

  describe('Google SSO', () => {
    it('registers the google social provider when credentials are provided', () => {
      const google = { clientId: 'gid', clientSecret: 'gsecret' };
      const options = buildAuthOptions(buildParams({ google }).params);

      expect(options.socialProviders?.google).toEqual(google);
    });

    it('leaves social providers disabled when no google credentials are set', () => {
      const options = buildAuthOptions(buildParams().params);

      expect(options.socialProviders).toBeUndefined();
    });
  });

  describe('proxy IP trust', () => {
    it('trusts the forwarded header when trustProxy is enabled', () => {
      const options = buildAuthOptions(
        buildParams({ trustProxy: true }).params,
      );

      expect(options.advanced?.ipAddress?.ipAddressHeaders).toEqual([
        'x-forwarded-for',
      ]);
    });

    it('does not configure ipAddress trust by default', () => {
      const options = buildAuthOptions(buildParams().params);

      expect(options.advanced).toBeUndefined();
    });
  });

  it('caches the session in a signed cookie (5 min) and rate-limits', () => {
    const options = buildAuthOptions(buildParams().params);

    expect(options.session?.cookieCache?.enabled).toBe(true);
    expect(options.session?.cookieCache?.maxAge).toBe(5 * 60);
    expect(options.rateLimit).toEqual({ window: 10, max: 100 });
  });

  it('configures the email-otp plugin with a 6-digit / 10-min code', () => {
    const options = buildAuthOptions(buildParams().params);
    const plugin = emailOtpPlugin(options);

    expect(plugin.options.otpLength).toBe(6);
    expect(plugin.options.expiresIn).toBe(10 * 60);
  });

  describe('databaseHooks.user', () => {
    it('mirrors a created better-auth user through handleUserCreated', async () => {
      const { params, handleUserCreated } = buildParams();
      const options = buildAuthOptions(params);

      const createAfter = options.databaseHooks?.user?.create?.after;
      expect(createAfter).toBeDefined();
      await createAfter!(
        { id: 'user-1', name: 'Ada Lovelace' } as never,
        undefined as never,
      );

      expect(handleUserCreated).toHaveBeenCalledWith({
        id: 'user-1',
        name: 'Ada Lovelace',
      });
    });

    it('deletes the orphan auth user and re-throws when the app mirror fails', async () => {
      const failure = new Error('app db down');
      const { params, handleUserCreated } = buildParams();
      handleUserCreated.mockRejectedValueOnce(failure);
      const options = buildAuthOptions(params);

      const deleteUser = jest.fn().mockResolvedValue(undefined);
      const context = { context: { internalAdapter: { deleteUser } } };

      const createAfter = options.databaseHooks?.user?.create?.after;
      await expect(
        createAfter!({ id: 'user-9', name: 'Boom' } as never, context as never),
      ).rejects.toBe(failure);

      expect(deleteUser).toHaveBeenCalledWith('user-9');
    });

    it('still re-throws the mirror failure when no context is available', async () => {
      const failure = new Error('app db down');
      const { params, handleUserCreated } = buildParams();
      handleUserCreated.mockRejectedValueOnce(failure);
      const options = buildAuthOptions(params);

      const createAfter = options.databaseHooks?.user?.create?.after;
      await expect(
        createAfter!({ id: 'user-9', name: 'Boom' } as never, null as never),
      ).rejects.toBe(failure);
    });

    it('cleans up a deleted better-auth user through handleUserDeleted', async () => {
      const { params, handleUserDeleted } = buildParams();
      const options = buildAuthOptions(params);

      const deleteBefore = options.databaseHooks?.user?.delete?.before;
      expect(deleteBefore).toBeDefined();
      await deleteBefore!({ id: 'user-2' } as never, undefined as never);

      expect(handleUserDeleted).toHaveBeenCalledWith({ id: 'user-2' });
    });
  });

  describe('emailOTP.sendVerificationOTP', () => {
    it('sends the reset code through MailService for the forget-password type', async () => {
      const { params, sendResetOtp } = buildParams();
      const plugin = emailOtpPlugin(buildAuthOptions(params));

      await plugin.options.sendVerificationOTP({
        email: 'user@rowhouse.test',
        otp: '123456',
        type: 'forget-password',
      });

      expect(sendResetOtp).toHaveBeenCalledWith('user@rowhouse.test', '123456');
    });

    it('ignores non password-reset OTP types', async () => {
      const { params, sendResetOtp } = buildParams();
      const plugin = emailOtpPlugin(buildAuthOptions(params));

      await plugin.options.sendVerificationOTP({
        email: 'user@rowhouse.test',
        otp: '654321',
        type: 'sign-in',
      });
      await plugin.options.sendVerificationOTP({
        email: 'user@rowhouse.test',
        otp: '654321',
        type: 'email-verification',
      });

      expect(sendResetOtp).not.toHaveBeenCalled();
    });
  });
});
