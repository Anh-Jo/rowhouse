import { NotFoundException } from '@nestjs/common';
import { QueryEngine } from './query-engine.service';
import type { PrismaService } from '@/prisma/prisma.service';
import type { AuditService } from '@/audit/audit.service';
import type { CredentialVault } from './vault/credential-vault.service';
import type { PostgresExternalDatasource } from './postgres.external-datasource';
import type { TargetConnectionFactory } from './target-connection.factory';

const CONTEXT = {
  workspaceId: 'ws-1',
  actorId: 'user-1',
  datasourceId: 'ds-1',
};

function buildEngine(overrides?: {
  datasourceFound?: boolean;
  connectError?: Error;
  readError?: Error;
}) {
  const findFirst = jest.fn().mockResolvedValue(
    (overrides?.datasourceFound ?? true)
      ? {
          id: 'ds-1',
          host: 'db.internal',
          port: 5432,
          database: 'app',
          sslMode: 'REQUIRE',
          credentials: [
            {
              role: 'READ_ONLY',
              username: 'rowhouse_ro',
              secretSealed: Buffer.from('sealed'),
              dekWrapped: Buffer.from('dek'),
              dekKeyId: 'env:12345678',
            },
          ],
        }
      : null,
  );
  const prisma = {
    client: { datasource: { findFirst } },
  } as unknown as PrismaService;

  const vault = {
    openSecret: jest.fn().mockResolvedValue('plaintext-pw'),
  } as unknown as CredentialVault;

  const end = jest.fn().mockResolvedValue(undefined);
  const connection = { query: jest.fn(), end };
  const connect = overrides?.connectError
    ? jest.fn().mockRejectedValue(overrides.connectError)
    : jest.fn().mockResolvedValue(connection);
  const connections = { connect } as unknown as TargetConnectionFactory;

  const executeRead = overrides?.readError
    ? jest.fn().mockRejectedValue(overrides.readError)
    : jest.fn().mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });
  const postgres = {
    executeRead,
    introspect: jest
      .fn()
      .mockResolvedValue({ tables: [{ schema: 'public', name: 't' }] }),
  } as unknown as PostgresExternalDatasource;

  const record = jest.fn().mockResolvedValue({});
  const audit = { record } as unknown as AuditService;

  return {
    engine: new QueryEngine(prisma, vault, connections, postgres, audit),
    findFirst,
    connect,
    end,
    record,
    executeRead,
  };
}

describe('QueryEngine', () => {
  it('resolves the datasource through the workspace and reads on the READ_ONLY role', async () => {
    const { engine, findFirst, connect, record } = buildEngine();

    const result = await engine.executeRead(CONTEXT, 'SELECT 1', []);

    expect(result.rowCount).toBe(1);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'ds-1',
          project: { workspaceId: 'ws-1' },
        },
        include: { credentials: { where: { role: 'READ_ONLY' } } },
      }),
    );
    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({
        user: 'rowhouse_ro',
        password: 'plaintext-pw',
      }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'READ',
        role: 'READ_ONLY',
        status: 'OK',
        rowCount: 1,
        statement: 'SELECT 1',
      }),
    );
  });

  it('404s a datasource from another workspace before touching any secret', async () => {
    const { engine, connect, record } = buildEngine({ datasourceFound: false });

    await expect(engine.executeRead(CONTEXT, 'SELECT 1')).rejects.toThrow(
      NotFoundException,
    );
    expect(connect).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('journals an ERROR event when the connection cannot be opened, and rethrows', async () => {
    const { engine, record } = buildEngine({
      connectError: new Error('ECONNREFUSED'),
    });

    await expect(engine.executeRead(CONTEXT, 'SELECT 1')).rejects.toThrow(
      'ECONNREFUSED',
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ERROR',
        errorMessage: 'ECONNREFUSED',
        action: 'READ',
      }),
    );
  });

  it('journals an ERROR and closes the connection when the read itself fails', async () => {
    const { engine, record, end } = buildEngine({
      readError: new Error('syntax error'),
    });

    await expect(engine.executeRead(CONTEXT, 'SELEC 1')).rejects.toThrow(
      'syntax error',
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ERROR',
        errorMessage: 'syntax error',
      }),
    );
    expect(end).toHaveBeenCalled();
  });

  it('audits an introspection as INTROSPECT with no statement', async () => {
    const { engine, record, end } = buildEngine();

    const schema = await engine.introspect(CONTEXT);

    expect(schema.tables).toHaveLength(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'INTROSPECT',
        statement: undefined,
        status: 'OK',
      }),
    );
    expect(end).toHaveBeenCalled();
  });
});
