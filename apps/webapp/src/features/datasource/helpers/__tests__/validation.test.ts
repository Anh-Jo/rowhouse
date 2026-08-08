import { describe, expect, it } from 'vitest';
import {
  isReadOnlyCanWriteProblem,
  validatePort,
  validateRequired,
} from '../validation';

describe('validateRequired', () => {
  const validate = validateRequired('Host');

  it('rejects empty and whitespace-only values', () => {
    expect(validate('')).toBe('Host is required');
    expect(validate('   ')).toBe('Host is required');
  });

  it('rejects values above 200 characters', () => {
    expect(validate('a'.repeat(201))).toBe(
      'Host must be at most 200 characters',
    );
  });

  it('accepts a normal value', () => {
    expect(validate('db.example.com')).toBe(true);
  });
});

describe('validatePort', () => {
  it('rejects an empty value', () => {
    expect(validatePort('')).toBe('Port is required');
  });

  it('rejects non-integer and out-of-range values', () => {
    expect(validatePort('abc')).toBe(
      'Port must be an integer between 1 and 65535',
    );
    expect(validatePort('54.32')).toBe(
      'Port must be an integer between 1 and 65535',
    );
    expect(validatePort('0')).toBe(
      'Port must be an integer between 1 and 65535',
    );
    expect(validatePort('70000')).toBe(
      'Port must be an integer between 1 and 65535',
    );
  });

  it('accepts a valid port', () => {
    expect(validatePort('5432')).toBe(true);
  });
});

describe('isReadOnlyCanWriteProblem', () => {
  it('detects the guardrail failure wording', () => {
    expect(
      isReadOnlyCanWriteProblem(
        'The read-only role can write to the database.',
      ),
    ).toBe(true);
    expect(
      isReadOnlyCanWriteProblem('read_only role was able to INSERT a row'),
    ).toBe(true);
  });

  it('leaves other problems alone', () => {
    expect(isReadOnlyCanWriteProblem('Host unreachable')).toBe(false);
    expect(
      isReadOnlyCanWriteProblem('Invalid password for the read-only role'),
    ).toBe(false);
  });
});
