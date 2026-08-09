import { createAuthClient } from 'better-auth/react';
import { organizationClient } from 'better-auth/client/plugins';
import { API_BASE } from '@/api/client';

/**
 * Typed better-auth client. It talks to the backend's `/api/auth/*` surface
 * (outside the OpenAPI contract — see the backend AuthController). Workspaces
 * are better-auth organizations (transverse decision D9), hence the
 * organization plugin client.
 */
export const authClient = createAuthClient({
  baseURL: API_BASE,
  fetchOptions: {
    // Session cookies must travel cross-origin (Vite dev server / deployed SPA).
    credentials: 'include',
  },
  plugins: [organizationClient()],
});

/** Reactive session hook — `{ data, isPending }`, `data` null when signed out. */
export const useSession = authClient.useSession;

// The workspace list is NOT exposed through better-auth's reactive
// `useListOrganizations` store: it fetches once and stops refetching after its
// last consumer unmounts, which stranded the app on a stale empty list. It is
// fetched through TanStack Query instead — see `src/api/workspaces.ts`.

/** Ends the current session server-side and clears the cookie. */
export async function signOut(): Promise<void> {
  await authClient.signOut();
}
