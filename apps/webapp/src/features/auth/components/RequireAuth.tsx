import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '@/api/auth-client';

/**
 * Route wrapper for the authenticated area: renders nothing while the session
 * is being resolved, redirects to sign-in when there is none.
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return null;
  }
  if (!session) {
    return <Navigate to="/sign-in" replace />;
  }
  return children;
}

export { RequireAuth };
