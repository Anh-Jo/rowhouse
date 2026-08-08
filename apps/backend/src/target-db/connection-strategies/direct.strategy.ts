import { Client, type ClientConfig } from 'pg';
import type {
  DirectMethodConfig,
  TargetConnection,
  TargetConnectionIdentity,
} from '../target-connection.factory';

/** Fail fast on unreachable hosts instead of hanging a request. */
export const CONNECT_TIMEOUT_MS = 5_000;

function sslConfig(params: DirectMethodConfig): ClientConfig['ssl'] {
  switch (params.ssl) {
    case 'DISABLE':
      return false;
    case 'VERIFY_CA':
      // The customer supplied the CA their server presents, so we verify the
      // chain for real — a spoofed server fails the handshake.
      return { ca: params.caCert, rejectUnauthorized: true };
    case 'REQUIRE':
      // REQUIRE mirrors libpq's sslmode=require: encrypted channel, no CA
      // verification (self-signed certs are the norm on managed Postgres).
      // Uploading a CA in the connect flow upgrades this to VERIFY_CA.
      return { rejectUnauthorized: false };
  }
}

/** DIRECT method: plain TCP with per-sslMode TLS handling (decision D12). */
export async function connectDirect(
  params: DirectMethodConfig & TargetConnectionIdentity,
): Promise<TargetConnection> {
  const client = new Client({
    host: params.host,
    port: params.port,
    database: params.database,
    user: params.user,
    password: params.password,
    ssl: sslConfig(params),
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
  });
  await client.connect();
  return {
    query: (sql, values) => client.query(sql, values as never[]),
    end: () => client.end(),
  };
}
