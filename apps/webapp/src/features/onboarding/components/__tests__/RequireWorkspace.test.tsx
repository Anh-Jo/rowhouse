import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/api/errors';
import type { Workspace } from '@/api/workspaces';
import { RequireWorkspace } from '../RequireWorkspace';

const { listWorkspaces } = vi.hoisted(() => ({
  listWorkspaces: vi.fn<() => Promise<Workspace[]>>(),
}));

vi.mock('@/api/workspaces', () => ({ listWorkspaces }));

function renderGuard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <RequireWorkspace>
                <div>app shell</div>
              </RequireWorkspace>
            }
          />
          <Route path="/onboarding" element={<div>onboarding</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RequireWorkspace', () => {
  beforeEach(() => {
    listWorkspaces.mockReset();
  });

  it('renders the app shell once a workspace is found', async () => {
    listWorkspaces.mockResolvedValue([
      { id: 'org-1', name: 'Acme', slug: 'acme' },
    ]);

    renderGuard();

    expect(await screen.findByText('app shell')).toBeInTheDocument();
  });

  it('sends a user without any workspace to onboarding', async () => {
    listWorkspaces.mockResolvedValue([]);

    renderGuard();

    expect(await screen.findByText('onboarding')).toBeInTheDocument();
  });

  it('shows nothing while the workspace list is loading', () => {
    listWorkspaces.mockImplementation(() => new Promise(() => {}));

    renderGuard();

    expect(screen.queryByText('app shell')).not.toBeInTheDocument();
    expect(screen.queryByText('onboarding')).not.toBeInTheDocument();
  });

  it('surfaces a failed lookup instead of redirecting to onboarding', async () => {
    // A failed fetch is not an empty workspace list: redirecting here is what
    // used to send users into an endless "create a workspace" loop.
    listWorkspaces.mockRejectedValue(new ApiError('Network is down', null));

    renderGuard();

    expect(await screen.findByText('Network is down')).toBeInTheDocument();
    expect(screen.queryByText('onboarding')).not.toBeInTheDocument();
  });
});
