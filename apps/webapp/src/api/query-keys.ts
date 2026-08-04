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
  rows: (
    workspaceId: string,
    projectId: string,
    datasourceId: string,
    tableId: string,
  ) => ['explorer-rows', workspaceId, projectId, datasourceId, tableId] as const,
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
