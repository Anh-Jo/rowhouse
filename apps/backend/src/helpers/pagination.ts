/** Default page size when the caller omits `limit`. */
const DEFAULT_LIMIT = 20;
/** Hard upper bound, so a client can never request an unbounded page. */
const MAX_LIMIT = 50;

/**
 * Clamps a client-supplied page size into `[1, MAX_LIMIT]`, falling back to
 * `DEFAULT_LIMIT` when absent or not a finite number.
 */
export function clampLimit(
  limit: number | null | undefined,
  def: number = DEFAULT_LIMIT,
  max: number = MAX_LIMIT,
): number {
  if (limit === null || limit === undefined || !Number.isFinite(limit)) {
    return def;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), max);
}

/** A cursor-paginated slice: the page items plus the cursor for the next page. */
export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

/**
 * Turns an over-fetched row set (`take: limit + 1`) into a page. When a surplus
 * row is present there is a next page and `getCursor` derives its opaque cursor
 * from the last kept row; otherwise `nextCursor` is `null`.
 */
export function paginateRows<T>(
  rows: T[],
  limit: number,
  getCursor: (row: T) => string,
): CursorPage<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && items.length > 0 ? getCursor(items[items.length - 1]) : null;
  return { items, nextCursor };
}
