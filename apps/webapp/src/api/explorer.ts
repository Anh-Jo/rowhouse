import { fetchClient } from '@/api/client';
import { unwrapApiResult } from '@/api/errors';
import type { components } from '@/api/generated/schema.d.ts';

export type RowPageDto = components['schemas']['RowPageDto_Output'];
export type RecordDetailDto = components['schemas']['RecordDetailDto_Output'];
export type UpdateRecordInput = components['schemas']['UpdateRecordDto'];
export type UpdatedRecordDto = components['schemas']['UpdatedRecordDto_Output'];

/**
 * One page of governed row reading (explorer module). `tableId` is a
 * SchemaTable id — the snapshot, not a client-supplied table name. `cursor`
 * is the opaque keyset cursor from the previous page; `nextCursor` is null
 * on the last page and for tables without a primary key (first page only).
 *
 * Refinements ride along pre-serialized, exactly as the server takes them:
 * `filters` is the JSON string of `[{column, op, value}]`, `sort` is
 * `column:asc|desc`, `search` a plain substring (see
 * `features/explorer/helpers/row-query.ts` for the builders). Invalid
 * refinements are a 400 with a precise, displayable message.
 */
export async function listTableRows(
  workspaceId: string,
  projectId: string,
  datasourceId: string,
  tableId: string,
  options: {
    cursor?: string;
    limit?: number;
    filters?: string;
    sort?: string;
    search?: string;
  } = {},
): Promise<RowPageDto> {
  return unwrapApiResult(
    await fetchClient.GET(
      '/workspaces/{workspaceId}/projects/{projectId}/datasources/{datasourceId}/tables/{tableId}/rows',
      {
        params: {
          path: { workspaceId, projectId, datasourceId, tableId },
          query: options,
        },
      },
    ),
  );
}

/**
 * One record plus everything it connects to: outgoing FKs resolved to the
 * referenced row, incoming FKs as per-table panels (count + first rows).
 * `rowKey` is the opaque key carried by every grid row; 400 for tables
 * without a primary key, 404 when the record is gone.
 */
export async function getTableRecord(
  workspaceId: string,
  projectId: string,
  datasourceId: string,
  tableId: string,
  rowKey: string,
): Promise<RecordDetailDto> {
  return unwrapApiResult(
    await fetchClient.GET(
      '/workspaces/{workspaceId}/projects/{projectId}/datasources/{datasourceId}/tables/{tableId}/rows/{rowKey}',
      {
        params: {
          path: { workspaceId, projectId, datasourceId, tableId, rowKey },
        },
      },
    ),
  );
}

/**
 * Applies a single-record edit — one governed, audited write on the READ_WRITE
 * role. `set` carries only the changed columns (snapshot columns, never the
 * PK); the server validates them and returns the persisted row. 403 when the
 * caller's workspace role may not write, 404 when the record is gone, 409 when
 * the write would have matched more than one row.
 */
export async function updateTableRecord(
  workspaceId: string,
  projectId: string,
  datasourceId: string,
  tableId: string,
  rowKey: string,
  input: UpdateRecordInput,
): Promise<UpdatedRecordDto> {
  return unwrapApiResult(
    await fetchClient.PATCH(
      '/workspaces/{workspaceId}/projects/{projectId}/datasources/{datasourceId}/tables/{tableId}/rows/{rowKey}',
      {
        params: {
          path: { workspaceId, projectId, datasourceId, tableId, rowKey },
        },
        body: input,
      },
    ),
  );
}
