import {
  DEK_LENGTH,
  generateDek,
  keyFingerprint,
  seal,
  unseal,
} from './envelope';

describe('envelope', () => {
  it('round-trips a secret under a DEK', () => {
    const dek = generateDek();
    const sealed = seal(Buffer.from('s3cret-password'), dek);

    expect(unseal(sealed, dek).toString('utf8')).toBe('s3cret-password');
  });

  it('generates a fresh 32-byte DEK per call', () => {
    const first = generateDek();
    const second = generateDek();

    expect(first).toHaveLength(DEK_LENGTH);
    expect(first.equals(second)).toBe(false);
  });

  it('produces a different ciphertext for the same plaintext (fresh IV)', () => {
    const dek = generateDek();
    const one = seal(Buffer.from('same'), dek);
    const two = seal(Buffer.from('same'), dek);

    expect(one.equals(two)).toBe(false);
  });

  it('rejects a wrong DEK (GCM auth)', () => {
    const sealed = seal(Buffer.from('secret'), generateDek());

    expect(() => unseal(sealed, generateDek())).toThrow();
  });

  it('rejects a tampered ciphertext', () => {
    const dek = generateDek();
    const sealed = seal(Buffer.from('secret'), dek);
    sealed[sealed.length - 20] ^= 0xff;

    expect(() => unseal(sealed, dek)).toThrow();
  });

  it('fingerprints a key stably and shortly', () => {
    const key = Buffer.alloc(32, 7);

    expect(keyFingerprint(key)).toBe(keyFingerprint(Buffer.alloc(32, 7)));
    expect(keyFingerprint(key)).toHaveLength(8);
    expect(keyFingerprint(key)).not.toBe(keyFingerprint(Buffer.alloc(32, 8)));
  });
});
