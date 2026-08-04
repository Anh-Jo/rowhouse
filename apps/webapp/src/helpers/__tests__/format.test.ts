import { describe, it, expect } from 'vitest';
import { formatNumber, formatRank } from '../format';

/** fr-FR groups with a narrow no-break space; compare on digits only. */
function digits(value: string | null): string | null {
  return value === null ? null : value.replace(/[\s  ]/g, '');
}

describe('formatNumber', () => {
  it('groups thousands', () => {
    expect(digits(formatNumber(102931))).toBe('102931');
  });

  it('leaves small numbers untouched', () => {
    expect(formatNumber(42)).toBe('42');
  });

  it('keeps at most two decimals', () => {
    expect(formatNumber(12.3456)).toBe('12,35');
  });

  it('honours an explicit locale', () => {
    expect(digits(formatNumber(102931, 'en-US'))).toBe('102,931');
  });

  it('formats zero rather than treating it as missing', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('returns null for non-finite input', () => {
    expect(formatNumber(Number.NaN)).toBeNull();
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('formatRank', () => {
  it('pads single digits to two', () => {
    expect(formatRank(1)).toBe('01');
  });

  it('leaves two digits as-is', () => {
    expect(formatRank(12)).toBe('12');
  });

  it('does not truncate ranks past 99', () => {
    expect(formatRank(101)).toBe('101');
  });

  it('truncates fractional ranks', () => {
    expect(formatRank(3.7)).toBe('03');
  });
});
