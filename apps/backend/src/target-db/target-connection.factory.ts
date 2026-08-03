import { Injectable } from '@nestjs/common';
import { Client } from 'pg';

/** Connection parameters for one role of a target database. */
export type TargetConnectionParams = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
};

/** Minimal handle the app uses on a target database connection. */
export type TargetConnection = {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  end(): Promise<void>;
};

/** Fail fast on unreachable hosts instead of hanging a request. */
const CONNECT_TIMEOUT_MS = 5_000;

/**
 * Opens raw connections to customer databases (decision D8: target databases
 * are reached through this layer only, never through Prisma). Injectable so
 * tests substitute a fake — pglite has no TCP listener, and unit suites must
 * not require a live Postgres.
 */
@Injectable()
export class TargetConnectionFactory {
  async connect(params: TargetConnectionParams): Promise<TargetConnection> {
    const client = new Client({
      host: params.host,
      port: params.port,
      database: params.database,
      user: params.user,
      password: params.password,
      // REQUIRE mirrors libpq's sslmode=require: encrypted channel, no CA
      // verification (self-signed certs are the norm on managed Postgres).
      // verify-full with a user-supplied CA is a later hardening step.
      ssl: params.ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    });
    await client.connect();
    return {
      query: (sql, values) => client.query(sql, values as never[]),
      end: () => client.end(),
    };
  }
}
