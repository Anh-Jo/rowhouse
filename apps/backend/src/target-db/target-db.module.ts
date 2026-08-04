import { Module } from '@nestjs/common';
import { PostgresExternalDatasource } from './postgres.external-datasource';
import { QueryEngine } from './query-engine.service';
import { RowReader } from './row-reader.service';
import { TargetConnectionFactory } from './target-connection.factory';
import { CredentialVault } from './vault/credential-vault.service';
import { EnvKeyProvider, KEY_PROVIDER } from './vault/env-key-provider';

/**
 * Everything that touches customer databases: the credential vault, the raw
 * connection factory, the engine implementations and the governed QueryEngine
 * on top. Feature modules import this — they never open a connection or
 * unseal a secret themselves.
 */
@Module({
  providers: [
    TargetConnectionFactory,
    CredentialVault,
    PostgresExternalDatasource,
    QueryEngine,
    RowReader,
    // Envelope encryption behind a DI token (decision D10): production swaps
    // this binding for a KMS-backed provider, nothing else changes.
    { provide: KEY_PROVIDER, useClass: EnvKeyProvider },
  ],
  exports: [TargetConnectionFactory, CredentialVault, QueryEngine, RowReader],
})
export class TargetDbModule {}
