import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { Badge } from '@/components/Badge/Badge';
import { Button } from '@/components/Button/Button';
import { Callout } from '@/components/Callout/Callout';
import { DataTable, type Column } from '@/components/DataTable/DataTable';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { Skeleton } from '@/components/Skeleton/Skeleton';
import { listTableRows } from '@/api/explorer';
import { explorerKeys } from '@/api/query-keys';
import type { SchemaTableDto } from '@/api/schema';
import { describeCellValue } from '../helpers/cell-value';

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

/** Column header: name in data voice, PK / PII badged. */
function ColumnHeader({
  column,
}: {
  column: SchemaTableDto['columns'][number];
}) {
  return (
    <span className="rows-grid__header-cell">
      {column.name}
      {column.isPrimaryKey && <Badge label="PK" variant="info" />}
      {column.isPii && <Badge label="PII" variant="pii" />}
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
  const rowsQuery = useInfiniteQuery({
    queryKey: explorerKeys.rows(workspaceId, projectId, datasourceId, table.id),
    queryFn: ({ pageParam }) =>
      listTableRows(workspaceId, projectId, datasourceId, table.id, {
        cursor: pageParam === '' ? undefined : pageParam,
      }),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  if (rowsQuery.isPending) {
    return <GridSkeleton />;
  }
  if (rowsQuery.error) {
    return (
      <Callout variant="danger" title="Could not load rows">
        {rowsQuery.error.message}
      </Callout>
    );
  }

  const orderedColumns = [...table.columns].sort(
    (a, b) => a.position - b.position,
  );
  const columns: Column<GridRow>[] = orderedColumns.map((column) => ({
    key: column.id,
    header: <ColumnHeader column={column} />,
    render: (row) => <CellValue value={row.values[column.name]} />,
  }));

  const rows: GridRow[] = rowsQuery.data.pages.flatMap((page, pageIndex) =>
    page.items.map((item, index) => ({
      // The row key is unique per record; the index fallback only exists for
      // PK-less tables, where a single page is ever shown.
      id: item.key ?? `row-${pageIndex}-${index}`,
      rowKey: item.key,
      values: item.values,
    })),
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={48} />}
        message="No rows"
        description="This table is empty."
      />
    );
  }

  const hasPrimaryKey = table.columns.some((column) => column.isPrimaryKey);
  const openRecord = (row: GridRow) => {
    if (row.rowKey !== null) {
      navigate(
        `/projects/${projectId}/datasources/${datasourceId}/data/tables/${table.id}/records/${encodeURIComponent(row.rowKey)}`,
      );
    }
  };

  return (
    <div className="rows-grid">
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
            First page only — this table has no primary key.
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
    </div>
  );
}

export { RowsGrid };
