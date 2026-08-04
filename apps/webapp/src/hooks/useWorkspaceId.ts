import { useListOrganizations } from '@/api/auth-client';

/**
 * Resolves the current workspace (better-auth organization) id for API calls.
 * P0 flows create exactly one workspace per user (onboarding), so the first
 * organization is the current one; a workspace switcher (P2, multi-workspace)
 * will replace this with the session's active organization.
 */
function useWorkspaceId(): { workspaceId: string | null; isPending: boolean } {
  const { data: organizations, isPending } = useListOrganizations();
  return { workspaceId: organizations?.[0]?.id ?? null, isPending };
}

export { useWorkspaceId };
