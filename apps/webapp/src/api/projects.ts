import { fetchClient } from '@/api/client';
import type { components } from '@/api/generated/schema.d.ts';

export type ProjectDto = components['schemas']['ProjectDto_Output'];
export type CreateProjectInput = components['schemas']['CreateProjectDto'];

/**
 * The backend resolves `:workspaceId` in a guard (`@CurrentWorkspace`), not in
 * a handler `@Param`, so the generated contract declares no `path` parameter
 * for it. Substitute it here and assert the templated literal back to the
 * contract path so body/response stay fully typed. Revisit once the backend
 * documents the param (the assertion then becomes unnecessary).
 */
type ProjectsPath = '/workspaces/{workspaceId}/projects';

export async function createProject(
  workspaceId: string,
  input: CreateProjectInput,
): Promise<ProjectDto> {
  const { data, error } = await fetchClient.POST(
    `/workspaces/${encodeURIComponent(workspaceId)}/projects` as ProjectsPath,
    { body: input },
  );
  if (!data) {
    throw new Error(extractApiErrorMessage(error));
  }
  return data;
}

/**
 * Narrows an unknown error payload (Nest exception filter / nestjs-zod shape:
 * `{ message: string | string[] }`) down to a human-readable message.
 */
function extractApiErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
    if (Array.isArray(message) && message.every((m) => typeof m === 'string')) {
      return message.join(', ');
    }
  }
  return 'Unexpected server error, please try again.';
}
