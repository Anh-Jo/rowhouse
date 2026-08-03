import { clampLimit, paginateRows } from './pagination';

describe('clampLimit', () => {
  it('falls back to the default for null/undefined/NaN', () => {
    expect(clampLimit(undefined)).toBe(20);
    expect(clampLimit(null)).toBe(20);
    expect(clampLimit(Number.NaN)).toBe(20);
  });

  it('clamps into [1, 50] and truncates floats', () => {
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(-5)).toBe(1);
    expect(clampLimit(1000)).toBe(50);
    expect(clampLimit(12.9)).toBe(12);
  });

  it('honours custom bounds', () => {
    expect(clampLimit(undefined, 5, 10)).toBe(5);
    expect(clampLimit(100, 5, 10)).toBe(10);
  });
});

describe('paginateRows', () => {
  it('detects a next page from the surplus row and derives its cursor', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const page = paginateRows(rows, 2, (row) => row.id);

    expect(page.items).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(page.nextCursor).toBe('b');
  });

  it('reports no next page when the set fits within the limit', () => {
    const rows = [{ id: 'a' }];
    const page = paginateRows(rows, 5, (row) => row.id);

    expect(page.items).toEqual(rows);
    expect(page.nextCursor).toBeNull();
  });

  it('returns a null cursor for an empty set', () => {
    const page = paginateRows<{ id: string }>([], 5, (row) => row.id);

    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });
});
