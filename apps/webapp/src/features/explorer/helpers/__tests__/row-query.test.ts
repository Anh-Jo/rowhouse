import { describe, expect, it } from 'vitest';
import {
  coerceFilterValue,
  describeFilter,
  operatorsForColumn,
  parseRowQueryParams,
  serializeFilters,
  serializeSort,
} from '../row-query';

describe('operatorsForColumn', () => {
  it('gives text columns substring matching, not comparisons', () => {
    expect(operatorsForColumn('character varying(255)')).toEqual([
      'contains',
      'eq',
      'neq',
      'isnull',
      'notnull',
    ]);
  });

  it('gives numeric and temporal columns comparisons, not contains', () => {
    for (const type of ['integer', 'numeric(10,2)', 'timestamptz', 'date']) {
      const ops = operatorsForColumn(type);
      expect(ops).toContain('gte');
      expect(ops).not.toContain('contains');
    }
  });

  it('always offers the NULL checks', () => {
    for (const type of ['text', 'integer', 'boolean', 'jsonb']) {
      const ops = operatorsForColumn(type);
      expect(ops).toContain('isnull');
      expect(ops).toContain('notnull');
    }
  });
});

describe('coerceFilterValue', () => {
  it('turns numeric input into numbers for numeric columns only', () => {
    expect(coerceFilterValue('integer', '42')).toBe(42);
    expect(coerceFilterValue('text', '42')).toBe('42');
    // Not parseable → left as text for the server to reject with a 400.
    expect(coerceFilterValue('integer', 'abc')).toBe('abc');
  });

  it('turns true/false into booleans for boolean columns', () => {
    expect(coerceFilterValue('boolean', 'true')).toBe(true);
    expect(coerceFilterValue('boolean', ' False ')).toBe(false);
    expect(coerceFilterValue('boolean', 'yes')).toBe('yes');
  });
});

describe('describeFilter', () => {
  it('quotes strings, leaves numbers bare, drops the value for NULL checks', () => {
    expect(
      describeFilter({ column: 'email', op: 'contains', value: '@gmail' }),
    ).toBe('email contains "@gmail"');
    expect(describeFilter({ column: 'id', op: 'gte', value: 5 })).toBe('id ≥ 5');
    expect(describeFilter({ column: 'deleted_at', op: 'isnull' })).toBe(
      'deleted_at is null',
    );
  });
});

describe('URL round-trip', () => {
  it('parses back exactly what it serialized', () => {
    const filters = [
      { column: 'email', op: 'contains' as const, value: '@gmail' },
      { column: 'id', op: 'gte' as const, value: 5 },
    ];
    const sort = { column: 'id', direction: 'desc' as const };
    const params = new URLSearchParams({
      filters: serializeFilters(filters) ?? '',
      sort: serializeSort(sort) ?? '',
      search: 'gmail',
    });

    expect(parseRowQueryParams(params)).toEqual({
      filters,
      sort,
      search: 'gmail',
    });
  });

  it('serializes empty refinements to null (param removed, clean URLs)', () => {
    expect(serializeFilters([])).toBeNull();
    expect(serializeSort(null)).toBeNull();
  });

  it('drops garbage from hand-edited URLs instead of crashing', () => {
    const params = new URLSearchParams({
      filters: '{not json',
      sort: 'id:sideways',
    });
    expect(parseRowQueryParams(params)).toEqual({
      filters: [],
      sort: null,
      search: '',
    });

    // Structurally-broken entries go, structurally-fine ones stay — even
    // with an unknown column: the server owns that rule (400 + message).
    const mixed = new URLSearchParams({
      filters: JSON.stringify([
        { column: 'ghost', op: 'eq', value: '1' },
        { column: 'email', op: 'sounds-like', value: 'x' },
        'nonsense',
      ]),
    });
    expect(parseRowQueryParams(mixed).filters).toEqual([
      { column: 'ghost', op: 'eq', value: '1' },
    ]);
  });
});
