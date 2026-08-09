import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, Inbox, Search, X } from 'lucide-react';
import { Badge } from '@/components/Badge/Badge';
import { Button } from '@/components/Button/Button';
import { Callout } from '@/components/Callout/Callout';
import { DataTable, type Column } from '@/components/DataTable/DataTable';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { Input } from '@/components/Input/Input';
import { Skeleton } from '@/components/Skeleton/Skeleton';
import { ApiError } from '@/api/errors';
import { listTableRows } from '@/api/explorer';
import { explorerKeys } from '@/api/query-keys';
import type { SchemaTableDto } from '@/api/schema';
import { describeCellValue } from '../helpers/cell-value';
import {
  describeFilter,
  parseRowQueryParams,
  serializeFilters,
  serializeSort,
  type RowFilter,
  type RowSort,
} from '../helpers/row-query';
import { ColumnFilterPopover } from './ColumnFilterPopover';

/** Pause after the last keystroke before the search hits the URL/server. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * One fetched row. `rowKey` is the opaque key of the record (null when the
 * table has no PK) — carried on every row so slice B can wire onRowClick to
 * the record-detail route; `id` is only the React list identity.
 */
type GridRow = {
  id: string;
  rowKey: string | null;
  values: Record<string, unknown>;
};

function CellValue({ value }: { value: unknown }) {
  const display = describeCellValue(value);
  return (
    <span className={`cell-value cell-value--${display.kind}`} title={display.title}>
      {display.text}
    </span>
  );
}

/**
 * Column header: the name is the sort control (click cycles
 * none → asc → desc → none, server-side), PK / PII badged, the filter
 * popover last. The sort arrow only shows for the active sort column —
 * headers stay quiet otherwise.
 */
function ColumnHeader({
  column,
  sort,
  onSort,
  activeFilterCount,
  onApplyFilter,
  onClearColumn,
}: {
  column: SchemaTableDto['columns'][number];
  sort: RowSort | null;
  onSort: () => void;
  activeFilterCount: number;
  onApplyFilter: (filter: RowFilter) => void;
  onClearColumn: () => void;
}) {
  const direction = sort?.column === column.name ? sort.direction : null;
  return (
    <span className="rows-grid__header-cell">
      <button
        type="button"
        className={`rows-grid__sort${direction ? ' rows-grid__sort--active' : ''}`}
        onClick={onSort}
      >
        {column.name}
        <span className="rows-grid__sort-icon" aria-hidden>
          {direction === 'asc' ? (
            <ArrowUp size={13} />
          ) : direction === 'desc' ? (
            <ArrowDown size={13} />
          ) : (
            <ArrowUpDown size={13} />
          )}
        </span>
      </button>
      {column.isPrimaryKey && <Badge label="PK" variant="info" />}
      {column.isPii && <Badge label="PII" variant="pii" />}
      <ColumnFilterPopover
        column={column}
        activeCount={activeFilterCount}
        onApply={onApplyFilter}
        onClear={onClearColumn}
      />
    </span>
  );
}

function GridSkeleton() {
  return (
    <div className="rows-grid__skeleton" aria-hidden>
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} variant="block" height={28} />
      ))}
    </div>
  );
}

/**
 * The dense row grid of one table: columns from the schema snapshot, rows
 * from the governed explorer endpoint, cursor "load more" keeping every
 * fetched page appended. Tables without a PK serve the first page only
 * (keyset pagination needs one) — a quiet notice says so.
 *
 * Refinements (filters, sort, search) live in the URL search params in their
 * exact API form, so a refined view survives refresh and is shareable. The
 * cursor chain stays in query-cache memory only: any refinement change makes
 * a new query key, which IS the pagination reset.
 *
 * Rows carrying a key open their record page on click; PK-less tables have
 * no keys, so their rows stay inert.
 */
