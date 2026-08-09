import { useQuery } from '@tanstack/react-query';
import { authClient } from '@/api/auth-client';

/** Better-auth organization roles, most-privileged first. */
const WRITE_ROLES: ReadonlySet<string> = new Set(['owner', 'admin']);

/** Whether a workspace role may edit records (mirrors the server capability). */
export function canEditRecords(role: string | null): boolean {
  return role !== null && WRITE_ROLES.has(role);
}

/**
 * The signed-in user's role in a workspace (better-auth organization member
 * role: owner | admin | member), used to gate capability affordances in the
 * UI — the server stays the authority, guarding every write regardless.
 *
 * The role comes from the active member; P1 has no workspace switcher, so when
 * the active organization isn't the one we're viewing we make it active first,
 * then read the role. Returns null while pending or when it can't be resolved
 * (the UI then simply hides write affordances — the server still enforces).
 */
export function useWorkspaceRole(workspaceId: string | null): {
  role: string | null;
  isPending: boolean;
} {
  const { data, isPending } = useQuery({
    queryKey: ['workspace-role', workspaceId],
    enabled: workspaceId !== null,
    queryFn: async (): Promise<string | null> => {
      if (workspaceId === null) return null;
      const active = await authClient.organization.getActiveMember();
      if (active.data && active.data.organizationId === workspaceId) {
        return active.data.role ?? null;
      }
      await authClient.organization.setActive({ organizationId: workspaceId });
      const refreshed = await authClient.organization.getActiveMember();
      return refreshed.data?.role ?? null;
    },
  });
  return { role: data ?? null, isPending };
}
