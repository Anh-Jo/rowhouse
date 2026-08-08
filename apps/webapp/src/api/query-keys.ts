/**
 * TanStack Query keys, one factory per resource. Keys embed every id the
 * fetch depends on, so invalidating a datasource's schema never clears
 * another's cache.
 */
export const projectKeys = {
  list: (workspaceId: string) => ['projects', workspaceId] as const,
};

export const datasourceKeys = {
  list: (workspaceId: string, projectId: string) =>
    ['datasources', workspaceId, projectId] as const,
  detail: (workspaceId: string, projectId: string, datasourceId: string) =>
    ['datasources', workspaceId, projectId, datasourceId] as const,
};

export const schemaKeys = {
  byDatasource: (workspaceId: string, projectId: string, datasourceId: string) =>
    ['schema', workspaceId, projectId, datasourceId] as const,
};

export const explorerKeys = {
  // Refinements are part of the key (in their serialized API form) so every
  // filter/sort/search combination caches separately and changing one starts
  // a fresh first page — the cursor chain of the old view never leaks in.
  rows: (
    workspaceId: string,
    projectId: string,
    datasourceId: string,
    tableId: string,
    refinements: { filters?: string; sort?: string; search?: string } = {},
  ) =>
    [
      'explorer-rows',
      workspaceId,
      projectId,
      datasourceId,
      tableId,
      refinements.filters ?? null,
      refinements.sort ?? null,
      refinements.search ?? null,
    ] as const,
  // tableId AND rowKey in the key: record → record navigation (customer →
  // order → back) must never serve one record's cache for another.
  record: (
    workspaceId: string,
    projectId: string,
    datasourceId: string,
    tableId: string,
    rowKey: string,
  ) =>
    [
      'explorer-record',
      workspaceId,
      projectId,
      datasourceId,
      tableId,
      rowKey,
    ] as const,
};

export const auditKeys = {
  list: (workspaceId: string) => ['audit-events', workspaceId] as const,
};
