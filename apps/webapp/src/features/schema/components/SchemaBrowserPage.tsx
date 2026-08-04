import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router-dom';
import { RefreshCw, Search, Table2 } from 'lucide-react';
import { Badge } from '@/components/Badge/Badge';
import { Button } from '@/components/Button/Button';
import { Callout } from '@/components/Callout/Callout';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { FormError } from '@/components/FormError/FormError';
import { Input } from '@/components/Input/Input';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { getDatasource } from '@/api/datasources';
import { datasourceKeys, schemaKeys } from '@/api/query-keys';
import {
  getDatasourceSchema,
  syncSchema,
  type SyncResultDto,
} from '@/api/schema';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import './SchemaBrowserPage.css';

function formatSyncResult(result: SyncResultDto): string {
  return `Schema synced — ${result.tablesCreated} new, ${result.tablesRemoved} removed, ${result.tablesKept} kept.`;
}

/**
 * Schema browser entry screen: the datasource's tables, searchable, each
 * opening the table detail (list + detail pattern — decision D7). Re-sync
 * refreshes the snapshot and reports the diff; team metadata survives it.
 */
function SchemaBrowserPage() {
  const { projectId = '', datasourceId = '' } = useParams();
  // The connect flow runs the first sync and hands its result over on
  // navigation, so the fresh browser shows the same feedback as a re-sync.
  const location = useLocation();
  const initialSyncResult =
    (location.state as { syncResult?: SyncResultDto } | null)?.syncResult ??
    null;
  const { workspaceId } = useWorkspaceId();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [syncResult, setSyncResult] = useState<SyncResultDto | null>(
    initialSyncResult,
  );

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

  const syncMutation = useMutation({
    mutationFn: () => syncSchema(workspaceId ?? '', projectId, datasourceId),
    onSuccess: async (result) => {
      setSyncResult(result);
      await queryClient.invalidateQueries({
        queryKey: schemaKeys.byDatasource(
          workspaceId ?? '',
          projectId,
          datasourceId,
        ),
      });
    },
  });

  const tables = useMemo(() => {
    const all = schemaQuery.data?.tables ?? [];
    const needle = search.trim().toLowerCase();
    if (needle.length === 0) {
      return all;
    }
    return all.filter(
      (table) =>
        table.name.toLowerCase().includes(needle) ||
        table.schema.toLowerCase().includes(needle) ||
        (table.description?.toLowerCase().includes(needle) ?? false),
    );
  }, [schemaQuery.data, search]);

  if (!enabled || schemaQuery.isPending) {
    return null;
  }
  if (schemaQuery.error) {
    return <FormError message={schemaQuery.error.message} />;
  }

  const schema = schemaQuery.data;
  const neverSynced = schema.syncedAt === null && schema.tables.length === 0;

  return (
    <div className="schema-browser">
      <PageHeader
        title={datasourceQuery.data?.name ?? 'Schema'}
        subtitle={
          schema.syncedAt
            ? `Last synced ${new Date(schema.syncedAt).toLocaleString()}`
            : 'Never synced'
        }
        actions={
          <Button
            variant="secondary"
            icon={<RefreshCw size={16} />}
            disabled={syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
          >
            {syncMutation.isPending ? 'Syncing…' : 'Re-sync'}
          </Button>
        }
      />

      {syncMutation.error && <FormError message={syncMutation.error.message} />}
      {syncResult && (
        <Callout variant="success">{formatSyncResult(syncResult)}</Callout>
      )}

      {neverSynced ? (
        <div className="schema-browser__empty">
          <EmptyState
            icon={<Table2 size={48} />}
            message="Schema not synced yet"
            description="Run a sync to introspect the database and browse its tables."
          />
          <Button
            size="lg"
            disabled={syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
          >
            {syncMutation.isPending ? 'Syncing…' : 'Sync now'}
          </Button>
        </div>
      ) : (
        <>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tables…"
            icon={<Search size={16} />}
            aria-label="Search tables"
          />
          {tables.length === 0 ? (
            <EmptyState message="No table matches this search" />
          ) : (
            <ul className="schema-browser__tables">
              {tables.map((table) => (
                <li key={table.id}>
                  <Link
                    className="schema-browser__table"
                    to={`/projects/${projectId}/datasources/${datasourceId}/schema/tables/${table.id}`}
                  >
                    <span className="schema-browser__table-icon">
                      <Table2 size={18} aria-hidden />
                    </span>
                    <span className="schema-browser__table-body">
                      <span className="schema-browser__table-name">
                        {table.name}
                      </span>
                      {table.description && (
                        <span className="schema-browser__table-desc">
                          {table.description}
                        </span>
                      )}
                    </span>
                    <span className="schema-browser__table-meta">
                      <Badge label={table.schema} variant="muted" />
                      <span className="schema-browser__table-count">
                        {table.columns.length} columns
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export { SchemaBrowserPage };
