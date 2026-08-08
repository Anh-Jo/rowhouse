import {
  AuthTypes,
  Connector,
  GoogleAuth,
} from '@google-cloud/cloud-sql-connector';
import { Client } from 'pg';
import { CONNECT_TIMEOUT_MS } from './direct.strategy';
import type {
  CloudSqlMethodConfig,
  TargetConnection,
  TargetConnectionIdentity,
} from '../target-connection.factory';

/**
 * Shape of the service-account key the customer pasted. Structural subset of
 * google-auth-library's `JWTInput` — typed locally because the library is a
 * transitive dependency (re-exported by the connector).
 */
type ServiceAccountKey = {
  client_email?: string;
  private_key?: string;
  project_id?: string;
};

/**
 * CLOUDSQL method (decision D12): Google's official connector — mTLS managed
 * by Google, no IP allowlisting, no host/port. Under IAM auth the connector
 * also mints the database token, so no password is sent at all; under
 * BUILT_IN the connector only carries the transport and the role password
 * authenticates as usual.
 */
export async function connectCloudSql(
  params: CloudSqlMethodConfig & TargetConnectionIdentity,
): Promise<TargetConnection> {
  // One connector per connection: it caches the instance's client certificate
  // internally, and tying its lifecycle to the connection keeps `end()` the
  // single teardown point (the factory contract every caller relies on).
  const connector = new Connector({
    auth: new GoogleAuth({
      credentials: JSON.parse(params.saKeyJson) as ServiceAccountKey,
    }),
  });
  try {
    const driverOptions = await connector.getOptions({
      instanceConnectionName: params.instanceConnectionName,
      authType: params.authType === 'IAM' ? AuthTypes.IAM : AuthTypes.PASSWORD,
    });
    const client = new Client({
      ...driverOptions,
      database: params.database,
      user: params.user,
      // IAM auth: the token IS the password, injected by the connector —
      // passing one ourselves would fight it.
      ...(params.authType === 'BUILT_IN' ? { password: params.password } : {}),
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    });
    await client.connect();
    return {
      query: (sql, values) => client.query(sql, values as never[]),
      end: async () => {
        await client.end();
        connector.close();
      },
    };
  } catch (error) {
    connector.close();
    throw error;
  }
}
