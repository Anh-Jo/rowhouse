import { Injectable } from '@nestjs/common';
import {
  TargetConnectionFactory,
  type TargetConnectionParams,
} from '@/target-db/target-connection.factory';

/** Outcome of probing one role of a datasource. */
export type ProbeResult = {
  connected: boolean;
  /** Only meaningful on the read-only probe: true = the role holds write grants. */
  canWrite: boolean;
  error?: string;
};

/**
 * Catalog query answering "does the current role hold any write capability?"
 * without mutating anything: CREATE on any schema, or INSERT/UPDATE/DELETE on
 * any user table. Pure reads on `information_schema`/`pg_catalog` — safer and
 * more precise than attempting a write and rolling it back (temp tables would
 * false-negative, and a probe write on a production database is exactly what
 * this product promises never to do uninvited).
 */
const WRITE_CAPABILITY_SQL = `
  SELECT
    COALESCE(
      bool_or(has_schema_privilege(current_user, nspname, 'CREATE')),
      false
    ) AS can_create,
    COALESCE(
      (
        SELECT bool_or(
          has_table_privilege(
            current_user,
            format('%I.%I', table_schema, table_name),
            'INSERT, UPDATE, DELETE'
          )
        )
        FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          AND table_type = 'BASE TABLE'
      ),
      false
    ) AS can_mutate
  FROM pg_namespace
  WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
`;

/**
 * Validates a datasource's two roles at connect time (decision D2/D11): both
 * must open a session, and the read-only role must actually be read-only —
 * a misconfigured "read-only" role with write grants is rejected with an
 * explicit, fixable error before it ever reaches the execution path.
 */
@Injectable()
export class ConnectionProbe {
  constructor(private readonly connections: TargetConnectionFactory) {}

  async probe(
    params: TargetConnectionParams,
    options: { checkWriteCapability: boolean },
  ): Promise<ProbeResult> {
    let connection;
    try {
      connection = await this.connections.connect(params);
    } catch (error) {
      return {
        connected: false,
        canWrite: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    try {
      if (!options.checkWriteCapability) {
        await connection.query('SELECT 1');
        return { connected: true, canWrite: false };
      }
      const result = await connection.query(WRITE_CAPABILITY_SQL);
      const row = result.rows[0] as
        | { can_create?: boolean; can_mutate?: boolean }
        | undefined;
      return {
        connected: true,
        canWrite: Boolean(row?.can_create) || Boolean(row?.can_mutate),
      };
    } catch (error) {
      return {
        connected: true,
        canWrite: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      await connection.end().catch(() => undefined);
    }
  }
}
