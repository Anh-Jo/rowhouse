import { Injectable } from '@nestjs/common';
import { connectDirect } from './connection-strategies/direct.strategy';
import { connectCloudSql } from './connection-strategies/cloud-sql.strategy';

/**
 * Resolved reachability config for the DIRECT method. `ssl` is already the
 * *effective* mode: the resolution layer collapses "REQUIRE + a stored CA"
 * into VERIFY_CA, so the strategy never guesses.
 */
export type DirectMethodConfig = {
  method: 'DIRECT';
  host: string;
  port: number;
  database: string;
  ssl: 'DISABLE' | 'REQUIRE' | 'VERIFY_CA';
  /** PEM CA bundle — required for VERIFY_CA, meaningless otherwise. */
  caCert?: string;
};

/** Resolved reachability config for the CLOUDSQL method (decision D12). */
export type CloudSqlMethodConfig = {
  method: 'CLOUDSQL';
  /** `project:region:instance` — the connector's addressing, no host/port. */
  instanceConnectionName: string;
  database: string;
  authType: 'IAM' | 'BUILT_IN';
  /** Service-account key JSON, unsealed just-in-time by the resolver. */
  saKeyJson: string;
};

/**
 * One role's identity on the target database. `password` is absent under
 * Cloud SQL IAM auth: the connector mints ephemeral tokens, no stored DB
 * secret exists at all.
 */
export type TargetConnectionIdentity = {
  user: string;
  password?: string;
};

/** Full input of `connect`: how to reach the database, and as whom. */
export type TargetConnectionParams = (
  | DirectMethodConfig
  | CloudSqlMethodConfig
) &
  TargetConnectionIdentity;

/** Minimal handle the app uses on a target database connection. */
export type TargetConnection = {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  end(): Promise<void>;
};

/**
 * Opens raw connections to customer databases (decision D8: target databases
 * are reached through this layer only, never through Prisma). One strategy
 * per connection method (decision D12) — every method resolves here, none
 * bypasses the probe or the audit. Injectable so tests substitute a fake —
 * pglite has no TCP listener, and unit suites must not require a live
 * Postgres or a real Cloud SQL instance.
 */
@Injectable()
export class TargetConnectionFactory {
  connect(params: TargetConnectionParams): Promise<TargetConnection> {
    return params.method === 'CLOUDSQL'
      ? connectCloudSql(params)
      : connectDirect(params);
  }
}
