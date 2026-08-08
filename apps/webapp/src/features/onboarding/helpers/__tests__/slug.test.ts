import { describe, expect, it } from 'vitest';
import { slugify } from '../slug';

describe('slugify', () => {
  it('lowercases and dashes a plain name', () => {
    expect(slugify('Acme Corp')).toBe('acme-corp');
  });

  it('strips diacritics', () => {
    expect(slugify('Café Métro')).toBe('cafe-metro');
  });

  it('collapses consecutive separators and trims edge dashes', () => {
    expect(slugify('  Acme --  Corp!  ')).toBe('acme-corp');
  });

  it('falls back when nothing usable remains', () => {
    expect(slugify('🚀🚀🚀')).toBe('workspace');
    expect(slugify('')).toBe('workspace');
  });

  it('caps the length without leaving a trailing dash', () => {
    const slug = slugify(`${'a'.repeat(47)} ${'b'.repeat(20)}`);
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug.endsWith('-')).toBe(false);
  });
});