function RowsGrid({
  workspaceId,
  projectId,
  datasourceId,
  table,
}: {
  workspaceId: string;
  projectId: string;
  datasourceId: string;
  table: SchemaTableDto;
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const refinements = useMemo(
    () => parseRowQueryParams(searchParams),
    [searchParams],
  );

  // The search box needs its own immediate state: the URL (and the query
  // behind it) only follows after the debounce pause.
  const [searchInput, setSearchInput] = useState(refinements.search);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  /** Writes one refinement into the URL (replace — no history spam). */
  const setParam = (key: 'filters' | 'sort' | 'search', value: string | null) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value === null || value === '') {
          next.delete(key);
        } else {
          next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );
  };

  const filtersParam = serializeFilters(refinements.filters) ?? undefined;
  const sortParam = serializeSort(refinements.sort) ?? undefined;
  const searchParam = refinements.search === '' ? undefined : refinements.search;

  const rowsQuery = useInfiniteQuery({
    queryKey: explorerKeys.rows(workspaceId, projectId, datasourceId, table.id, {
      filters: filtersParam,
      sort: sortParam,
      search: searchParam,
    }),
    queryFn: ({ pageParam }) =>
      listTableRows(workspaceId, projectId, datasourceId, table.id, {
        cursor: pageParam === '' ? undefined : pageParam,
        filters: filtersParam,
        sort: sortParam,
        search: searchParam,
      }),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const cycleSort = (columnName: string) => {
    const current = refinements.sort;
    const next: RowSort | null =
      current === null || current.column !== columnName
        ? { column: columnName, direction: 'asc' }
        : current.direction === 'asc'
          ? { column: columnName, direction: 'desc' }
          : null;
    setParam('sort', serializeSort(next));
  };

  const applyFilter = (filter: RowFilter) => {
    // Same column + operator refines in place; anything else stacks (AND).
    const kept = refinements.filters.filter(
      (existing) => existing.column !== filter.column || existing.op !== filter.op,
    );
    setParam('filters', serializeFilters([...kept, filter]));
  };

  const removeFilter = (index: number) => {
    setParam(
      'filters',
      serializeFilters(refinements.filters.filter((_, i) => i !== index)),
    );
  };

  const clearColumnFilters = (columnName: string) => {
    setParam(
      'filters',
      serializeFilters(
        refinements.filters.filter((filter) => filter.column !== columnName),
      ),
    );
  };

  const changeSearch = (value: string) => {
    setSearchInput(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(
      () => setParam('search', value),
      SEARCH_DEBOUNCE_MS,
    );
  };

  const clearSearch = () => {
    clearTimeout(searchTimer.current);
    setSearchInput('');
    setParam('search', null);
  };

  const hasRefinements =
    refinements.filters.length > 0 ||
    refinements.sort !== null ||
    refinements.search !== '';

  const orderedColumns = [...table.columns].sort(
    (a, b) => a.position - b.position,
  );
  const columns: Column<GridRow>[] = orderedColumns.map((column) => ({
    key: column.id,
    header: (
      <ColumnHeader
        column={column}
        sort={refinements.sort}
        onSort={() => cycleSort(column.name)}
        activeFilterCount={
          refinements.filters.filter((filter) => filter.column === column.name)
            .length
        }
        onApplyFilter={applyFilter}
        onClearColumn={() => clearColumnFilters(column.name)}
      />
    ),
    render: (row) => <CellValue value={row.values[column.name]} />,
  }));

  const rows: GridRow[] = (rowsQuery.data?.pages ?? []).flatMap(
    (page, pageIndex) =>
      page.items.map((item, index) => ({
        // The row key is unique per record; the index fallback only exists for
        // PK-less tables, where a single page is ever shown.
        id: item.key ?? `row-${pageIndex}-${index}`,
        rowKey: item.key,
        values: item.values,
      })),
  );

  const hasPrimaryKey = table.columns.some((column) => column.isPrimaryKey);
  const openRecord = (row: GridRow) => {
    if (row.rowKey !== null) {
      navigate(
        `/projects/${projectId}/datasources/${datasourceId}/data/tables/${table.id}/records/${encodeURIComponent(row.rowKey)}`,
      );
    }
  };

  // The toolbar and chips stay up whatever the query does: a 400 from a bad
  // filter must leave the user the controls to fix or remove it.
  const toolbar = (
    <>
      <div className="rows-grid__toolbar">
        <div className="rows-grid__search">
          <Input
            value={searchInput}
            onChange={(event) => changeSearch(event.target.value)}
            placeholder="Search text columns…"
            icon={<Search size={16} />}
            aria-label="Search rows"
          />
          {searchInput !== '' && (
            <button
              type="button"
              className="rows-grid__search-clear"
              aria-label="Clear search"
              onClick={clearSearch}
            >
              <X size={14} aria-hidden />
            </button>
          )}
        </div>
      </div>
      {refinements.filters.length > 0 && (
        <ul className="rows-grid__chips" aria-label="Active filters">
          {refinements.filters.map((filter, index) => (
            <li
              key={`${filter.column}:${filter.op}:${String(filter.value)}`}
              className="rows-grid__chip"
            >
              <span className="rows-grid__chip-label">
                {describeFilter(filter)}
              </span>
              <button
                type="button"
                className="rows-grid__chip-remove"
                aria-label={`Remove filter ${describeFilter(filter)}`}
                onClick={() => removeFilter(index)}
              >
                <X size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  if (rowsQuery.isPending) {
    return (
      <div className="rows-grid">
        {toolbar}
        <GridSkeleton />
      </div>
    );
  }
  if (rowsQuery.error) {
    const badRequest =
      rowsQuery.error instanceof ApiError && rowsQuery.error.status === 400;
    return (
      <div className="rows-grid">
        {toolbar}
        <Callout
          variant="danger"
          title={badRequest ? 'Invalid filter or sort' : 'Could not load rows'}
        >
          {rowsQuery.error.message}
        </Callout>
      </div>
    );
  }

  return (
    <div className="rows-grid">
      {toolbar}
      {rows.length === 0 ? (
        <EmptyState
          icon={<Inbox size={48} />}
          message={hasRefinements ? 'No matching rows' : 'No rows'}
          description={
            hasRefinements
              ? 'No row matches the current filters and search.'
              : 'This table is empty.'
          }
        />
      ) : (
        <>
          <div className="rows-grid__table">
            <DataTable
              columns={columns}
              data={rows}
              keyExtractor={(row) => row.id}
              // No PK → no row keys → no record page to open (400 server-side).
              onRowClick={hasPrimaryKey ? openRecord : undefined}
            />
          </div>
          <footer className="rows-grid__footer">
            <span className="rows-grid__count">
              {rows.length} row{rows.length === 1 ? '' : 's'} loaded
            </span>
            {!hasPrimaryKey && (
              <span className="rows-grid__notice">
                No primary key — first page only, and rows cannot be opened
                individually.
              </span>
            )}
            {rowsQuery.hasNextPage && (
              <Button
                variant="secondary"
                size="sm"
                disabled={rowsQuery.isFetchingNextPage}
                onClick={() => rowsQuery.fetchNextPage()}
              >
                {rowsQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            )}
          </footer>
        </>
      )}
    </div>
  );
}

export { RowsGrid };
