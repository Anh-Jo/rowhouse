import { fetchClient } from '@/api/client';
import { unwrapApiResult } from '@/api/errors';
import type { components } from '@/api/generated/schema.d.ts';

export type DatasourceDto = components['schemas']['DatasourceDto_Output'];
export type DatasourcePageDto = components['schemas']['DatasourcePageDto_Output'];
export type CreateDatasourceInput = components['schemas']['CreateDatasourceDto'];
export type ConnectionTestResult = components['schemas']['ConnectionTestDto_Output'];

/**
 * `:workspaceId` is resolved by a backend guard, so the generated contract
 * declares no `path` parameter for it (same substitution pattern as
 * `@/api/projects` — see the comment there). The other ids stay as `{...}`
 * templates so openapi-fetch substitutes them from the typed `params.path`.
 */
type DatasourcesPath =
  '/workspaces/{workspaceId}/projects/{projectId}/datasources';
type DatasourcePath =
  '/workspaces/{workspaceId}/projects/{projectId}/datasources/{datasourceId}';
type TestConnectionPath =
  '/workspaces/{workspaceId}/projects/{projectId}/datasources/{datasourceId}/test-connection';

function withWorkspace<P extends string>(workspaceId: string, path: P): P {
  return path.replace(
    '{workspaceId}',
    encodeURIComponent(workspaceId),
  ) as P;
}

export async function listDatasources(
  workspaceId: string,
  projectId: string,
): Promise<DatasourcePageDto> {
  return unwrapApiResult(
    await fetchClient.GET(
      withWorkspace<DatasourcesPath>(
        workspaceId,
        '/workspaces/{workspaceId}/projects/{projectId}/datasources',
      ),
      { params: { path: { projectId } } },
    ),
  );
}

export async function getDatasource(
  workspaceId: string,
  projectId: string,
  datasourceId: string,
): Promise<DatasourceDto> {
  return unwrapApiResult(
    await fetchClient.GET(
      withWorkspace<DatasourcePath>(
        workspaceId,
        '/workspaces/{workspaceId}/projects/{projectId}/datasources/{datasourceId}',
      ),
      { params: { path: { projectId, datasourceId } } },
    ),
  );
}

export async function createDatasource(
  workspaceId: string,
  projectId: string,
  input: CreateDatasourceInput,
): Promise<DatasourceDto> {
  return unwrapApiResult(
    await fetchClient.POST(
      withWorkspace<DatasourcesPath>(
        workspaceId,
        '/workspaces/{workspaceId}/projects/{projectId}/datasources',
      ),
      { params: { path: { projectId } }, body: input },
    ),
  );
}

export async function testConnection(
  workspaceId: string,
  projectId: string,
  datasourceId: string,
): Promise<ConnectionTestResult> {
  return unwrapApiResult(
    await fetchClient.POST(
      withWorkspace<TestConnectionPath>(
        workspaceId,
        '/workspaces/{workspaceId}/projects/{projectId}/datasources/{datasourceId}/test-connection',
      ),
      { params: { path: { projectId, datasourceId } } },
    ),
  );
}
