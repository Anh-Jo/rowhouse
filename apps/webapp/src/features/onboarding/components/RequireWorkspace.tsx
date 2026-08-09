import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { FormError } from '@/components/FormError/FormError';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';

/**
 * Route wrapper for the app shell: a signed-in user without any workspace
 * (better-auth organization) is sent to onboarding to create one.
 *
 * A failed lookup renders the error instead of redirecting — bouncing to
 * onboarding on anything other than a confirmed empty list is what turns a
 * hiccup into "create a workspace forever".
 */
function RequireWorkspace({ children }: { children: ReactNode }) {
  const { workspaceId, isPending, error } = useWorkspaceId();

  if (isPending) {
    return null;
  }
  if (error) {
    return <FormError message={error.message} />;
  }
  if (workspaceId === null) {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}

export { RequireWorkspace };
