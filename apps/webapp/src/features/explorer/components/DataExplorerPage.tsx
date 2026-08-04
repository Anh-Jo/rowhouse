import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Search, Table2 } from 'lucide-react';
import { Badge } from '@/components/Badge/Badge';
import { Callout } from '@/components/Callout/Callout';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { Input } from '@/components/Input/Input';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { Skeleton } from '@/components/Skeleton/Skeleton';
import { TabFilter } from '@/components/TabFilter/TabFilter';
import { getDatasource } from '@/api/datasources';
import { datasourceKeys, schemaKeys } from '@/api/query-keys';
import { getDatasourceSchema, type SchemaTableDto } from '@/api/schema';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import { RowsGrid } from './RowsGrid';
import './DataExplorerPage.css';

/** Searchable list of every table of the datasource — the left rail on
    desktop, the full-screen list on mobile (list → detail, decision D7).
    Row counts are deliberately absent: the snapshot does not know them. */
function TableRail({
  tables,
  basePath,
}: {
  tables: SchemaTableDto[];
  basePath: string;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (needle.length === 0) {
      return tables;
    }
    return tables.filter(
      (table) =>
        table.name.toLowerCase().includes(needle) ||
        table.schema.toLowerCase().includes(needle),
    );
  }, [tables, search]);

  return (
    <div className="data-explorer__rail-inner">
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search tables…"
        icon={<Search size={16} />}
        aria-label="Search tables"
      />
      {filtered.length === 0 ? (
        <p className="data-explorer__rail-empty">No table matches this search</p>
      ) : (
        <ul className="data-explorer__tables">
          {filtered.map((table) => (
            <li key={table.id}>
              <NavLink
                to={`${basePath}/data/tables/${table.id}`}
                className={({ isActive }) =>
                  `data-explorer__table-link${
                    isActive ? ' data-explorer__table-link--active' : ''
                  }`
                }
              >
                <Table2 size={16} aria-hidden />
                <span className="data-explorer__table-name">{table.name}</span>
                {table.schema !== 'public' && (
                  <Badge label={table.schema} variant="muted" />
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The datasource's home: every table on the left, the selected table's rows
 * in the dense grid — full-bleed (the route opts into the shell's full-bleed
 * content mode). The schema browser stays one tab away.
 */
function DataExplorerPage() {
  const { projectId = '', datasourceId = '', tableId } = useParams();
  const { workspaceId } = useWorkspaceId();
  const navigate = useNavigate();

  const enabled = workspaceId !== null;
  const schemaQuery = useQuery({
    queryKey: schemaKeys.byDatasource(workspaceId ?? '', projectId, datasourceId),
    queryFn: () => getDatasourceSchema(workspaceId ?? '', projectId, datasourceId),
    enabled,
  });
  const datasourceQuery = useQuery({
    queryKey: datasourceKeys.detail(workspaceId ?? '', projectId, datasourceId),
    queryFn: () => getDatasource(workspaceId ?? '', projectId, datasourceId),
    enabled,
  });

  const basePath = `/projects/${projectId}/datasources/${datasourceId}`;
  const tables = schemaQuery.data?.tables ?? [];
  const selectedTable = tableId
    ? tables.find((table) => table.id === tableId)
    : undefined;

  const header = (
    <div className="data-explorer__header">
      <PageHeader
        title={datasourceQuery.data?.name ?? <Skeleton width={160} />}
        actions={
          <TabFilter
            tabs={[
              { value: 'data', label: 'Data' },
              { value: 'schema', label: 'Schema' },
            ]}
            value="data"
            onValueChange={(value) => {
              if (value === 'schema') {
                navigate(`${basePath}/schema`);
              }
            }}
          />
        }
      />
    </div>
  );

  if (!enabled || schemaQuery.isPending) {
    return (
      <div className="data-explorer">
        {header}
        <div className="data-explorer__body">
          <aside className="data-explorer__rail" aria-hidden>
            <div className="data-explorer__rail-inner">
              <Skeleton variant="block" height={32} />
              <Skeleton variant="block" height={28} />
              <Skeleton variant="block" height={28} />
              <Skeleton variant="block" height={28} />
            </div>
          </aside>
          <section className="data-explorer__main" />
        </div>
      </div>
    );
  }

  if (schemaQuery.error) {
    return (
      <div className="data-explorer">
        {header}
        <div className="data-explorer__error">
          <Callout variant="danger" title="Could not load the schema">
            {schemaQuery.error.message}
          </Callout>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`data-explorer${
        tableId ? ' data-explorer--table-open' : ''
      }`}
    >
      {header}
      <div className="data-explorer__body">
        <aside className="data-explorer__rail" aria-label="Tables">
          {tables.length === 0 ? (
            <div className="data-explorer__rail-inner">
              <EmptyState
                message="No tables"
                description="Sync the schema to browse this datasource."
              />
            </div>
          ) : (
            <TableRail tables={tables} basePath={basePath} />
          )}
        </aside>
        <section className="data-explorer__main">
          {/* Mobile-only way back to the table list (list → detail, D7). */}
          {tableId && (
            <Link className="data-explorer__back" to={`${basePath}/data`}>
              <ArrowLeft size={16} aria-hidden /> All tables
            </Link>
          )}
          {selectedTable ? (
            <RowsGrid
              key={selectedTable.id}
              workspaceId={workspaceId ?? ''}
              projectId={projectId}
              datasourceId={datasourceId}
              table={selectedTable}
            />
          ) : tableId ? (
            <EmptyState
              message="Table not found"
              description="It may have been removed by the last schema sync."
            />
          ) : (
            <div className="data-explorer__placeholder">
              <EmptyState
                icon={<Table2 size={48} />}
                message="Select a table"
                description="Pick a table on the left to browse its rows."
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export { DataExplorerPage };
