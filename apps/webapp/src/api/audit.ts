import { fetchClient } from '@/api/client';
import { unwrapApiResult } from '@/api/errors';
import type { components } from '@/api/generated/schema.d.ts';

export type AuditEventPageDto = components['schemas']['AuditEventPageDto_Output'];
export type AuditEventDto = AuditEventPageDto['items'][number];

/**
 * `:workspaceId` is resolved by a backend guard, so the generated contract
 * declares no `path` parameter for it (same substitution pattern as
 * `@/api/projects` — see the comment there).
 */
type AuditEventsPath = '/workspaces/{workspaceId}/audit-events';

export async function listAuditEvents(
  workspaceId: string,
  options: { cursor?: string; limit?: number } = {},
): Promise<AuditEventPageDto> {
  return unwrapApiResult(
    await fetchClient.GET(
      `/workspaces/${encodeURIComponent(workspaceId)}/audit-events` as AuditEventsPath,
      { params: { query: options } },
    ),
  );
}
