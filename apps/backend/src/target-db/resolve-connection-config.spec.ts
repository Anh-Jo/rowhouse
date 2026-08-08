import { InternalServerErrorException } from '@nestjs/common';
import {
  resolveConnectionConfig,
  type DatasourceWithMethodRows,
} from './resolve-connection-config';
import type { CredentialVault } from './vault/credential-vault.service';

const CREDENTIAL = {
  username: 'rowhouse_ro',
  secretSealed: Buffer.from('sealed:role'),
  dekWrapped: Buffer.from('dek:role'),
  dekKeyId: 'env:12345678',
};

const DIRECT_ROW = {
  id: 'dc-1',
  datasourceId: 'ds-1',
  host: 'db.example.com',
  port: 5432,
  database: 'app',
  sslMode: 'REQUIRE' as const,
  caCert: null,
};

const CLOUDSQL_ROW = {
  id: 'cs-1',
  datasourceId: 'ds-1',
  instanceConnectionName: 'my-project:europe-west1:prod',
  database: 'app',
  authType: 'IAM' as const,
  saKeySealed: Buffer.from('sealed:sa-key'),
  saKeyDekWrapped: Buffer.from('dek:sa-key'),
  saKeyDekKeyId: 'env:12345678',
};

function datasource(
  overrides: Partial<DatasourceWithMethodRows>,
): DatasourceWithMethodRows {
  return {
    id: 'ds-1',
    connectionMethod: 'DIRECT',
    direct: null,
    cloudSql: null,
    ...overrides,
  };
}

function fakeVault() {
  const openSecret = jest
    .fn()
    .mockImplementation((sealed: { secretSealed: Buffer }) =>
      Promise.resolve(`open:${sealed.secretSealed.toString()}`),
    );
  return { vault: { openSecret } as unknown as CredentialVault, openSecret };
}

describe('resolveConnectionConfig', () => {
  it('resolves DIRECT with the unsealed role password and plain REQUIRE', async () => {
    const { vault } = fakeVault();

    const config = await resolveConnectionConfig(
      datasource({ direct: DIRECT_ROW }),
      CREDENTIAL,
      vault,
    );

    expect(config).toEqual({
      method: 'DIRECT',
      host: 'db.example.com',
      port: 5432,
      database: 'app',
      ssl: 'REQUIRE',
      user: 'rowhouse_ro',
      password: 'open:sealed:role',
    });
  });

  it('upgrades REQUIRE to VERIFY_CA when a CA certificate is stored', async () => {
    const { vault } = fakeVault();

    const config = await resolveConnectionConfig(
      datasource({ direct: { ...DIRECT_ROW, caCert: 'PEM' } }),
      CREDENTIAL,
      vault,
    );

    expect(config).toEqual(
      expect.objectContaining({ ssl: 'VERIFY_CA', caCert: 'PEM' }),
    );
  });

  it('keeps an explicit DISABLE disabled even with a stored CA', async () => {
    const { vault } = fakeVault();

    const config = await resolveConnectionConfig(
      datasource({
        direct: { ...DIRECT_ROW, sslMode: 'DISABLE', caCert: 'PEM' },
      }),
      CREDENTIAL,
      vault,
    );

    expect(config).toEqual(expect.objectContaining({ ssl: 'DISABLE' }));
  });

  it('resolves CLOUDSQL/IAM with the unsealed SA key and NO password (zero stored secret)', async () => {
    const { vault, openSecret } = fakeVault();

    const config = await resolveConnectionConfig(
      datasource({ connectionMethod: 'CLOUDSQL', cloudSql: CLOUDSQL_ROW }),
      CREDENTIAL,
      vault,
    );

    expect(config).toEqual({
      method: 'CLOUDSQL',
      instanceConnectionName: 'my-project:europe-west1:prod',
      database: 'app',
      authType: 'IAM',
      saKeyJson: 'open:sealed:sa-key',
      user: 'rowhouse_ro',
    });
    expect('password' in config).toBe(false);
    // Just-in-time and only what the method needs: the SA key was unsealed,
    // the role secret was NOT (IAM roles have none).
    expect(openSecret).toHaveBeenCalledTimes(1);
  });

  it('resolves CLOUDSQL/BUILT_IN with both the SA key and the role password', async () => {
    const { vault, openSecret } = fakeVault();

    const config = await resolveConnectionConfig(
      datasource({
        connectionMethod: 'CLOUDSQL',
        cloudSql: { ...CLOUDSQL_ROW, authType: 'BUILT_IN' },
      }),
      CREDENTIAL,
      vault,
    );

    expect(config).toEqual(
      expect.objectContaining({
        authType: 'BUILT_IN',
        saKeyJson: 'open:sealed:sa-key',
        password: 'open:sealed:role',
      }),
    );
    expect(openSecret).toHaveBeenCalledTimes(2);
  });

  it('500-guards a DIRECT discriminator without its method row (D12 invariant)', async () => {
    const { vault, openSecret } = fakeVault();

    await expect(
      resolveConnectionConfig(
        datasource({ connectionMethod: 'DIRECT', cloudSql: CLOUDSQL_ROW }),
        CREDENTIAL,
        vault,
      ),
    ).rejects.toThrow(InternalServerErrorException);
    // Nothing gets unsealed on the failure path.
    expect(openSecret).not.toHaveBeenCalled();
  });

  it('500-guards a CLOUDSQL discriminator without its method row (D12 invariant)', async () => {
    const { vault } = fakeVault();

    await expect(
      resolveConnectionConfig(
        datasource({ connectionMethod: 'CLOUDSQL', direct: DIRECT_ROW }),
        CREDENTIAL,
        vault,
      ),
    ).rejects.toThrow(/marked CLOUDSQL but has no matching method row/);
  });
});
