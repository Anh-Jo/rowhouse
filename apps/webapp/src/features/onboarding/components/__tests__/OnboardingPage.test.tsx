import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { OnboardingPage } from '../OnboardingPage';

type OrganizationResult = {
  data: { id: string } | null;
  error: { message?: string; status: number } | null;
};

const { organizationCreate, organizationSetActive, createProject } = vi.hoisted(
  () => ({
    organizationCreate:
      vi.fn<
        (input: { name: string; slug: string }) => Promise<OrganizationResult>
      >(),
    organizationSetActive:
      vi.fn<
        (input: { organizationId: string }) => Promise<OrganizationResult>
      >(),
    createProject:
      vi.fn<
        (
          workspaceId: string,
          input: { name: string },
        ) => Promise<{ id: string; name: string }>
      >(),
  }),
);

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

function renderOnboarding() {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OnboardingPage', () => {
  beforeEach(() => {
    organizationCreate.mockReset();
    organizationSetActive.mockReset();
    createProject.mockReset();
  });

  it('walks through workspace then project creation and lands home', async () => {
    organizationCreate.mockResolvedValue({
      data: { id: 'org-1' },
      error: null,
    });
    organizationSetActive.mockResolvedValue({
      data: { id: 'org-1' },
      error: null,
    });
    createProject.mockResolvedValue({ id: 'proj-1', name: 'Prod' });
    const user = userEvent.setup();
    renderOnboarding();

    // Step 1 — create the workspace.
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Workspace name'), 'Acme Corp');
    await user.click(
      screen.getByRole('button', { name: 'Create workspace' }),
    );

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
  });

  it('requires a workspace name before calling the API', async () => {
    const user = userEvent.setup();
    renderOnboarding();

    await user.click(
      screen.getByRole('button', { name: 'Create workspace' }),
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

    await user.type(screen.getByLabelText('Workspace name'), 'Acme');
    await user.click(
      screen.getByRole('button', { name: 'Create workspace' }),
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Organization slug is taken');
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    expect(organizationSetActive).not.toHaveBeenCalled();
  });

  it('surfaces a project creation error inline and stays on step 2', async () => {
    organizationCreate.mockResolvedValue({
      data: { id: 'org-1' },
      error: null,
    });
    organizationSetActive.mockResolvedValue({
      data: { id: 'org-1' },
      error: null,
    });
    createProject.mockRejectedValue(
      new Error('Project name already used in this workspace'),
    );
    const user = userEvent.setup();
    renderOnboarding();

    await user.type(screen.getByLabelText('Workspace name'), 'Acme');
    await user.click(
      screen.getByRole('button', { name: 'Create workspace' }),
    );
    await user.type(
      await screen.findByLabelText('Project name'),
      'Prod',
    );
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Project name already used in this workspace',
    );
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
  });
});
