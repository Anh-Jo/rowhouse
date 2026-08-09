import { describe, expect, it } from 'vitest';
import {
  fieldKindFor,
  numberStepFor,
  toApiValue,
  toFieldValue,
} from '../column-input';

describe('column-input', () => {
  describe('fieldKindFor', () => {
    it('prefers enum whenever values are present, whatever the base type', () => {
      expect(fieldKindFor('USER-DEFINED', ['a', 'b'])).toBe('enum');
      expect(fieldKindFor('text', ['a'])).toBe('enum');
    });

    it.each([
      ['boolean', 'boolean'],
      ['date', 'date'],
      ['timestamp without time zone', 'datetime'],
      ['timestamp with time zone', 'datetime'],
      ['time without time zone', 'time'],
      ['json', 'json'],
      ['jsonb', 'json'],
      ['integer', 'number'],
      ['numeric', 'number'],
      ['double precision', 'number'],
      ['text', 'text'],
      ['character varying', 'text'],
      ['uuid', 'text'],
    ] as const)('maps %s -> %s', (dataType, kind) => {
      expect(fieldKindFor(dataType, [])).toBe(kind);
    });

    it('does not mistake timestamp for time (prefix order)', () => {
      expect(fieldKindFor('timestamp without time zone', [])).toBe('datetime');
    });
  });

  describe('numberStepFor', () => {
    it('is 1 for integers and any for decimals', () => {
      expect(numberStepFor('integer')).toBe('1');
      expect(numberStepFor('bigint')).toBe('1');
      expect(numberStepFor('numeric')).toBe('any');
      expect(numberStepFor('double precision')).toBe('any');
    });
  });

  describe('toFieldValue', () => {
    it('renders null/undefined as empty', () => {
      expect(toFieldValue(null, 'text')).toBe('');
      expect(toFieldValue(undefined, 'boolean')).toBe('');
    });

    it('slices ISO dates to the picker formats', () => {
      expect(toFieldValue('2026-01-02T00:00:00.000Z', 'date')).toBe(
        '2026-01-02',
      );
      expect(toFieldValue('2026-01-02T14:30:00.000Z', 'datetime')).toBe(
        '2026-01-02T14:30',
      );
    });

    it('pretty-prints json objects', () => {
      expect(toFieldValue({ a: 1 }, 'json')).toBe('{\n  "a": 1\n}');
    });

    it('stringifies scalars', () => {
      expect(toFieldValue(42, 'number')).toBe('42');
      expect(toFieldValue(true, 'boolean')).toBe('true');
    });
  });

  describe('toApiValue', () => {
    it('maps empty to null', () => {
      expect(toApiValue('', 'text')).toBeNull();
      expect(toApiValue('', 'boolean')).toBeNull();
    });

    it('coerces booleans, keeps everything else as strings', () => {
      expect(toApiValue('true', 'boolean')).toBe(true);
      expect(toApiValue('false', 'boolean')).toBe(false);
      expect(toApiValue('42', 'number')).toBe('42');
      expect(toApiValue('2026-01-02', 'date')).toBe('2026-01-02');
    });
  });
});
