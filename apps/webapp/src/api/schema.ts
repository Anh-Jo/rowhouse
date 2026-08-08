import { fetchClient } from '@/api/client';
import { unwrapApiResult } from '@/api/errors';
import type { components } from '@/api/generated/schema.d.ts';

export type DatasourceSchemaDto = components['schemas']['DatasourceSchemaDto_Output'];
export type SchemaTableDto = components['schemas']['SchemaTableDto_Output'];
export type SchemaColumnDto = components['schemas']['SchemaColumnDto_Output'];
export type SyncResultDto = components['schemas']['SyncResultDto_Output'];
export type UpdateTableMetadataInput = components['schemas']['UpdateTableMetadataDto'];
export type UpdateColumnMetadataInput = components['schemas']['UpdateColumnMetadataDto'];

// The contract declares every path param (`@ApiParam` on the controllers covers
// the guard-resolved `:workspaceId` and `:datasourceId`), so openapi-fetch
// substitutes them all — no manual path substitution needed.

export async function getDatasourceSchema(
  workspaceId: string,
  projectId: string,
  datasourceId: string,
): Promise<DatasourceSchemaDto> {
  return unwrapApiResult(
    await fetchClient.GET(
      '/workspaces/{workspaceId}/projects/{projectId}/datasources/{datasourceId}/schema',
      { params: { path: { workspaceId, projectId, datasourceId } } },
    ),
  );
}

export async function syncSchema(
  workspaceId: string,
  projectId: string,
  datasourceId: string,
): Promise<SyncResultDto> {
  return unwrapApiResult(
    await fetchClient.POST(
      '/workspaces/{workspaceId}/projects/{projectId}/datasources/{datasourceId}/schema/sync',
      { params: { path: { workspaceId, projectId, datasourceId } } },
    ),
  );
}

export async function updateTableMetadata(
  workspaceId: string,
  projectId: string,
  datasourceId: string,
  tableId: string,
  input: UpdateTableMetadataInput,
): Promise<SchemaTableDto> {
  return unwrapApiResult(
    await fetchClient.PATCH(
      '/workspaces/{workspaceId}/projects/{projectId}/datasources/{datasourceId}/schema/tables/{tableId}',
      {
        params: { path: { workspaceId, projectId, datasourceId, tableId } },
        body: input,
      },
    ),
  );
}

export async function updateColumnMetadata(
  workspaceId: string,
  projectId: string,
  datasourceId: string,
  columnId: string,
  input: UpdateColumnMetadataInput,
): Promise<SchemaColumnDto> {
  return unwrapApiResult(
    await fetchClient.PATCH(
      '/workspaces/{workspaceId}/projects/{projectId}/datasources/{datasourceId}/schema/columns/{columnId}',
      {
        params: { path: { workspaceId, projectId, datasourceId, columnId } },
        body: input,
      },
    ),
  );
}
