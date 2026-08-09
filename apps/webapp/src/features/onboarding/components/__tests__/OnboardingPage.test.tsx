import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Workspace } from '@/api/workspaces';
import { OnboardingPage } from '../OnboardingPage';
import { RequireWorkspace } from '../RequireWorkspace';

type OrganizationResult = {
  data: { id: string } | null;
  error: { message?: string; status: number } | null;
};

const {
  organizationCreate,
  organizationSetActive,
  createProject,
  listWorkspaces,
} = vi.hoisted(() => ({
  organizationCreate:
    vi.fn<
      (input: { name: string; slug: string }) => Promise<OrganizationResult>
    >(),
  organizationSetActive:
    vi.fn<(input: { organizationId: string }) => Promise<OrganizationResult>>(),
  createProject:
    vi.fn<
      (
        workspaceId: string,
        input: { name: string },
      ) => Promise<{ id: string; name: string }>
    >(),
  listWorkspaces: vi.fn<() => Promise<Workspace[]>>(),
}));

vi.mock('@/api/auth-client', () => ({
  authClient: {
    organization: {
      create: organizationCreate,
      setActive: organizationSetActive,
    },
  },
}));

vi.mock('@/api/projects', () => ({
  createProject,
}));

vi.mock('@/api/workspaces', () => ({
  listWorkspaces,
}));

/**
 * The home route is wrapped in the real `RequireWorkspace`: the bug this suite
 * guards against was the guard bouncing a user who had just finished
 * onboarding straight back to step 1, so "landed home" has to mean the guard
 * let them through, not merely that `navigate('/')` fired.
 */
function renderOnboarding() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/onboarding']}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route
            path="/"
            element={
              <RequireWorkspace>
                <div>home</div>
              </RequireWorkspace>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OnboardingPage', () => {
  beforeEach(() => {
    organizationCreate.mockReset();
    organizationSetActive.mockReset();
    createProject.mockReset();
    listWorkspaces.mockReset();
    listWorkspaces.mockResolvedValue([]);
  });

  /** Mimics the server: created workspaces show up in later list calls. */
  function withServerBackedWorkspaces() {
    const workspaces: Workspace[] = [];
    listWorkspaces.mockImplementation(async () => [...workspaces]);
    organizationCreate.mockImplementation(async ({ name, slug }) => {
      workspaces.push({ id: 'org-1', name, slug });
      return { data: { id: 'org-1' }, error: null };
    });
    organizationSetActive.mockResolvedValue({
      data: { id: 'org-1' },
      error: null,
    });
    return workspaces;
  }

  it('walks through workspace then project creation and lands home', async () => {
    withServerBackedWorkspaces();
    createProject.mockResolvedValue({ id: 'proj-1', name: 'Prod' });
    const user = userEvent.setup();
    renderOnboarding();

    // Step 1 — create the workspace.
    expect(await screen.findByText('Step 1 of 2')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Workspace name'), 'Acme Corp');
    await user.click(screen.getByRole('button', { name: 'Create workspace' }));

    expect(await screen.findByText('Step 2 of 2')).toBeInTheDocument();
    expect(organizationCreate).toHaveBeenCalledWith({
      name: 'Acme Corp',
      slug: 'acme-corp',
    });
    expect(organizationSetActive).toHaveBeenCalledWith({
      organizationId: 'org-1',
    });

    // Step 2 — create the first project.
    await user.type(screen.getByLabelText('Project name'), 'Prod');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(await screen.findByText('home')).toBeInTheDocument();
    expect(createProject).toHaveBeenCalledWith('org-1', { name: 'Prod' });
    // The whole point of the fix: no bounce back to the workspace form.
    expect(screen.queryByText('Step 1 of 2')).not.toBeInTheDocument();
    expect(organizationCreate).toHaveBeenCalledTimes(1);
  });

  it('resumes at the project step when a workspace already exists', async () => {
    listWorkspaces.mockResolvedValue([
      { id: 'org-1', name: 'Acme', slug: 'acme' },
    ]);
    createProject.mockResolvedValue({ id: 'proj-1', name: 'Prod' });
    const user = userEvent.setup();
    renderOnboarding();

    expect(await screen.findByText('Step 2 of 2')).toBeInTheDocument();
    expect(screen.queryByLabelText('Workspace name')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Project name'), 'Prod');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(await screen.findByText('home')).toBeInTheDocument();
    expect(createProject).toHaveBeenCalledWith('org-1', { name: 'Prod' });
    expect(organizationCreate).not.toHaveBeenCalled();
  });

  it('requires a workspace name before calling the API', async () => {
    const user = userEvent.setup();
    renderOnboarding();

    await user.click(
      await screen.findByRole('button', { name: 'Create workspace' }),
    );

    expect(
      await screen.findByText('Workspace name is required'),
    ).toBeInTheDocument();
    expect(organizationCreate).not.toHaveBeenCalled();
  });

  it('surfaces a workspace creation error inline and stays on step 1', async () => {
    organizationCreate.mockResolvedValue({
      data: null,
      error: { message: 'Organization slug is taken', status: 400 },
    });
    const user = userEvent.setup();
    renderOnboarding();

    await user.type(await screen.findByLabelText('Workspace name'), 'Acme');
    await user.click(screen.getByRole('button', { name: 'Create workspace' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Organization slug is taken');
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    expect(organizationSetActive).not.toHaveBeenCalled();
  });

  it('surfaces a project creation error inline and stays on step 2', async () => {
    withServerBackedWorkspaces();
    createProject.mockRejectedValue(
      new Error('Project name already used in this workspace'),
    );
    const user = userEvent.setup();
    renderOnboarding();

    await user.type(await screen.findByLabelText('Workspace name'), 'Acme');
    await user.click(screen.getByRole('button', { name: 'Create workspace' }));
    await user.type(await screen.findByLabelText('Project name'), 'Prod');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Project name already used in this workspace',
    );
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
  });
});
