import { InternalServerErrorException } from '@nestjs/common';
import type {
  CloudSqlConnection,
  DirectConnection,
} from '../generated/prisma/client';
import type { ConnectionMethod } from '../generated/prisma/client';
import type { CredentialVault } from './vault/credential-vault.service';
import type { TargetConnectionParams } from './target-connection.factory';

/** A datasource joined with its method rows (decision D12). */
export type DatasourceWithMethodRows = {
  id: string;
  connectionMethod: ConnectionMethod;
  direct: DirectConnection | null;
  cloudSql: CloudSqlConnection | null;
};

/** One credential row, secrets still sealed. */
export type ResolvableCredential = {
  username: string;
  secretSealed: Uint8Array;
  dekWrapped: Uint8Array;
  dekKeyId: string;
};

/**
 * The D12 invariant ("exactly one method row, matching the discriminator")
 * is service-enforced at write time; a row that still disagrees was
 * manipulated outside the app, so this is a 500-guard, not a user error.
 */
function methodRowMismatch(
  datasourceId: string,
  method: ConnectionMethod,
): InternalServerErrorException {
  return new InternalServerErrorException(
    `Datasource ${datasourceId} is marked ${method} but has no matching method row`,
  );
}

/**
 * Turns a datasource + one credential into the factory's connect input:
 * picks the method row matching the discriminator and unseals what needs
 * unsealing — just-in-time, only what this method actually uses (under
 * Cloud SQL IAM auth the role holds no password, so nothing is unsealed
 * for it). Every governed path (QueryEngine, connection test) resolves
 * through here; none reads method columns on its own.
 */
export async function resolveConnectionConfig(
  datasource: DatasourceWithMethodRows,
  credential: ResolvableCredential,
  vault: CredentialVault,
): Promise<TargetConnectionParams> {
  const openCredential = () =>
    vault.openSecret({
      secretSealed: Buffer.from(credential.secretSealed),
      dekWrapped: Buffer.from(credential.dekWrapped),
      dekKeyId: credential.dekKeyId,
    });

  if (datasource.connectionMethod === 'DIRECT') {
    const direct = datasource.direct;
    if (!direct) {
      throw methodRowMismatch(datasource.id, datasource.connectionMethod);
    }
    return {
      method: 'DIRECT',
      host: direct.host,
      port: direct.port,
      database: direct.database,
      // A stored CA upgrades REQUIRE to real chain verification; an explicit
      // DISABLE stays disabled (the user's visible choice wins).
      ssl:
        direct.sslMode === 'REQUIRE' && direct.caCert !== null
          ? 'VERIFY_CA'
          : direct.sslMode,
      ...(direct.caCert !== null ? { caCert: direct.caCert } : {}),
      user: credential.username,
      password: await openCredential(),
    };
  }

  const cloudSql = datasource.cloudSql;
  if (!cloudSql) {
    throw methodRowMismatch(datasource.id, datasource.connectionMethod);
  }
  return {
    method: 'CLOUDSQL',
    instanceConnectionName: cloudSql.instanceConnectionName,
    database: cloudSql.database,
    authType: cloudSql.authType,
    saKeyJson: await vault.openSecret({
      secretSealed: Buffer.from(cloudSql.saKeySealed),
      dekWrapped: Buffer.from(cloudSql.saKeyDekWrapped),
      dekKeyId: cloudSql.saKeyDekKeyId,
    }),
    user: credential.username,
    // IAM: ephemeral tokens, no stored DB secret at all (decision D12).
    ...(cloudSql.authType === 'BUILT_IN'
      ? { password: await openCredential() }
      : {}),
  };
}
