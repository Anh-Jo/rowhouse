import { CredentialVault } from './credential-vault.service';
import { seal, unseal } from './envelope';
import type { KeyProvider } from './vault.d.ts';

/** In-memory KeyProvider: wraps DEKs under a fixed test KEK. */
function fakeKeyProvider(kek = Buffer.alloc(32, 9)): KeyProvider {
  return {
    wrapDek: (dek) =>
      Promise.resolve({ wrapped: seal(dek, kek), keyId: 'test:kek' }),
    unwrapDek: (wrapped, keyId) =>
      keyId === 'test:kek'
        ? Promise.resolve(unseal(wrapped, kek))
        : Promise.reject(new Error(`unknown key id ${keyId}`)),
  };
}

describe('CredentialVault', () => {
  it('round-trips a secret through seal and open', async () => {
    const vault = new CredentialVault(fakeKeyProvider());

    const sealed = await vault.sealSecret('hunter2');

    expect(sealed.dekKeyId).toBe('test:kek');
    await expect(vault.openSecret(sealed)).resolves.toBe('hunter2');
  });

  it('never persists the plaintext in any sealed field', async () => {
    const vault = new CredentialVault(fakeKeyProvider());

    const sealed = await vault.sealSecret('super-secret-password');

    expect(sealed.secretSealed.includes('super-secret-password')).toBe(false);
    expect(sealed.dekWrapped.includes('super-secret-password')).toBe(false);
  });

  it('isolates DEKs: one credential cannot be opened with another one’s DEK', async () => {
    const vault = new CredentialVault(fakeKeyProvider());

    const first = await vault.sealSecret('first-secret');
    const second = await vault.sealSecret('second-secret');

    // Same sealed payload, other credential's wrapped DEK: GCM must reject.
    await expect(
      vault.openSecret({ ...first, dekWrapped: second.dekWrapped }),
    ).rejects.toThrow();
  });

  it('propagates a KeyProvider refusal instead of guessing', async () => {
    const vault = new CredentialVault(fakeKeyProvider());
    const sealed = await vault.sealSecret('secret');

    await expect(
      vault.openSecret({ ...sealed, dekKeyId: 'env:deadbeef' }),
    ).rejects.toThrow(/unknown key id/);
  });
});
