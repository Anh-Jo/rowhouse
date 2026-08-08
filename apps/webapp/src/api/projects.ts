import { fetchClient } from '@/api/client';
import { unwrapApiResult } from '@/api/errors';
import type { components } from '@/api/generated/schema.d.ts';

export type ProjectDto = components['schemas']['ProjectDto_Output'];
export type ProjectPageDto = components['schemas']['ProjectPageDto_Output'];
export type CreateProjectInput = components['schemas']['CreateProjectDto'];

// The contract declares every path param (`@ApiParam` on the controllers covers
// the guard-resolved `:workspaceId`), so openapi-fetch substitutes them all —
// no manual path substitution needed.

export async function listProjects(workspaceId: string): Promise<ProjectPageDto> {
  return unwrapApiResult(
    await fetchClient.GET('/workspaces/{workspaceId}/projects', {
      params: { path: { workspaceId } },
    }),
  );
}

export async function createProject(
  workspaceId: string,
  input: CreateProjectInput,
): Promise<ProjectDto> {
  return unwrapApiResult(
    await fetchClient.POST('/workspaces/{workspaceId}/projects', {
      params: { path: { workspaceId } },
      body: input,
    }),
  );
}
