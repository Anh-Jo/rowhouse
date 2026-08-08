import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'node:crypto';

/** AES-256-GCM layout constants for the single sealed column. */
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
export const DEK_LENGTH = 32;

/** Generates a fresh per-credential data-encryption key. */
export function generateDek(): Buffer {
  return randomBytes(DEK_LENGTH);
}

/**
 * Seals a plaintext under a DEK. Output layout: IV || ciphertext || tag in a
 * single buffer, so storage stays one opaque column and the layout is a code
 * constant instead of three schema fields.
 */
export function seal(plaintext: Buffer, dek: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', dek, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, ciphertext, cipher.getAuthTag()]);
}

/** Opens a sealed buffer. Throws on tampering or a wrong DEK (GCM auth). */
export function unseal(sealed: Buffer, dek: Buffer): Buffer {
  const iv = sealed.subarray(0, IV_LENGTH);
  const tag = sealed.subarray(sealed.length - TAG_LENGTH);
  const ciphertext = sealed.subarray(IV_LENGTH, sealed.length - TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', dek, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Short stable fingerprint of a key, safe to store and log as a key id. */
export function keyFingerprint(key: Buffer): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 8);
}
