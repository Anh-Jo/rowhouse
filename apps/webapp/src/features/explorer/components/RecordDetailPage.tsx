import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FileQuestion } from 'lucide-react';
import { Badge } from '@/components/Badge/Badge';
import { Callout } from '@/components/Callout/Callout';
import { Card } from '@/components/Card/Card';
import { DataTable, type Column } from '@/components/DataTable/DataTable';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { Skeleton } from '@/components/Skeleton/Skeleton';
import { ApiError } from '@/api/errors';
import { getTableRecord, type RecordDetailDto } from '@/api/explorer';
import { explorerKeys, schemaKeys } from '@/api/query-keys';
import { getDatasourceSchema, type SchemaTableDto } from '@/api/schema';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import { describeCellValue } from '../helpers/cell-value';
import { describePkIdentity, describeRowIdentity } from '../helpers/row-identity';
import './RecordDetailPage.css';

/** Record path for a row of a table — one place builds it for every link. */
function recordPath(basePath: string, tableId: string, rowKey: string): string {
  return `${basePath}/data/tables/${tableId}/records/${encodeURIComponent(rowKey)}`;
}

/** One value in the field list: full (untruncated) record rendering. */
function FieldValue({ value }: { value: unknown }) {
  const display = describeCellValue(value, { truncate: false });
  return (
    <span
      className={`record-fields__data cell-value--${display.kind}`}
      title={display.title}
    >
      {display.text}
    </span>
  );
}

/**
 * Outgoing FK: `→ customers · ada@example.test`, linking to the referenced
 * record when it resolved. An unresolved reference (row gone, or the target
 * table missing from the snapshot) degrades to a plain table-name mention.
 */
function ReferenceLink({
  reference,
  tables,
  basePath,
}: {
  reference: RecordDetailDto['references'][number];
  tables: SchemaTableDto[];
  basePath: string;
}) {
  const targetTable = reference.tableId
    ? tables.find((table) => table.id === reference.tableId)
    : undefined;
  const row = reference.row;
  if (!row || row.key === null || !reference.tableId) {
    return (
      <span className="record-fields__ref record-fields__ref--unresolved">
        <ArrowRight size={13} aria-hidden /> {reference.tableName}
      </span>
    );
  }
  const identity = targetTable
    ? describeRowIdentity(targetTable, row.values)
    : '';
  return (
    <Link
      className="record-fields__ref"
      to={recordPath(basePath, reference.tableId, row.key)}
    >
      <ArrowRight size={13} aria-hidden /> {reference.tableName}
      {identity && <span className="record-fields__ref-identity"> · {identity}</span>}
    </Link>
  );
}

/**
 * Column → value, two columns, full values. PII columns visibly badged (the
 * value is still readable in P1 — masking lands with RBAC in P2), PK badged,
 * FK values doubled with the resolved reference link.
 */
