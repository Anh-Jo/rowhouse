import { fetchClient } from '@/api/client';
import { unwrapApiResult } from '@/api/errors';
import type { components } from '@/api/generated/schema.d.ts';

export type DatasourceDto = components['schemas']['DatasourceDto_Output'];
export type DatasourcePageDto = components['schemas']['DatasourcePageDto_Output'];
export type CreateDatasourceInput = components['schemas']['CreateDatasourceDto'];
export type UpdateDatasourceInput = components['schemas']['UpdateDatasourceDto'];
export type ConnectionTestResult = components['schemas']['ConnectionTestDto_Output'];
export type CloudSqlSnippetInput = components['schemas']['CloudSqlSnippetRequestDto'];
export type CloudSqlSnippetResult = components['schemas']['CloudSqlSnippetDto_Output'];

// The contract declares every path param (`@ApiParam` on the controllers covers
// the guard-resolved `:workspaceId`), so openapi-fetch substitutes them all —
// no manual path substitution needed.

export async function listDatasources(
  workspaceId: string,
  projectId: string,
): Promise<DatasourcePageDto> {
  return unwrapApiResult(
    await fetchClient.GET(
      '/workspaces/{workspaceId}/projects/{projectId}/datasources',
      { params: { path: { workspaceId, projectId } } },
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
      '/workspaces/{workspaceId}/projects/{projectId}/datasources/{datasourceId}',
      { params: { path: { workspaceId, projectId, datasourceId } } },
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
      '/workspaces/{workspaceId}/projects/{projectId}/datasources',
      { params: { path: { workspaceId, projectId } }, body: input },
    ),
  );
}

export async function updateDatasource(
  workspaceId: string,
  projectId: string,
  datasourceId: string,
  input: UpdateDatasourceInput,
): Promise<DatasourceDto> {
  return unwrapApiResult(
    await fetchClient.PATCH(
      '/workspaces/{workspaceId}/projects/{projectId}/datasources/{datasourceId}',
      { params: { path: { workspaceId, projectId, datasourceId } }, body: input },
    ),
  );
}

/**
 * Least-privilege Cloud SQL onboarding script (gcloud + SQL), derived from
 * the instance + database the user typed. POST because the script is built
 * from the body — it reads nothing and writes nothing.
 */
export async function buildCloudSqlSnippet(
  workspaceId: string,
  input: CloudSqlSnippetInput,
): Promise<CloudSqlSnippetResult> {
  return unwrapApiResult(
    await fetchClient.POST(
      '/workspaces/{workspaceId}/datasource-role-snippet/cloud-sql',
      { params: { path: { workspaceId } }, body: input },
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
      '/workspaces/{workspaceId}/projects/{projectId}/datasources/{datasourceId}/test-connection',
      { params: { path: { workspaceId, projectId, datasourceId } } },
    ),
  );
}
