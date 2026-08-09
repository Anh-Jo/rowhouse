import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/Button/Button';
import { FormError } from '@/components/FormError/FormError';
import { Input } from '@/components/Input/Input';
import { authClient } from '@/api/auth-client';
import { createProject } from '@/api/projects';
import { projectKeys, workspaceKeys } from '@/api/query-keys';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import { slugify } from '../helpers/slug';
import './OnboardingPage.css';

type WorkspaceFormValues = {
  workspaceName: string;
};

type ProjectFormValues = {
  projectName: string;
};

function validateRequiredName(label: string) {
  return (value: string): string | true => {
    if (value.trim().length === 0) {
      return `${label} is required`;
    }
    if (value.trim().length > 100) {
      return `${label} must be at most 100 characters`;
    }
    return true;
  };
}

const validateWorkspaceName = validateRequiredName('Workspace name');
const validateProjectName = validateRequiredName('Project name');

/**
 * First-run flow: create a workspace (better-auth organization), then the
 * first project inside it. Linear two-step wizard, mobile-first.
 *
 * The current step is derived from the workspaces the user actually has, not
 * only from what this component created: landing here with a workspace already
 * in place resumes at the project step instead of offering a second workspace.
 */
function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { workspaceId: existingWorkspaceId, isPending: isWorkspacePending } =
    useWorkspaceId();
  const [createdWorkspaceId, setCreatedWorkspaceId] = useState<string | null>(
    null,
  );
  const [apiError, setApiError] = useState<string | null>(null);

  const workspaceForm = useForm<WorkspaceFormValues>();
  const projectForm = useForm<ProjectFormValues>();

  const workspaceId = createdWorkspaceId ?? existingWorkspaceId;

  const onCreateWorkspace = async (values: WorkspaceFormValues) => {
    setApiError(null);
    const name = values.workspaceName.trim();
    const { data, error } = await authClient.organization.create({
      name,
      slug: slugify(name),
    });
    if (error || !data) {
      setApiError(
        error?.message ?? 'Could not create the workspace, please try again.',
      );
      return;
    }
    // Make the fresh workspace the active organization for this session.
    await authClient.organization.setActive({ organizationId: data.id });
    // The app shell's guard reads this list to decide whether onboarding is
    // still needed — refresh it now so the redirect at the end of the flow
    // lands on the app instead of bouncing straight back here.
    await queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    setCreatedWorkspaceId(data.id);
  };

  const onCreateProject = async (values: ProjectFormValues) => {
    if (!workspaceId) {
      return;
    }
    setApiError(null);
    try {
      await createProject(workspaceId, { name: values.projectName.trim() });
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : 'Could not create the project, please try again.',
      );
      return;
    }
    // Same reason as above: the home route picks the first project out of this
    // list to decide where to land.
    await queryClient.invalidateQueries({
      queryKey: projectKeys.list(workspaceId),
    });
    navigate('/', { replace: true });
  };

  // Resolve the existing workspaces before painting: otherwise a user who only
  // misses the project step sees the workspace form flash by.
  if (isWorkspacePending) {
    return null;
  }

  const step: 1 | 2 = workspaceId === null ? 1 : 2;

  return (
    <div className="onboarding">
      <main className="onboarding__card">
        <header className="onboarding__header">
          <span className="onboarding__brand">Rowhouse</span>
          <span className="onboarding__step">Step {step} of 2</span>
          <h1 className="onboarding__title">
            {step === 1 ? 'Create your workspace' : 'Create your first project'}
          </h1>
          <p className="onboarding__subtitle">
            {step === 1
              ? 'A workspace is where your team, projects and datasources live.'
              : 'A project groups the datasources of one product or environment.'}
          </p>
        </header>

        {step === 1 ? (
          <form
            // Distinct keys: both steps render the same component shapes, so
            // without a remount React would reuse the uncontrolled input DOM
            // node (and its value) across steps.
            key="workspace"
            className="onboarding__form"
            onSubmit={workspaceForm.handleSubmit(onCreateWorkspace)}
            noValidate
          >
            <FormError message={apiError} />
            <Input
              label="Workspace name"
              type="text"
              placeholder="Acme"
              error={workspaceForm.formState.errors.workspaceName?.message}
              {...workspaceForm.register('workspaceName', {
                validate: validateWorkspaceName,
              })}
            />
            <Button
              type="submit"
              size="lg"
              disabled={workspaceForm.formState.isSubmitting}
            >
              {workspaceForm.formState.isSubmitting
                ? 'Creating workspace…'
                : 'Create workspace'}
            </Button>
          </form>
        ) : (
          <form
            key="project"
            className="onboarding__form"
            onSubmit={projectForm.handleSubmit(onCreateProject)}
            noValidate
          >
            <FormError message={apiError} />
            <Input
              label="Project name"
              type="text"
              placeholder="Production"
              error={projectForm.formState.errors.projectName?.message}
              {...projectForm.register('projectName', {
                validate: validateProjectName,
              })}
            />
            <Button
              type="submit"
              size="lg"
              disabled={projectForm.formState.isSubmitting}
            >
              {projectForm.formState.isSubmitting
                ? 'Creating project…'
                : 'Create project'}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}

export { OnboardingPage };
