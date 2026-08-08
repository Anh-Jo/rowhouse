import type { DatasourceDto } from '@/api/datasources';

/**
 * Human label for the connection-method badge (datasource list + detail
 * headers). The IAM path is called out explicitly — zero stored password is
 * the property worth surfacing.
 */
function formatDatasourceMethod(
  datasource: Pick<DatasourceDto, 'method' | 'cloudSql'>,
): string {
  if (datasource.method === 'CLOUDSQL') {
    return datasource.cloudSql?.authType === 'IAM'
      ? 'Cloud SQL · IAM'
      : 'Cloud SQL';
  }
  return 'Direct';
}

export { formatDatasourceMethod };
