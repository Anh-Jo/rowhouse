import { fetchClient } from '@/api/client';
import { unwrapApiResult } from '@/api/errors';
import type { components } from '@/api/generated/schema.d.ts';

export type AuditEventPageDto = components['schemas']['AuditEventPageDto_Output'];
export type AuditEventDto = AuditEventPageDto['items'][number];

// The contract declares every path param (`@ApiParam` on the controllers covers
// the guard-resolved `:workspaceId`), so openapi-fetch substitutes them all —
// no manual path substitution needed.

export async function listAuditEvents(
  workspaceId: string,
  options: { cursor?: string; limit?: number } = {},
): Promise<AuditEventPageDto> {
  return unwrapApiResult(
    await fetchClient.GET('/workspaces/{workspaceId}/audit-events', {
      params: { path: { workspaceId }, query: options },
    }),
  );
}
