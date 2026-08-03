import { describe, expect, it } from 'vitest';
import {
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validateEmail,
  validateName,
  validatePassword,
} from '../validation';

describe('validateEmail', () => {
  it('accepts a standard address', () => {
    expect(validateEmail('ada@example.com')).toBe(true);
  });

  it('accepts an address with surrounding whitespace (trimmed before submit)', () => {
    expect(validateEmail('  ada@example.com  ')).toBe(true);
  });

  it('rejects an empty value as required', () => {
    expect(validateEmail('')).toBe('Email is required');
    expect(validateEmail('   ')).toBe('Email is required');
  });

  it.each(['not-an-email', 'missing@tld', '@example.com', 'a b@example.com'])(
    'rejects malformed address %s',
    (value) => {
      expect(validateEmail(value)).toBe('Enter a valid email address');
    },
  );
});

describe('validatePassword', () => {
  it('accepts a password at the minimum length', () => {
    expect(validatePassword('a'.repeat(PASSWORD_MIN_LENGTH))).toBe(true);
  });

  it('rejects an empty password as required', () => {
    expect(validatePassword('')).toBe('Password is required');
  });

  it('rejects a password below the minimum length', () => {
    expect(validatePassword('a'.repeat(PASSWORD_MIN_LENGTH - 1))).toBe(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    );
  });

  it('rejects a password above the maximum length', () => {
    expect(validatePassword('a'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe(
      `Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
    );
  });
});

describe('validateName', () => {
  it('accepts a non-empty name', () => {
    expect(validateName('Ada Lovelace')).toBe(true);
  });

  it('rejects blank names as required', () => {
    expect(validateName('')).toBe('Name is required');
    expect(validateName('   ')).toBe('Name is required');
  });

  it('rejects names above the maximum length', () => {
    expect(validateName('a'.repeat(NAME_MAX_LENGTH + 1))).toBe(
      `Name must be at most ${NAME_MAX_LENGTH} characters`,
    );
  });
});
