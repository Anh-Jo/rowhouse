import { fetchClient } from '@/api/client';
import { unwrapApiResult } from '@/api/errors';
import type { components } from '@/api/generated/schema.d.ts';

export type ProjectDto = components['schemas']['ProjectDto_Output'];
export type ProjectPageDto = components['schemas']['ProjectPageDto_Output'];
export type CreateProjectInput = components['schemas']['CreateProjectDto'];

/**
 * The backend resolves `:workspaceId` in a guard (`@CurrentWorkspace`), not in
 * a handler `@Param`, so the generated contract declares no `path` parameter
 * for it. Substitute it here and assert the templated literal back to the
 * contract path so body/response stay fully typed. Revisit once the backend
 * documents the param (the assertion then becomes unnecessary).
 */
type ProjectsPath = '/workspaces/{workspaceId}/projects';

function projectsPath(workspaceId: string): ProjectsPath {
  return `/workspaces/${encodeURIComponent(workspaceId)}/projects` as ProjectsPath;
}

export async function listProjects(workspaceId: string): Promise<ProjectPageDto> {
  return unwrapApiResult(await fetchClient.GET(projectsPath(workspaceId)));
}

export async function createProject(
  workspaceId: string,
  input: CreateProjectInput,
): Promise<ProjectDto> {
  return unwrapApiResult(
    await fetchClient.POST(projectsPath(workspaceId), { body: input }),
  );
}