function FieldList({
  table,
  tables,
  record,
  basePath,
}: {
  table: SchemaTableDto;
  /** Every snapshot table — resolves referenced tables' identity columns. */
  tables: SchemaTableDto[];
  record: RecordDetailDto;
  basePath: string;
}) {
  const orderedColumns = [...table.columns].sort(
    (a, b) => a.position - b.position,
  );
  return (
    <dl className="record-fields">
      {orderedColumns.map((column) => {
        const reference = record.references.find(
          (candidate) => candidate.column === column.name,
        );
        return (
          <div className="record-fields__row" key={column.id}>
            <dt className="record-fields__label">
              {column.name}
              {column.isPrimaryKey && <Badge label="PK" variant="info" />}
              {column.isPii && <Badge label="PII" variant="pii" />}
            </dt>
            <dd className="record-fields__value">
              <FieldValue value={record.row.values[column.name]} />
              {reference && (
                <ReferenceLink
                  reference={reference}
                  tables={tables}
                  basePath={basePath}
                />
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * One incoming relation: the referencing table's first rows in a compact
 * grid, each opening its own record; the count and a plain link to the full
 * table (pre-filtered views come later — the link is unfiltered).
 */
function RelatedPanel({
  entry,
  tables,
  basePath,
}: {
  entry: RecordDetailDto['referencedBy'][number];
  tables: SchemaTableDto[];
  basePath: string;
}) {
  const navigate = useNavigate();
  const relatedTable = tables.find((table) => table.id === entry.tableId);
  // Snapshot columns when the table is known; the rows' own keys otherwise
  // (the panel must render even if the snapshot moved under us).
  const columnNames = relatedTable
    ? [...relatedTable.columns]
        .sort((a, b) => a.position - b.position)
        .map((column) => column.name)
    : Object.keys(entry.rows[0]?.values ?? {});

  type RelatedRow = RecordDetailDto['referencedBy'][number]['rows'][number] & {
    id: string;
  };
  const rows: RelatedRow[] = entry.rows.map((row, index) => ({
    ...row,
    id: row.key ?? `row-${index}`,
  }));
  const columns: Column<RelatedRow>[] = columnNames.map((name) => ({
    key: name,
    header: name,
    render: (row) => {
      const display = describeCellValue(row.values[name]);
      return (
        <span className={`cell-value cell-value--${display.kind}`} title={display.title}>
          {display.text}
        </span>
      );
    },
  }));
  const hasKeys = rows.some((row) => row.key !== null);

  return (
    <Card
      className="record-related__card"
      title={
        <span className="record-related__title">
          {entry.tableName}
          <span className="record-related__via"> · via {entry.viaColumn}</span>
        </span>
      }
      actions={<Badge label={String(entry.count)} variant="muted" />}
    >
      {rows.length === 0 ? (
        <p className="record-related__empty">No referencing rows.</p>
      ) : (
        <div className="record-related__table">
          <DataTable
            columns={columns}
            data={rows}
            keyExtractor={(row) => row.id}
            onRowClick={
              hasKeys
                ? (row) => {
                    if (row.key !== null) {
                      navigate(recordPath(basePath, entry.tableId, row.key));
                    }
                  }
                : undefined
            }
          />
        </div>
      )}
      <Link
        className="record-related__view-all"
        to={`${basePath}/data/tables/${entry.tableId}`}
      >
        View all {entry.count} in {entry.tableName}
      </Link>
    </Card>
  );
}

function RecordSkeleton() {
  return (
    <div className="record-detail__inner" aria-hidden>
      <Skeleton width={200} height={28} />
      <div className="record-detail__fields">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} variant="block" height={32} />
        ))}
      </div>
    </div>
  );
}

/**
 * One record and everything it connects to. Full-bleed family (the page owns
 * its scrolling like the grid), but the field list sits in a readable column
 * — a record is read top to bottom — while the linked-record grids take the
 * full width like every data table.
 */
function RecordDetailPage() {
  const {
    projectId = '',
    datasourceId = '',
    tableId = '',
    rowKey = '',
  } = useParams();
  const { workspaceId } = useWorkspaceId();

  const enabled = workspaceId !== null;
  const schemaQuery = useQuery({
    queryKey: schemaKeys.byDatasource(workspaceId ?? '', projectId, datasourceId),
    queryFn: () => getDatasourceSchema(workspaceId ?? '', projectId, datasourceId),
    enabled,
  });
  const recordQuery = useQuery({
    queryKey: explorerKeys.record(
      workspaceId ?? '',
      projectId,
      datasourceId,
      tableId,
      rowKey,
    ),
    queryFn: () =>
      getTableRecord(workspaceId ?? '', projectId, datasourceId, tableId, rowKey),
    enabled,
  });

  const basePath = `/projects/${projectId}/datasources/${datasourceId}`;
  const gridPath = `${basePath}/data/tables/${tableId}`;
  const tables = schemaQuery.data?.tables ?? [];
  const table = tables.find((candidate) => candidate.id === tableId);

  const breadcrumb = (
    <Link className="record-detail__back" to={gridPath}>
      <ArrowLeft size={16} aria-hidden />
      {table ? table.name : 'Back to the table'}
    </Link>
  );

  if (!enabled || schemaQuery.isPending || recordQuery.isPending) {
    return (
      <div className="record-detail">
        <RecordSkeleton />
      </div>
    );
  }

  if (recordQuery.error instanceof ApiError && recordQuery.error.status === 404) {
    return (
      <div className="record-detail">
        <div className="record-detail__inner">
          {breadcrumb}
          <EmptyState
            icon={<FileQuestion size={48} />}
            message="Record not found"
            description="It may have been deleted, or the link is stale."
          />
        </div>
      </div>
    );
  }

  const error = schemaQuery.error ?? recordQuery.error;
  const record = recordQuery.data;
  if (error || !table || record === undefined) {
    return (
      <div className="record-detail">
        <div className="record-detail__inner">
          {breadcrumb}
          {error ? (
            // Covers the 400s too: PK-less table reached directly, garbled key.
            <Callout variant="danger" title="Could not load this record">
              {error.message}
            </Callout>
          ) : (
            <EmptyState
              message="Table not found"
              description="It may have been removed by the last schema sync."
            />
          )}
        </div>
      </div>
    );
  }

  const pkIdentity = describePkIdentity(table, record.row.values);
  const rowIdentity = describeRowIdentity(table, record.row.values);

  return (
    <div className="record-detail">
      <div className="record-detail__inner">
        {breadcrumb}
        <PageHeader
          eyebrow="Record"
          title={
            <span className="record-detail__title">
              {table.name}
              <span className="record-detail__identity"> · {pkIdentity}</span>
            </span>
          }
          subtitle={rowIdentity !== pkIdentity ? rowIdentity : undefined}
        />
        <div className="record-detail__fields">
          <FieldList
            table={table}
            tables={tables}
            record={record}
            basePath={basePath}
          />
        </div>
        {record.referencedBy.length > 0 && (
          <section
            className="record-related"
            aria-label="Linked records"
          >
            <h2 className="record-related__heading">Linked records</h2>
            {record.referencedBy.map((entry) => (
              <RelatedPanel
                key={`${entry.tableId}-${entry.viaColumn}`}
                entry={entry}
                tables={tables}
                basePath={basePath}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

export { RecordDetailPage };
