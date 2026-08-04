import { fetchClient } from '@/api/client';
import { unwrapApiResult } from '@/api/errors';
import type { components } from '@/api/generated/schema.d.ts';

export type DatasourceSchemaDto = components['schemas']['DatasourceSchemaDto_Output'];
export type SchemaTableDto = components['schemas']['SchemaTableDto_Output'];
export type SchemaColumnDto = components['schemas']['SchemaColumnDto_Output'];
export type SyncResultDto = components['schemas']['SyncResultDto_Output'];
export type UpdateTableMetadataInput = components['schemas']['UpdateTableMetadataDto'];
export type UpdateColumnMetadataInput = components['schemas']['UpdateColumnMetadataDto'];

/**
 * `:workspaceId` — and `:datasourceId` on the metadata PATCH routes — are
 * resolved by backend guards, so the generated contract declares no `path`
 * parameter for them (same substitution pattern as `@/api/projects` — see the
 * comment there). Guard-resolved ids are substituted manually below; the ids
 * the contract does declare stay as `{...}` templates for openapi-fetch.
 */
type SchemaPath =
  '/workspaces/{workspaceId}/projects/{projectId}/datasources/{datasourceId}/schema';
type SchemaSyncPath =
  '/workspaces/{workspaceId}/projects/{projectId}/datasources/{datasourceId}/schema/sync';
type SchemaTablePath =
  '/workspaces/{workspaceId}/projects/{projectId}/datasources/{datasourceId}/schema/tables/{tableId}';
type SchemaColumnPath =
  '/workspaces/{workspaceId}/projects/{projectId}/datasources/{datasourceId}/schema/columns/{columnId}';

function substituteGuardParams<P extends string>(
  path: P,
  ids: { workspaceId: string; datasourceId?: string },
): P {
  let result: string = path.replace(
    '{workspaceId}',
    encodeURIComponent(ids.workspaceId),
  );
  if (ids.datasourceId !== undefined) {
    result = result.replace(
      '{datasourceId}',
      encodeURIComponent(ids.datasourceId),
    );
  }
  return result as P;
}

export async function getDatasourceSchema(
  workspaceId: string,
  projectId: string,
  datasourceId: string,
): Promise<DatasourceSchemaDto> {
  return unwrapApiResult(
    await fetchClient.GET(
      substituteGuardParams<SchemaPath>(
        '/workspaces/{workspaceId}/projects/{projectId}/datasources/{datasourceId}/schema',
        { workspaceId },
      ),
      { params: { path: { projectId, datasourceId } } },
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
      substituteGuardParams<SchemaSyncPath>(
        '/workspaces/{workspaceId}/projects/{projectId}/datasources/{datasourceId}/schema/sync',
        { workspaceId },
      ),
      { params: { path: { projectId, datasourceId } } },
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
      substituteGuardParams<SchemaTablePath>(
        '/workspaces/{workspaceId}/projects/{projectId}/datasources/{datasourceId}/schema/tables/{tableId}',
        { workspaceId, datasourceId },
      ),
      { params: { path: { projectId, tableId } }, body: input },
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
      substituteGuardParams<SchemaColumnPath>(
        '/workspaces/{workspaceId}/projects/{projectId}/datasources/{datasourceId}/schema/columns/{columnId}',
        { workspaceId, datasourceId },
      ),
      { params: { path: { projectId, columnId } }, body: input },
    ),
  );
}
