/**
 * Envelope-encryption contracts (transverse decision D10). Every datasource
 * credential is sealed under its own DEK; DEKs are wrapped by a KEK that only
 * the KeyProvider can use. Swapping the env-based dev provider for a KMS-backed
 * one is a DI change — the data model never sees the difference.
 */

/** A DEK wrapped by the provider's KEK, plus the id of the KEK that did it. */
export type WrappedDek = {
  wrapped: Buffer;
  /** Identifies the wrapping key (e.g. `env:a1b2c3d4`) — enables rotation. */
  keyId: string;
};

export interface KeyProvider {
  /** Wraps a fresh DEK under the current KEK. */
  wrapDek(dek: Buffer): Promise<WrappedDek>;
  /**
   * Unwraps a DEK previously wrapped by the KEK identified by `keyId`.
   * Must fail loudly on an unknown keyId — never silently try another key.
   */
  unwrapDek(wrapped: Buffer, keyId: string): Promise<Buffer>;
}
