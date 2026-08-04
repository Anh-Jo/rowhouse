import { fetchClient } from '@/api/client';
import { unwrapApiResult } from '@/api/errors';
import type { components } from '@/api/generated/schema.d.ts';

export type RowPageDto = components['schemas']['RowPageDto_Output'];
export type RecordDetailDto = components['schemas']['RecordDetailDto_Output'];

/**
 * One page of governed row reading (explorer module). `tableId` is a
 * SchemaTable id — the snapshot, not a client-supplied table name. `cursor`
 * is the opaque keyset cursor from the previous page; `nextCursor` is null
 * on the last page and for tables without a primary key (first page only).
 */
export async function listTableRows(
  workspaceId: string,
  projectId: string,
  datasourceId: string,
  tableId: string,
  options: { cursor?: string; limit?: number } = {},
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
