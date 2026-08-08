import { Inject, Injectable } from '@nestjs/common';
import { KEY_PROVIDER } from './env-key-provider';
import { generateDek, seal, unseal } from './envelope';
import type { KeyProvider } from './vault.d.ts';

/** The three sealed fields persisted on a DatasourceCredential row. */
export type SealedSecret = {
  secretSealed: Buffer;
  dekWrapped: Buffer;
  dekKeyId: string;
};

/**
 * Seals and opens credential secrets (envelope encryption, decision D10).
 * One fresh DEK per seal — compromising one credential's DEK never exposes
 * another. Plaintext only ever exists in memory, just-in-time: callers use
 * the buffer and drop it, never persist or log it.
 */
@Injectable()
export class CredentialVault {
  constructor(
    @Inject(KEY_PROVIDER) private readonly keyProvider: KeyProvider,
  ) {}

  async sealSecret(plaintext: string): Promise<SealedSecret> {
    const dek = generateDek();
    const { wrapped, keyId } = await this.keyProvider.wrapDek(dek);
    return {
      secretSealed: seal(Buffer.from(plaintext, 'utf8'), dek),
      dekWrapped: wrapped,
      dekKeyId: keyId,
    };
  }

  async openSecret(sealed: SealedSecret): Promise<string> {
    const dek = await this.keyProvider.unwrapDek(
      sealed.dekWrapped,
      sealed.dekKeyId,
    );
    return unseal(sealed.secretSealed, dek).toString('utf8');
  }
}
