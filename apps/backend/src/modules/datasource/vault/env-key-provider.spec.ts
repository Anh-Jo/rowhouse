const getMock = jest.fn();
jest.mock('@/config/env', () => ({ env: { get: getMock } }));

import { EnvKeyProvider } from './env-key-provider';
import { generateDek } from './envelope';

const KEK_A = Buffer.alloc(32, 1).toString('base64');
const KEK_B = Buffer.alloc(32, 2).toString('base64');

describe('EnvKeyProvider', () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockReturnValue(KEK_A);
  });

  it('wraps and unwraps a DEK under the env KEK', async () => {
    const provider = new EnvKeyProvider();
    const dek = generateDek();

    const { wrapped, keyId } = await provider.wrapDek(dek);

    expect(keyId).toMatch(/^env:[0-9a-f]{8}$/);
    expect(wrapped.equals(dek)).toBe(false);
    await expect(provider.unwrapDek(wrapped, keyId)).resolves.toEqual(dek);
  });

  it('refuses to unwrap under a different KEK — fails loudly, no silent retry', async () => {
    const providerA = new EnvKeyProvider();
    const { wrapped, keyId } = await providerA.wrapDek(generateDek());

    getMock.mockReturnValue(KEK_B);
    const providerB = new EnvKeyProvider();

    await expect(providerB.unwrapDek(wrapped, keyId)).rejects.toThrow(
      /does not match the key that sealed this credential/,
    );
  });

  it('reads the KEK lazily, once', async () => {
    const provider = new EnvKeyProvider();
    expect(getMock).not.toHaveBeenCalled();

    await provider.wrapDek(generateDek());
    await provider.wrapDek(generateDek());

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith('CREDENTIALS_KEK');
  });
});
