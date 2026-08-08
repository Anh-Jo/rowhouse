/**
 * Client side of the rows-endpoint refinements (grid filters, sort, search).
 * The URL search params mirror the API query params byte-for-byte (`filters`
 * JSON array, `sort` as `column:direction`, `search` plain text) so a copied
 * link replays the exact same server query after a refresh or share.
 */

const FILTER_OPS = [
  'eq',
  'neq',
  'contains',
  'gt',
  'gte',
  'lt',
  'lte',
  'isnull',
  'notnull',
] as const;

type FilterOp = (typeof FILTER_OPS)[number];

type RowFilter = {
  column: string;
  op: FilterOp;
  value?: string | number | boolean;
};

type RowSort = { column: string; direction: 'asc' | 'desc' };

/** Everything the URL carries about the current grid view. */
type RowQueryState = {
  filters: RowFilter[];
  sort: RowSort | null;
  search: string;
};

/** Broad column families — only used to pick sensible operators/coercion. */
type ColumnKind = 'text' | 'number' | 'date' | 'boolean' | 'other';

/** Mirrors the server's idea of "text-ish" (ILIKE-searchable) columns. */
function columnKind(dataType: string): ColumnKind {
  const type = dataType.toLowerCase();
  if (
    type === 'text' ||
    type === 'citext' ||
    type === 'uuid' ||
    type.startsWith('character') ||
    type.startsWith('varchar') ||
    type.startsWith('char')
  ) {
    return 'text';
  }
  if (
    type === 'smallint' ||
    type === 'integer' ||
    type === 'bigint' ||
    type === 'real' ||
    type === 'money' ||
    type.startsWith('numeric') ||
    type.startsWith('decimal') ||
    type.startsWith('double') ||
    type.startsWith('float') ||
    type.startsWith('serial')
  ) {
    return 'number';
  }
  if (type.startsWith('timestamp') || type === 'date' || type.startsWith('time')) {
    return 'date';
  }
  if (type === 'boolean' || type === 'bool') {
    return 'boolean';
  }
  return 'other';
}

/**
 * Operators offered for a column, from its snapshot data type: text gets
 * substring matching, numbers and dates get comparisons, everything can be
 * NULL-checked. The server re-validates — this only shapes the UI.
 */
function operatorsForColumn(dataType: string): FilterOp[] {
  switch (columnKind(dataType)) {
    case 'text':
      return ['contains', 'eq', 'neq', 'isnull', 'notnull'];
    case 'number':
    case 'date':
      return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'isnull', 'notnull'];
    case 'boolean':
      return ['eq', 'neq', 'isnull', 'notnull'];
    default:
      return ['eq', 'neq', 'contains', 'isnull', 'notnull'];
  }
}

/** Compact operator labels — used in the operator select and in chips. */
const OP_LABELS: Record<FilterOp, string> = {
  eq: '=',
  neq: '≠',
  contains: 'contains',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  isnull: 'is null',
  notnull: 'is not null',
};

/** Whether an operator takes a value at all (isnull/notnull do not). */
function opNeedsValue(op: FilterOp): boolean {
  return op !== 'isnull' && op !== 'notnull';
}

/**
 * Turns the raw input text into the JSON value the API expects: numbers for
 * numeric columns (when parseable), true/false for booleans, text otherwise.
 */
function coerceFilterValue(
  dataType: string,
  raw: string,
): string | number | boolean {
  const kind = columnKind(dataType);
  if (kind === 'number') {
    const parsed = Number(raw);
    if (raw.trim() !== '' && Number.isFinite(parsed)) {
      return parsed;
    }
  }
  if (kind === 'boolean') {
    const lowered = raw.trim().toLowerCase();
    if (lowered === 'true') return true;
    if (lowered === 'false') return false;
  }
  return raw;
}

/** Chip text: `email contains "@gmail"`, `id ≥ 5`, `deleted_at is null`. */
function describeFilter(filter: RowFilter): string {
  if (!opNeedsValue(filter.op)) {
    return `${filter.column} ${OP_LABELS[filter.op]}`;
  }
  const value =
    typeof filter.value === 'string'
      ? `"${filter.value}"`
      : String(filter.value);
  return `${filter.column} ${OP_LABELS[filter.op]} ${value}`;
}

function isFilterOp(value: unknown): value is FilterOp {
  return (
    typeof value === 'string' && (FILTER_OPS as readonly string[]).includes(value)
  );
}

/**
 * One entry of the `filters` URL param, structurally checked. Column
 * existence is NOT checked here on purpose: the server owns that rule and
 * answers 400 with a precise message — the chip still renders, so the user
 * can see and remove the offending filter of a hand-edited URL.
 */
function isRowFilter(entry: unknown): entry is RowFilter {
  if (typeof entry !== 'object' || entry === null) {
    return false;
  }
  const candidate = entry as Record<string, unknown>;
  if (typeof candidate.column !== 'string' || candidate.column.length === 0) {
    return false;
  }
  if (!isFilterOp(candidate.op)) {
    return false;
  }
  const { value } = candidate;
  return (
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

/** Reads the grid view out of the URL — tolerant, garbage is dropped. */
function parseRowQueryParams(params: URLSearchParams): RowQueryState {
  let filters: RowFilter[] = [];
  const rawFilters = params.get('filters');
  if (rawFilters !== null && rawFilters !== '') {
    try {
      const json: unknown = JSON.parse(rawFilters);
      if (Array.isArray(json)) {
        filters = json.filter(isRowFilter);
      }
    } catch {
      // Unparseable JSON in a hand-edited URL — start unfiltered.
    }
  }

  let sort: RowSort | null = null;
  const rawSort = params.get('sort');
  if (rawSort !== null) {
    const match = /^(.+):(asc|desc)$/.exec(rawSort);
    if (match) {
      sort = { column: match[1], direction: match[2] as 'asc' | 'desc' };
    }
  }

  return { filters, sort, search: params.get('search') ?? '' };
}

/** The `filters` API/URL param — null when there is nothing to say. */
function serializeFilters(filters: RowFilter[]): string | null {
  return filters.length === 0 ? null : JSON.stringify(filters);
}

/** The `sort` API/URL param — null when unsorted. */
function serializeSort(sort: RowSort | null): string | null {
  return sort === null ? null : `${sort.column}:${sort.direction}`;
}

export {
  OP_LABELS,
  coerceFilterValue,
  columnKind,
  describeFilter,
  opNeedsValue,
  operatorsForColumn,
  parseRowQueryParams,
  serializeFilters,
  serializeSort,
};
export type { FilterOp, RowFilter, RowSort };
