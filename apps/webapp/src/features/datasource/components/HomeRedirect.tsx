import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { FolderOpen } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { FormError } from '@/components/FormError/FormError';
import { listProjects } from '@/api/projects';
import { projectKeys } from '@/api/query-keys';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';

/**
 * Index route of the app shell: sends the user to their project's datasource
 * list (P0 flows create a single project during onboarding). A workspace
 * whose onboarding was abandoned before the project step gets an explicit
 * empty state instead of a dead redirect loop.
 */
function HomeRedirect() {
  const { workspaceId } = useWorkspaceId();

  const { data, isPending, error } = useQuery({
    queryKey: projectKeys.list(workspaceId ?? ''),
    queryFn: () => listProjects(workspaceId ?? ''),
    enabled: workspaceId !== null,
  });

  if (workspaceId === null || isPending) {
    return null;
  }
  if (error) {
    return <FormError message={error.message} />;
  }

  const firstProject = data?.items[0];
  if (!firstProject) {
    return (
      <EmptyState
        icon={<FolderOpen size={48} />}
        message="No project in this workspace yet"
        description="Finish onboarding to create your first project, then connect a database."
      />
    );
  }

  return (
    <Navigate to={`/projects/${firstProject.id}/datasources`} replace />
  );
}

export { HomeRedirect };
