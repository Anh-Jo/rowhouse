import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useListOrganizations } from '@/api/auth-client';

/**
 * Route wrapper for the app shell: a signed-in user without any workspace
 * (better-auth organization) is sent to onboarding to create one.
 */
function RequireWorkspace({ children }: { children: ReactNode }) {
  const { data: organizations, isPending } = useListOrganizations();

  if (isPending) {
    return null;
  }
  if (!organizations || organizations.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}

export { RequireWorkspace };
