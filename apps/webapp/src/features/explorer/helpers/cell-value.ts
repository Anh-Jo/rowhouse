/**
 * Smart display of one grid cell value. Pure — the grid renders the result
 * with the matching token style:
 * - null/undefined → muted NULL token
 * - booleans → true / false
 * - ISO date-times → `YYYY-MM-DD HH:mm`, full value on title=
 * - long text / JSON → truncated with an ellipsis, full value on title=
 *
 * The record view passes `{ truncate: false }`: full text and pretty-printed
 * JSON (a record page shows the whole value, the grid never does).
 */
type CellDisplay = {
  kind: 'null' | 'boolean' | 'date' | 'text';
  /** What the cell shows. */
  text: string;
  /** Full value for `title=` when the shown text is shortened. */
  title?: string;
};

type CellValueOptions = {
  /** Grid default; the record view turns it off to show everything. */
  truncate?: boolean;
};

/** ISO 8601 date-time (what the backend serializes dates to). */
const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/;

/** Truncation threshold — the CSS ellipsis handles the visual overflow,
    this keeps huge payloads out of the DOM entirely. */
const MAX_TEXT_LENGTH = 120;

function truncate(text: string): CellDisplay {
  if (text.length <= MAX_TEXT_LENGTH) {
    return { kind: 'text', text };
  }
  return { kind: 'text', text: `${text.slice(0, MAX_TEXT_LENGTH)}…`, title: text };
}

function describeCellValue(
  value: unknown,
  options: CellValueOptions = {},
): CellDisplay {
  const shouldTruncate = options.truncate ?? true;
  if (value === null || value === undefined) {
    return { kind: 'null', text: 'NULL' };
  }
  if (typeof value === 'boolean') {
    return { kind: 'boolean', text: value ? 'true' : 'false' };
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return { kind: 'text', text: String(value) };
  }
  if (typeof value === 'string') {
    if (ISO_DATE_TIME.test(value) && !Number.isNaN(Date.parse(value))) {
      return {
        kind: 'date',
        text: value.slice(0, 16).replace('T', ' '),
        title: value,
      };
    }
    return shouldTruncate ? truncate(value) : { kind: 'text', text: value };
  }
  // Objects/arrays (json & jsonb columns) — compact JSON truncated in the
  // grid, pretty-printed in full for the record view.
  return shouldTruncate
    ? truncate(JSON.stringify(value))
    : { kind: 'text', text: JSON.stringify(value, null, 2) };
}

export { describeCellValue };
