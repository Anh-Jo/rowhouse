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

export const auditKeys = {
  list: (workspaceId: string) => ['audit-events', workspaceId] as const,
};
