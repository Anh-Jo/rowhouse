import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Database, Plus } from 'lucide-react';
import { Badge } from '@/components/Badge/Badge';
import { Button } from '@/components/Button/Button';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { FormError } from '@/components/FormError/FormError';
import { listDatasources } from '@/api/datasources';
import { datasourceKeys } from '@/api/query-keys';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import './DatasourceListPage.css';

/**
 * Landing screen of a project: its registered datasources. Each entry opens
 * the schema browser; the empty state funnels into the connect flow.
 */
function DatasourceListPage() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const { workspaceId } = useWorkspaceId();

  const { data, isPending, error } = useQuery({
    queryKey: datasourceKeys.list(workspaceId ?? '', projectId),
    queryFn: () => listDatasources(workspaceId ?? '', projectId),
    enabled: workspaceId !== null,
  });

  if (workspaceId === null || isPending) {
    return null;
  }
  if (error) {
    return <FormError message={error.message} />;
  }

  const datasources = data?.items ?? [];

  return (
    <div className="datasource-list">
      <header className="datasource-list__header">
        <h1 className="datasource-list__title">Datasources</h1>
        {datasources.length > 0 && (
          <Button
            icon={<Plus size={16} />}
            onClick={() => navigate(`/projects/${projectId}/datasources/new`)}
          >
            Connect a database
          </Button>
        )}
      </header>

      {datasources.length === 0 ? (
        <div className="datasource-list__empty">
          <EmptyState
            icon={<Database size={48} />}
            message="No database connected yet"
            description="Connect a PostgreSQL database with two least-privilege roles to start browsing its schema."
          />
          <Button
            size="lg"
            icon={<Plus size={16} />}
            onClick={() => navigate(`/projects/${projectId}/datasources/new`)}
          >
            Connect a database
          </Button>
        </div>
      ) : (
        <ul className="datasource-list__items">
          {datasources.map((datasource) => (
            <li key={datasource.id}>
              <Link
                className="datasource-list__item"
                to={`/projects/${projectId}/datasources/${datasource.id}/schema`}
              >
                <span className="datasource-list__item-icon">
                  <Database size={20} aria-hidden />
                </span>
                <span className="datasource-list__item-body">
                  <span className="datasource-list__item-name">
                    {datasource.name}
                  </span>
                  <span className="datasource-list__item-target">
                    {datasource.host}:{datasource.port}/{datasource.database}
                  </span>
                </span>
                <span className="datasource-list__item-badges">
                  {datasource.sslMode === 'REQUIRE' ? (
                    <Badge label="TLS" variant="success" />
                  ) : (
                    <Badge label="No TLS" variant="warning" />
                  )}
                  <Badge label={datasource.type} variant="muted" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { DatasourceListPage };
