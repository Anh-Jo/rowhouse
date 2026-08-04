import { fetchClient } from '@/api/client';
import { unwrapApiResult } from '@/api/errors';
import type { components } from '@/api/generated/schema.d.ts';

export type RowPageDto = components['schemas']['RowPageDto_Output'];

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
