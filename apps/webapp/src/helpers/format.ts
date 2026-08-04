/** Locale used across the data system when a caller does not pass one. */
const DEFAULT_LOCALE = 'fr-FR';

/**
 * Group a figure the way the editorial style guide wants it: thin space
 * thousands separators, no forced decimals. Non-finite input returns null so
 * callers can render their own "no data" state instead of printing "NaN".
 */
function formatNumber(value: number, locale: string = DEFAULT_LOCALE): string | null {
  if (!Number.isFinite(value)) return null;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

/**
 * Rank marker of an ordered list: 1 → "01". Ranks past 99 keep their own width
 * rather than being truncated.
 */
function formatRank(rank: number): string {
  return String(Math.trunc(rank)).padStart(2, '0');
}

export { formatNumber, formatRank };
