import type { RecordFieldKind } from '@/components/RecordFieldInput/RecordFieldInput';

/**
 * Maps a snapshot column to the input control the editor should render for it.
 * Enum wins whenever the introspection captured allowed values; otherwise the
 * Postgres `dataType` decides. The strings are the canonical
 * `information_schema` names ("timestamp without time zone", "double
 * precision", …), so matches are on prefixes/exact names, never on the engine
 * driver's aliases.
 */

const NUMERIC_TYPES: ReadonlySet<string> = new Set([
  'smallint',
  'integer',
  'bigint',
  'decimal',
  'numeric',
  'real',
  'double precision',
  'money',
]);

const INTEGER_TYPES: ReadonlySet<string> = new Set([
  'smallint',
  'integer',
  'bigint',
]);

export function fieldKindFor(
  dataType: string,
  enumValues: string[],
): RecordFieldKind {
  if (enumValues.length > 0) return 'enum';
  const type = dataType.toLowerCase();
  if (type === 'boolean') return 'boolean';
  if (type === 'json' || type === 'jsonb') return 'json';
  if (type === 'date') return 'date';
  // "timestamp…" must be tested before "time…" — the former starts with it.
  if (type.startsWith('timestamp')) return 'datetime';
  if (type.startsWith('time')) return 'time';
  if (NUMERIC_TYPES.has(type)) return 'number';
  return 'text';
}

/** Number input granularity: whole steps for integers, free for decimals. */
export function numberStepFor(dataType: string): string {
  return INTEGER_TYPES.has(dataType.toLowerCase()) ? '1' : 'any';
}

/**
 * A cell value, as the API serialized it, turned into the control's string
 * value. Dates arrive ISO-serialized (`2026-01-02T00:00:00.000Z`); the date and
 * datetime pickers want `2026-01-02` and `2026-01-02T00:00`, so we slice rather
 * than reformat (no timezone shift, no `Date` round-trip).
 */
export function toFieldValue(raw: unknown, kind: RecordFieldKind): string {
  if (raw === null || raw === undefined) return '';
  if (kind === 'json' && typeof raw === 'object') {
    return JSON.stringify(raw, null, 2);
  }
  const text = typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
  if (kind === 'date') return text.slice(0, 10);
  if (kind === 'datetime') return text.slice(0, 16);
  return text;
}

/**
 * The control's string value turned into the JSON value sent to the write API.
 * `''` is null; booleans become real booleans; everything else stays a string
 * (numbers included — Postgres casts on assignment, and a string keeps numeric
 * precision that a JS number would round).
 */
export function toApiValue(
  input: string,
  kind: RecordFieldKind,
): string | number | boolean | null {
  if (input === '') return null;
  if (kind === 'boolean') return input === 'true';
  return input;
}
