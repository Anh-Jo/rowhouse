import { useQuery } from '@tanstack/react-query';
import { listWorkspaces } from '@/api/workspaces';
import { workspaceKeys } from '@/api/query-keys';

/**
 * Resolves the current workspace (better-auth organization) id for API calls.
 * P0 flows create exactly one workspace per user (onboarding), so the first
 * organization is the current one; a workspace switcher (P2, multi-workspace)
 * will replace this with the session's active organization.
 *
 * `error` is surfaced (never collapsed into "no workspace"): callers that
 * redirect on an empty list must not treat a failed fetch as a missing
 * workspace, or a transient error turns into a redirect loop.
 */
function useWorkspaceId(): {
  workspaceId: string | null;
  isPending: boolean;
  error: Error | null;
} {
  const { data, isPending, error } = useQuery({
    queryKey: workspaceKeys.list(),
    queryFn: listWorkspaces,
  });
  return { workspaceId: data?.[0]?.id ?? null, isPending, error };
}

export { useWorkspaceId };
