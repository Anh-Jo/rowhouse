import {
  TargetConnectionFactory,
  type TargetConnectionParams,
} from './target-connection.factory';
import { Client } from 'pg';
import {
  AuthTypes,
  Connector,
  GoogleAuth,
} from '@google-cloud/cloud-sql-connector';

jest.mock('pg', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn().mockResolvedValue(undefined),
  })),
}));

const getOptions = jest
  .fn()
  .mockResolvedValue({ stream: () => undefined as never });
const connectorClose = jest.fn();

jest.mock('@google-cloud/cloud-sql-connector', () => ({
  AuthTypes: { IAM: 'IAM', PASSWORD: 'PASSWORD' },
  Connector: jest.fn().mockImplementation(() => ({
    getOptions,
    close: connectorClose,
  })),
  GoogleAuth: jest.fn(),
}));

const ClientMock = Client as unknown as jest.Mock;
const ConnectorMock = Connector as unknown as jest.Mock;
const GoogleAuthMock = GoogleAuth as unknown as jest.Mock;

function clientConfig(call = 0): Record<string, unknown> {
  return (ClientMock.mock.calls[call] as [Record<string, unknown>])[0];
}

const DIRECT_PARAMS: TargetConnectionParams = {
  method: 'DIRECT',
  host: 'db.example.com',
  port: 5432,
  database: 'app',
  ssl: 'REQUIRE',
  user: 'rowhouse_ro',
  password: 'pw',
};

const CA_PEM = '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----';

const SA_KEY_JSON = JSON.stringify({
  client_email: 'rowhouse-ro@my-project.iam.gserviceaccount.com',
  private_key: 'unsealed-private-key',
});

const CLOUDSQL_PARAMS: TargetConnectionParams = {
  method: 'CLOUDSQL',
  instanceConnectionName: 'my-project:europe-west1:prod',
  database: 'app',
  authType: 'IAM',
  saKeyJson: SA_KEY_JSON,
  user: 'rowhouse-ro@my-project.iam',
};

describe('TargetConnectionFactory', () => {
  const factory = new TargetConnectionFactory();

  beforeEach(() => {
    jest.clearAllMocks();
    getOptions.mockResolvedValue({ stream: () => undefined as never });
  });

  describe('DIRECT strategy — TLS matrix', () => {
    it('DISABLE turns TLS off entirely', async () => {
      await factory.connect({ ...DIRECT_PARAMS, ssl: 'DISABLE' });
      expect(clientConfig().ssl).toBe(false);
    });

    it('REQUIRE encrypts without CA verification (managed-Postgres reality)', async () => {
      await factory.connect(DIRECT_PARAMS);
      expect(clientConfig().ssl).toEqual({ rejectUnauthorized: false });
    });

    it('VERIFY_CA pins the provided CA and verifies the chain for real', async () => {
      await factory.connect({
        ...DIRECT_PARAMS,
        ssl: 'VERIFY_CA',
        caCert: CA_PEM,
      });
      expect(clientConfig().ssl).toEqual({
        ca: CA_PEM,
        rejectUnauthorized: true,
      });
    });

    it('passes identity and target through, with a connect timeout', async () => {
      await factory.connect(DIRECT_PARAMS);
      expect(clientConfig()).toEqual(
        expect.objectContaining({
          host: 'db.example.com',
          port: 5432,
          database: 'app',
          user: 'rowhouse_ro',
          password: 'pw',
          connectionTimeoutMillis: 5_000,
        }),
      );
      expect(ConnectorMock).not.toHaveBeenCalled();
    });
  });

  describe('CLOUDSQL strategy', () => {
    it('feeds the unsealed SA key to GoogleAuth and addresses by instance connection name', async () => {
      await factory.connect(CLOUDSQL_PARAMS);

      // The auth client received the parsed plaintext of the sealed key.
      expect(GoogleAuthMock).toHaveBeenCalledWith({
        credentials: {
          client_email: 'rowhouse-ro@my-project.iam.gserviceaccount.com',
          private_key: 'unsealed-private-key',
        },
      });
      expect(getOptions).toHaveBeenCalledWith({
        instanceConnectionName: 'my-project:europe-west1:prod',
        authType: AuthTypes.IAM,
      });
    });

    it('IAM auth: the connector options reach pg and no password is set at all', async () => {
      const stream = () => undefined as never;
      getOptions.mockResolvedValue({ stream });

      await factory.connect(CLOUDSQL_PARAMS);

      const config = clientConfig();
      expect(config.stream).toBe(stream);
      expect(config.database).toBe('app');
      expect(config.user).toBe('rowhouse-ro@my-project.iam');
      expect('password' in config).toBe(false);
    });

    it('BUILT_IN auth: PASSWORD auth type and the role password on the client', async () => {
      await factory.connect({
        ...CLOUDSQL_PARAMS,
        authType: 'BUILT_IN',
        user: 'rowhouse_ro',
        password: 'built-in-pw',
      });

      expect(getOptions).toHaveBeenCalledWith(
        expect.objectContaining({ authType: AuthTypes.PASSWORD }),
      );
      expect(clientConfig().password).toBe('built-in-pw');
    });

    it('end() tears down the pg client and the connector together', async () => {
      const connection = await factory.connect(CLOUDSQL_PARAMS);
      const client = ClientMock.mock.results[0]?.value as { end: jest.Mock };

      await connection.end();

      expect(client.end).toHaveBeenCalled();
      expect(connectorClose).toHaveBeenCalled();
    });

    it('closes the connector when the connection cannot be opened', async () => {
      getOptions.mockRejectedValue(new Error('instance not found'));

      await expect(factory.connect(CLOUDSQL_PARAMS)).rejects.toThrow(
        'instance not found',
      );
      expect(connectorClose).toHaveBeenCalled();
    });
  });
});
