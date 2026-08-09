import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Check, Search, X } from 'lucide-react';
import { Button } from '@/components/Button/Button';
import { Callout } from '@/components/Callout/Callout';
import { Drawer } from '@/components/Drawer/Drawer';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { Input } from '@/components/Input/Input';
import { Skeleton } from '@/components/Skeleton/Skeleton';
import { listTableRows } from '@/api/explorer';
import { explorerKeys } from '@/api/query-keys';
import type { SchemaTableDto } from '@/api/schema';
import { describeCellValue } from '../helpers/cell-value';
import { describeRowIdentity } from '../helpers/row-identity';
import { toFieldValue } from '../helpers/column-input';
import './RelationPicker.css';

/** Pause after the last keystroke before the search hits the server. */
const SEARCH_DEBOUNCE_MS = 300;

type RelationPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  projectId: string;
  datasourceId: string;
  /** The referenced table, as found in the schema snapshot. */
  table: SchemaTableDto;
  /** The referenced column — the value the FK actually stores. */
  valueColumn: string;
  /** Currently referenced value in canonical string form (`''` is null). */
  currentValue: string;
  /** The FK column accepts NULL — the drawer then offers to clear it. */
  nullable: boolean;
  /**
   * A row was picked: the referenced column's value, plus the human identity
   * of that row so the field can label it without a second round-trip.
   */
  onSelect: (value: string, identity: string) => void;
};

/**
 * Picks the row a foreign key points at — a relation is chosen, never typed.
 *
 * The drawer browses the referenced table through the same governed rows
 * endpoint as the grid (search included, so every read stays audited and
 * server-filtered), and hands back the referenced column's value. Rows whose
 * referenced value is NULL cannot be pointed at, so they are listed disabled
 * rather than silently dropped.
 */
function RelationPicker({
  open,
  onOpenChange,
  workspaceId,
  projectId,
  datasourceId,
  table,
  valueColumn,
  currentValue,
  nullable,
  onSelect,
}: RelationPickerProps) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const changeSearch = (value: string) => {
    setSearchInput(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(
      () => setSearch(value),
      SEARCH_DEBOUNCE_MS,
    );
  };

  const clearSearch = () => {
    clearTimeout(searchTimer.current);
    setSearchInput('');
    setSearch('');
  };

  const searchParam = search.trim() === '' ? undefined : search.trim();
  // Same key — and same page size (the server's default) — as the grid reading
  // that table unrefined: one cache, already swept by a record write.
  const rowsQuery = useInfiniteQuery({
    queryKey: explorerKeys.rows(
      workspaceId,
      projectId,
      datasourceId,
      table.id,
      {
        search: searchParam,
      },
    ),
    queryFn: ({ pageParam }) =>
      listTableRows(workspaceId, projectId, datasourceId, table.id, {
        cursor: pageParam === '' ? undefined : pageParam,
        search: searchParam,
      }),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Nothing is read until the user opens the drawer — a governed read is
    // never issued for a panel nobody looked at.
    enabled: open,
  });

  const rows = (rowsQuery.data?.pages ?? []).flatMap((page, pageIndex) =>
    page.items.map((item, index) => ({
      id: item.key ?? `row-${pageIndex}-${index}`,
      values: item.values,
    })),
  );

  const pick = (values: Record<string, unknown>) => {
    onSelect(
      toFieldValue(values[valueColumn], 'text'),
      describeRowIdentity(table, values),
    );
    onOpenChange(false);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={`Select a ${table.name} row`}
      description={`The value of ${table.name}.${valueColumn} is what gets written.`}
      footer={
        nullable ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onSelect('', '');
              onOpenChange(false);
            }}
          >
            Clear the relation (NULL)
          </Button>
        ) : undefined
      }
    >
      <div className="relation-picker__search">
        <Input
          value={searchInput}
          onChange={(event) => changeSearch(event.target.value)}
          placeholder={`Search ${table.name}…`}
          icon={<Search size={16} />}
          aria-label={`Search ${table.name}`}
        />
        {searchInput !== '' && (
          <button
            type="button"
            className="relation-picker__search-clear"
            aria-label="Clear search"
            onClick={clearSearch}
          >
            <X size={14} aria-hidden />
          </button>
        )}
      </div>

      {rowsQuery.error && (
        <Callout variant="danger" title="Could not load the rows">
          {rowsQuery.error.message}
        </Callout>
      )}

      {rowsQuery.isPending ? (
        <div className="relation-picker__skeleton" aria-hidden>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} variant="block" height={40} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          message="No matching row"
          description={
            searchParam
              ? 'Try another search — it scans this table’s text columns.'
              : 'This table has no rows to point at.'
          }
        />
      ) : (
        <ul className="relation-picker__rows">
          {rows.map((row) => {
            const raw = row.values[valueColumn];
            const value = toFieldValue(raw, 'text');
            // A NULL referenced value cannot be the target of a foreign key.
            const selectable = raw !== null && raw !== undefined;
            const isCurrent = selectable && value === currentValue;
            const display = describeCellValue(raw);
            return (
              <li key={row.id}>
                <button
                  type="button"
                  className={`relation-picker__row${
                    isCurrent ? ' relation-picker__row--current' : ''
                  }`}
                  disabled={!selectable}
                  aria-current={isCurrent ? 'true' : undefined}
                  onClick={() => pick(row.values)}
                >
                  <span className="relation-picker__identity">
                    {describeRowIdentity(table, row.values)}
                  </span>
                  <span className="relation-picker__value">
                    {valueColumn} <span aria-hidden>·</span> {display.text}
                  </span>
                  {isCurrent && (
                    <Check
                      className="relation-picker__current-icon"
                      size={15}
                      aria-label="Current value"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {rowsQuery.hasNextPage && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void rowsQuery.fetchNextPage()}
          disabled={rowsQuery.isFetchingNextPage}
        >
          {rowsQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </Drawer>
  );
}

export { RelationPicker };
