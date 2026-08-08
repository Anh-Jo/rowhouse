import { Injectable } from '@nestjs/common';
import { env } from '@/config/env';
import { keyFingerprint, seal, unseal } from './envelope';
import type { KeyProvider, WrappedDek } from './vault.d.ts';

/** DI token so the KMS-backed production provider is a binding change only. */
export const KEY_PROVIDER = Symbol('KEY_PROVIDER');

/**
 * P0 KeyProvider: the KEK comes from `CREDENTIALS_KEK` (env, decision D10) —
 * the local fallback of the starter's "external providers have a local
 * fallback" rule. Wrapping reuses the same AES-256-GCM envelope as the data
 * layer; the keyId pins the KEK fingerprint so a rotated or wrong KEK fails
 * loudly instead of producing garbage.
 */
@Injectable()
export class EnvKeyProvider implements KeyProvider {
  private kek: Buffer | null = null;
  private kekId: string | null = null;

  /** Lazy: env is read at first use (runtime), never at decoration time. */
  private materialize(): { kek: Buffer; kekId: string } {
    if (!this.kek || !this.kekId) {
      this.kek = Buffer.from(env.get('CREDENTIALS_KEK'), 'base64');
      this.kekId = `env:${keyFingerprint(this.kek)}`;
    }
    return { kek: this.kek, kekId: this.kekId };
  }

  wrapDek(dek: Buffer): Promise<WrappedDek> {
    const { kek, kekId } = this.materialize();
    return Promise.resolve({ wrapped: seal(dek, kek), keyId: kekId });
  }

  unwrapDek(wrapped: Buffer, keyId: string): Promise<Buffer> {
    const { kek, kekId } = this.materialize();
    if (keyId !== kekId) {
      return Promise.reject(
        new Error(
          `Unknown credential key id "${keyId}" — the KEK in CREDENTIALS_KEK does not match the key that sealed this credential`,
        ),
      );
    }
    return Promise.resolve(unseal(wrapped, kek));
  }
}
