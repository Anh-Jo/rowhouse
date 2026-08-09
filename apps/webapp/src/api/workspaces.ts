import { authClient } from '@/api/auth-client';
import { ApiError } from '@/api/errors';

export type Workspace = {
  id: string;
  name: string;
  slug: string;
};

/**
 * Lists the signed-in user's workspaces (better-auth organizations).
 *
 * Deliberately a plain call driven by TanStack Query instead of better-auth's
 * reactive `useListOrganizations` store: that store fetches once, on its very
 * first mount, and its signal subscriptions are torn down when the last
 * consumer unmounts — so a client that read an empty list before onboarding
 * kept serving that empty list forever. The app shell's guard then bounced a
 * user who had *just* created a workspace back to onboarding, endlessly.
 * Owning the cache here makes freshness ours to control (invalidate on
 * create), like every other resource in `src/api/`.
 */
export async function listWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await authClient.organization.list();
  if (error || !data) {
    throw new ApiError(
      error?.message ?? 'Could not load your workspaces, please try again.',
      error?.status ?? null,
    );
  }
  return data.map(({ id, name, slug }) => ({ id, name, slug }));
}
