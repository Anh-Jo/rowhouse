import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, KeyRound } from 'lucide-react';
import { Badge } from '@/components/Badge/Badge';
import { Button } from '@/components/Button/Button';
import { Checkbox } from '@/components/Checkbox/Checkbox';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { FormError } from '@/components/FormError/FormError';
import { Textarea } from '@/components/Textarea/Textarea';
import { schemaKeys } from '@/api/query-keys';
import {
  getDatasourceSchema,
  updateColumnMetadata,
  updateTableMetadata,
  type SchemaTableDto,
  type UpdateColumnMetadataInput,
} from '@/api/schema';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import './TableDetailPage.css';

type TableColumn = SchemaTableDto['columns'][number];

/**
 * Detail screen of one table (list + detail pattern — decision D7): columns
 * with type/nullability/keys, plus the team-owned metadata editing —
 * table/column descriptions and the PII flag that feeds P2 masking.
 */
function TableDetailPage() {
  const { projectId = '', datasourceId = '', tableId = '' } = useParams();
  const { workspaceId } = useWorkspaceId();
  const queryClient = useQueryClient();
  const [expandedColumnId, setExpandedColumnId] = useState<string | null>(null);

  const schemaQuery = useQuery({
    queryKey: schemaKeys.byDatasource(workspaceId ?? '', projectId, datasourceId),
    queryFn: () => getDatasourceSchema(workspaceId ?? '', projectId, datasourceId),
    enabled: workspaceId !== null,
  });

  const invalidateSchema = () =>
    queryClient.invalidateQueries({
      queryKey: schemaKeys.byDatasource(
        workspaceId ?? '',
        projectId,
        datasourceId,
      ),
    });

  const tableMutation = useMutation({
    mutationFn: (description: string | null) =>
      updateTableMetadata(
        workspaceId ?? '',
        projectId,
        datasourceId,
        tableId,
        { description },
      ),
    onSuccess: invalidateSchema,
  });

  const columnMutation = useMutation({
    mutationFn: (variables: {
      columnId: string;
      input: UpdateColumnMetadataInput;
    }) =>
      updateColumnMetadata(
        workspaceId ?? '',
        projectId,
        datasourceId,
        variables.columnId,
        variables.input,
      ),
    onSuccess: invalidateSchema,
  });

  if (workspaceId === null || schemaQuery.isPending) {
    return null;
  }
  if (schemaQuery.error) {
    return <FormError message={schemaQuery.error.message} />;
  }

  const tables = schemaQuery.data.tables;
  const table = tables.find((candidate) => candidate.id === tableId);
  const backPath = `/projects/${projectId}/datasources/${datasourceId}/schema`;

  if (!table) {
    return (
      <div className="table-detail">
        <Link className="table-detail__back" to={backPath}>
          <ArrowLeft size={16} aria-hidden /> All tables
        </Link>
        <EmptyState message="Table not found" description="It may have been removed by the last schema sync." />
      </div>
    );
  }

  /** FK targets are stored by name — resolve to a table id for navigation. */
  const findTableIdByName = (name: string): string | null =>
    tables.find((candidate) => candidate.name === name)?.id ?? null;

  const mutationError = tableMutation.error ?? columnMutation.error;

  return (
    <div className="table-detail">
      <Link className="table-detail__back" to={backPath}>
        <ArrowLeft size={16} aria-hidden /> All tables
      </Link>

      <header className="table-detail__header">
        <h1 className="table-detail__title">{table.name}</h1>
        <Badge label={table.schema} variant="muted" />
      </header>

      {mutationError && <FormError message={mutationError.message} />}

      <TableDescriptionEditor
        key={table.id}
        table={table}
        saving={tableMutation.isPending}
        onSave={(description) => tableMutation.mutate(description)}
      />

      <ul className="table-detail__columns">
        {table.columns.map((column) => {
          const expanded = expandedColumnId === column.id;
          const refTableId = column.refTable
            ? findTableIdByName(column.refTable)
            : null;
          return (
            <li key={column.id} className="table-detail__column">
              <button
                type="button"
                className="table-detail__column-row"
                aria-expanded={expanded}
                onClick={() =>
                  setExpandedColumnId(expanded ? null : column.id)
                }
              >
                <span className="table-detail__column-chevron">
                  {expanded ? (
                    <ChevronDown size={16} aria-hidden />
                  ) : (
                    <ChevronRight size={16} aria-hidden />
                  )}
                </span>
                <span className="table-detail__column-name">{column.name}</span>
                <span className="table-detail__column-type">
                  {column.dataType}
                  {column.isNullable ? '' : ' · not null'}
                </span>
                <span className="table-detail__column-badges">
                  {column.isPrimaryKey && (
                    <span className="table-detail__pk" title="Primary key">
                      <KeyRound size={12} aria-hidden />
                      PK
                    </span>
                  )}
                  {column.isPii && <Badge label="PII" variant="warning" />}
                </span>
              </button>

              {column.refTable && (
                <div className="table-detail__column-fk">
                  FK →{' '}
                  {refTableId ? (
                    <Link
                      to={`${backPath}/tables/${refTableId}`}
                      onClick={() => setExpandedColumnId(null)}
                    >
                      {column.refTable}
                    </Link>
                  ) : (
                    column.refTable
                  )}
                  {column.refColumn ? `.${column.refColumn}` : ''}
                </div>
              )}

              {expanded && (
                <ColumnMetadataEditor
                  key={column.id}
                  column={column}
                  saving={columnMutation.isPending}
                  onSaveDescription={(description) =>
                    columnMutation.mutate({
                      columnId: column.id,
                      input: { description },
                    })
                  }
                  onTogglePii={(isPii) =>
                    columnMutation.mutate({
                      columnId: column.id,
                      input: { isPii },
                    })
                  }
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TableDescriptionEditor({
  table,
  saving,
  onSave,
}: {
  table: SchemaTableDto;
  saving: boolean;
  onSave: (description: string | null) => void;
}) {
  const [draft, setDraft] = useState(table.description ?? '');
  const dirty = draft !== (table.description ?? '');

  return (
    <div className="table-detail__description">
      <Textarea
        label="Table description"
        placeholder="What does this table hold? Visible to the whole team."
        rows={2}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      {dirty && (
        <Button
          size="sm"
          variant="secondary"
          disabled={saving}
          onClick={() => onSave(draft.trim().length === 0 ? null : draft.trim())}
        >
          {saving ? 'Saving…' : 'Save description'}
        </Button>
      )}
    </div>
  );
}

function ColumnMetadataEditor({
  column,
  saving,
  onSaveDescription,
  onTogglePii,
}: {
  column: TableColumn;
  saving: boolean;
  onSaveDescription: (description: string | null) => void;
  onTogglePii: (isPii: boolean) => void;
}) {
  const [draft, setDraft] = useState(column.description ?? '');
  const dirty = draft !== (column.description ?? '');

  return (
    <div className="table-detail__column-editor">
      <Textarea
        label={`Description of ${column.name}`}
        placeholder="What does this column mean?"
        rows={2}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      {dirty && (
        <Button
          size="sm"
          variant="secondary"
          disabled={saving}
          onClick={() =>
            onSaveDescription(draft.trim().length === 0 ? null : draft.trim())
          }
        >
          {saving ? 'Saving…' : 'Save description'}
        </Button>
      )}
      <Checkbox
        id={`pii-${column.id}`}
        label="Personal data (PII) — masked for non-approved roles from P2"
        checked={column.isPii}
        disabled={saving}
        onCheckedChange={onTogglePii}
      />
    </div>
  );
}

export { TableDetailPage };
