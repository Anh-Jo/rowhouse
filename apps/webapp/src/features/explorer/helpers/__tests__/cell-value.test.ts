import { describe, expect, it } from 'vitest';
import { describeCellValue } from '../cell-value';

describe('describeCellValue', () => {
  it('renders null and undefined as the NULL token', () => {
    expect(describeCellValue(null)).toEqual({ kind: 'null', text: 'NULL' });
    expect(describeCellValue(undefined)).toEqual({ kind: 'null', text: 'NULL' });
  });

  it('renders booleans as words', () => {
    expect(describeCellValue(true)).toEqual({ kind: 'boolean', text: 'true' });
    expect(describeCellValue(false)).toEqual({ kind: 'boolean', text: 'false' });
  });

  it('shortens ISO date-times, keeping the full value as title', () => {
    expect(describeCellValue('2026-08-04T09:30:12.000Z')).toEqual({
      kind: 'date',
      text: '2026-08-04 09:30',
      title: '2026-08-04T09:30:12.000Z',
    });
  });

  it('leaves date-looking but invalid strings as text', () => {
    expect(describeCellValue('2026-99-99T99:99:99Z').kind).toBe('text');
  });

  it('passes numbers and short strings through', () => {
    expect(describeCellValue(42)).toEqual({ kind: 'text', text: '42' });
    expect(describeCellValue('hello')).toEqual({ kind: 'text', text: 'hello' });
  });

  it('truncates long text with an ellipsis and a full title', () => {
    const long = 'x'.repeat(200);
    const display = describeCellValue(long);
    expect(display.text.endsWith('…')).toBe(true);
    expect(display.text.length).toBe(121);
    expect(display.title).toBe(long);
  });

  it('serializes objects and arrays as JSON', () => {
    expect(describeCellValue({ a: 1 })).toEqual({ kind: 'text', text: '{"a":1}' });
    expect(describeCellValue([1, 2])).toEqual({ kind: 'text', text: '[1,2]' });
  });

  it('keeps the full text and pretty-prints JSON when truncation is off (record view)', () => {
    const long = 'x'.repeat(200);
    expect(describeCellValue(long, { truncate: false })).toEqual({
      kind: 'text',
      text: long,
    });
    expect(describeCellValue({ a: 1 }, { truncate: false })).toEqual({
      kind: 'text',
      text: '{\n  "a": 1\n}',
    });
  });
});
