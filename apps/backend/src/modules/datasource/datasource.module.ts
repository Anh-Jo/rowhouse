import { Module } from '@nestjs/common';
import { ConnectionProbe } from './connection-probe.service';
import { DatasourceController } from './datasource.controller';
import { DatasourceService } from './datasource.service';
import { TargetConnectionFactory } from './target-connection.factory';
import { CredentialVault } from './vault/credential-vault.service';
import { EnvKeyProvider, KEY_PROVIDER } from './vault/env-key-provider';

@Module({
  controllers: [DatasourceController],
  providers: [
    DatasourceService,
    ConnectionProbe,
    TargetConnectionFactory,
    CredentialVault,
    // Envelope encryption behind a DI token (decision D10): production swaps
    // this binding for a KMS-backed provider, nothing else changes.
    { provide: KEY_PROVIDER, useClass: EnvKeyProvider },
  ],
})
export class DatasourceModule {}
