import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DatasourceService } from './datasource.service';
import type { PrismaService } from '@/prisma/prisma.service';
import type { AuditService } from '@/audit/audit.service';
import type { CredentialVault } from '@/target-db/vault/credential-vault.service';
import type { ConnectionProbe } from './connection-probe.service';
import type {
  CreateDatasourceDto,
  UpdateDatasourceDto,
} from './datasource.dto';

const CREATE_INPUT: CreateDatasourceDto = {
  method: 'DIRECT',
  name: 'Main DB',
  host: 'db.example.com',
  port: 5432,
  database: 'app',
  sslMode: 'REQUIRE',
  readOnly: { username: 'rowhouse_ro', password: 'ro-pw' },
  readWrite: { username: 'rowhouse_rw', password: 'rw-pw' },
};

const CLOUDSQL_CREATE_INPUT: CreateDatasourceDto = {
  method: 'CLOUDSQL',
  name: 'Cloud DB',
  instanceConnectionName: 'my-project:europe-west1:prod',
  database: 'app',
  authType: 'IAM',
  saKeyJson: '{"client_email":"rowhouse-ro@my-project.iam"}',
  readOnly: { username: 'rowhouse-ro@my-project.iam' },
  readWrite: { username: 'rowhouse-rw@my-project.iam' },
};

function sealedFor(tag: string) {
  return {
    secretSealed: Buffer.from(`sealed:${tag}`),
    dekWrapped: Buffer.from(`dek:${tag}`),
    dekKeyId: 'env:12345678',
  };
}

const DIRECT_ROW = {
  id: 'dc-1',
  datasourceId: 'ds-1',
  host: 'db.example.com',
  port: 5432,
  database: 'app',
  sslMode: 'REQUIRE',
  caCert: null,
};

function buildService(overrides?: {
  projectFound?: boolean;
  createError?: unknown;
  credentials?: unknown[];
  datasourceRow?: Record<string, unknown>;
  probeResults?: Array<{
    connected: boolean;
    canWrite: boolean;
    error?: string;
  }>;
}) {
  const projectFindFirst = jest
    .fn()
    .mockResolvedValue(
      (overrides?.projectFound ?? true) ? { id: 'proj-1' } : null,
    );
  const datasourceCreate = overrides?.createError
    ? jest.fn().mockRejectedValue(overrides.createError)
    : jest
        .fn()
        .mockImplementation((args: { data: unknown }) =>
          Promise.resolve({ id: 'ds-1', ...(args.data as object) }),
        );
  const datasourceFindFirst = jest.fn().mockResolvedValue(
    overrides?.datasourceRow ?? {
      id: 'ds-1',
      projectId: 'proj-1',
      connectionMethod: 'DIRECT',
      direct: DIRECT_ROW,
      cloudSql: null,
      credentials: overrides?.credentials ?? [
        { role: 'READ_ONLY', username: 'ro', ...sealedFor('ro') },
        { role: 'READ_WRITE', username: 'rw', ...sealedFor('rw') },
      ],
    },
  );
  const prisma = {
    client: {
      project: { findFirst: projectFindFirst },
      datasource: {
        create: datasourceCreate,
        findFirst: datasourceFindFirst,
        findMany: jest.fn().mockResolvedValue([]),
      },
    },
  } as unknown as PrismaService;

  const sealSecret = jest
    .fn()
    .mockImplementation((plaintext: string) =>
      Promise.resolve(sealedFor(plaintext)),
    );
  const openSecret = jest
    .fn()
    .mockImplementation((sealed: { secretSealed: Buffer }) =>
      Promise.resolve(`open:${sealed.secretSealed.toString()}`),
    );
  const vault = { sealSecret, openSecret } as unknown as CredentialVault;

  const probeResults = overrides?.probeResults ?? [
    { connected: true, canWrite: false },
    { connected: true, canWrite: false },
  ];
  const probeFn = jest.fn();
  for (const result of probeResults) {
    probeFn.mockResolvedValueOnce(result);
  }
  const probe = { probe: probeFn } as unknown as ConnectionProbe;
  const auditRecord = jest.fn().mockResolvedValue({});
  const audit = { record: auditRecord } as unknown as AuditService;

  return {
    service: new DatasourceService(prisma, vault, probe, audit),
    datasourceCreate,
    sealSecret,
    openSecret,
    probeFn,
    auditRecord,
  };
}

type CreateCallData = {
  connectionMethod?: string;
  direct?: { create: Record<string, unknown> };
  cloudSql?: { create: Record<string, unknown> };
  credentials: { create: Array<Record<string, unknown>> };
};

function createCallData(createMock: jest.Mock): CreateCallData {
  return (createMock.mock.calls[0] as [{ data: CreateCallData }])[0].data;
}

describe('DatasourceService', () => {
  describe('create', () => {
    it('seals both role secrets and persists them as bytes', async () => {
      const { service, datasourceCreate, sealSecret } = buildService();

      await service.create('ws-1', 'proj-1', CREATE_INPUT);

      expect(sealSecret).toHaveBeenCalledWith('ro-pw');
      expect(sealSecret).toHaveBeenCalledWith('rw-pw');
      const data = createCallData(datasourceCreate);
      const roles = data.credentials.create.map((c) => c.role);
      expect(roles).toEqual(['READ_ONLY', 'READ_WRITE']);
      for (const credential of data.credentials.create) {
        expect(credential.secretSealed).toBeInstanceOf(Uint8Array);
        expect(credential.dekWrapped).toBeInstanceOf(Uint8Array);
        expect(String(credential.secretSealed)).not.toContain('ro-pw');
        expect(String(credential.secretSealed)).not.toContain('rw-pw');
      }
    });

    it('writes the DIRECT discriminator and its method row in the same create (D12 invariant)', async () => {
      const { service, datasourceCreate } = buildService();

      await service.create('ws-1', 'proj-1', CREATE_INPUT);

      // One nested create — discriminator, method row and credentials land in
      // a single transaction, so the invariant can never be half-applied.
      expect(datasourceCreate).toHaveBeenCalledTimes(1);
      const data = createCallData(datasourceCreate);
      expect(data.connectionMethod).toBe('DIRECT');
      expect(data.direct).toEqual({
        create: {
          host: 'db.example.com',
          port: 5432,
          database: 'app',
          sslMode: 'REQUIRE',
          caCert: null,
        },
      });
      expect(data.cloudSql).toBeUndefined();
    });

    it('stores the CA certificate on the DIRECT method row when provided', async () => {
      const { service, datasourceCreate } = buildService();

      await service.create('ws-1', 'proj-1', {
        ...CREATE_INPUT,
        caCert: '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----',
      });

      const data = createCallData(datasourceCreate);
      expect(data.direct?.create.caCert).toContain('BEGIN CERTIFICATE');
    });

    it('writes the CLOUDSQL discriminator with a sealed SA key, never the plaintext', async () => {
      const { service, datasourceCreate, sealSecret } = buildService();

      await service.create('ws-1', 'proj-1', CLOUDSQL_CREATE_INPUT);

      expect(sealSecret).toHaveBeenCalledWith(CLOUDSQL_CREATE_INPUT.saKeyJson);
      expect(datasourceCreate).toHaveBeenCalledTimes(1);
      const data = createCallData(datasourceCreate);
      expect(data.connectionMethod).toBe('CLOUDSQL');
      expect(data.direct).toBeUndefined();
      const cloudSql = data.cloudSql?.create ?? {};
      expect(cloudSql.instanceConnectionName).toBe(
        'my-project:europe-west1:prod',
      );
      expect(cloudSql.authType).toBe('IAM');
      expect(cloudSql.saKeySealed).toBeInstanceOf(Uint8Array);
      expect(String(cloudSql.saKeySealed)).not.toContain('client_email');
      expect(JSON.stringify(data)).not.toContain(
        CLOUDSQL_CREATE_INPUT.saKeyJson,
      );
    });

    it('seals an empty role secret under IAM auth — the duality stays, the password does not exist', async () => {
      const { service, sealSecret } = buildService();

      await service.create('ws-1', 'proj-1', CLOUDSQL_CREATE_INPUT);

      // Two role secrets + the SA key.
      expect(sealSecret).toHaveBeenCalledTimes(3);
      expect(sealSecret).toHaveBeenCalledWith('');
    });

    it('404s when the project is not in the caller workspace', async () => {
      const { service } = buildService({ projectFound: false });

      await expect(
        service.create('ws-other', 'proj-1', CREATE_INPUT),
      ).rejects.toThrow(NotFoundException);
    });

    it('maps a duplicate name to a 409 conflict', async () => {
      const { service } = buildService({
        createError: Object.assign(new Error('unique'), { code: 'P2002' }),
      });

      await expect(
        service.create('ws-1', 'proj-1', CREATE_INPUT),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    function buildUpdateService(overrides?: {
      datasourceRow?: Record<string, unknown>;
    }) {
      const built = buildService(overrides);
      const credentialUpdate = jest.fn().mockResolvedValue({});
      const directUpdate = jest.fn().mockResolvedValue({});
      const cloudSqlUpdate = jest.fn().mockResolvedValue({});
      const datasourceUpdate = jest.fn().mockResolvedValue({
        id: 'ds-1',
        credentials: [],
      });
      const prisma = (
        built.service as unknown as { prisma: { client: unknown } }
      ).prisma;
      const client = prisma.client as Record<string, unknown>;
      client.$transaction = jest.fn(
        (fn: (tx: unknown) => Promise<unknown>): Promise<unknown> =>
          fn({
            datasourceCredential: { update: credentialUpdate },
            directConnection: { update: directUpdate },
            cloudSqlConnection: { update: cloudSqlUpdate },
            datasource: { update: datasourceUpdate },
          }),
      );
      return {
        ...built,
        credentialUpdate,
        directUpdate,
        cloudSqlUpdate,
        datasourceUpdate,
      };
    }

    it('re-seals only the provided role and applies connection changes to the method row', async () => {
      const {
        service,
        credentialUpdate,
        directUpdate,
        datasourceUpdate,
        sealSecret,
      } = buildUpdateService();

      await service.update('ws-1', 'proj-1', 'ds-1', {
        host: 'new-host',
        readOnly: { username: 'ro2', password: 'new-ro-pw' },
      } as UpdateDatasourceDto);

      expect(sealSecret).toHaveBeenCalledTimes(1);
      expect(sealSecret).toHaveBeenCalledWith('new-ro-pw');
      expect(credentialUpdate).toHaveBeenCalledTimes(1);
      expect(credentialUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            datasourceId_role: { datasourceId: 'ds-1', role: 'READ_ONLY' },
          },
          data: expect.objectContaining({ username: 'ro2' }) as object,
        }),
      );
      // The connection change lands on the DIRECT method row (D12), not on
      // the datasource itself.
      expect(directUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { datasourceId: 'ds-1' },
          data: { host: 'new-host' },
        }),
      );
      expect(datasourceUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: {} }),
      );
    });

    it('rejects a method change with an actionable 400 (P1.5: create a new datasource instead)', async () => {
      const { service } = buildUpdateService();

      await expect(
        service.update('ws-1', 'proj-1', 'ds-1', {
          method: 'CLOUDSQL',
        } as UpdateDatasourceDto),
      ).rejects.toThrow(/create a new datasource/);
    });

    it('rejects DIRECT fields on a CLOUDSQL datasource', async () => {
      const { service } = buildUpdateService({
        datasourceRow: {
          id: 'ds-1',
          projectId: 'proj-1',
          connectionMethod: 'CLOUDSQL',
          direct: null,
          cloudSql: {
            id: 'cs-1',
            datasourceId: 'ds-1',
            instanceConnectionName: 'my-project:europe-west1:prod',
            database: 'app',
            authType: 'BUILT_IN',
            ...(() => {
              const sealed = sealedFor('sa-key');
              return {
                saKeySealed: sealed.secretSealed,
                saKeyDekWrapped: sealed.dekWrapped,
                saKeyDekKeyId: sealed.dekKeyId,
              };
            })(),
          },
          credentials: [
            { role: 'READ_ONLY', username: 'ro', ...sealedFor('ro') },
            { role: 'READ_WRITE', username: 'rw', ...sealedFor('rw') },
          ],
        },
      });

      await expect(
        service.update('ws-1', 'proj-1', 'ds-1', {
          host: 'nope',
        } as UpdateDatasourceDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects cloudSql settings on a DIRECT datasource', async () => {
      const { service } = buildUpdateService();

      await expect(
        service.update('ws-1', 'proj-1', 'ds-1', {
          cloudSql: { database: 'other' },
        } as UpdateDatasourceDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('re-seals a replacement SA key through the CLOUDSQL method row', async () => {
      const iamRow = {
        id: 'ds-1',
        projectId: 'proj-1',
        connectionMethod: 'CLOUDSQL',
        direct: null,
        cloudSql: {
          id: 'cs-1',
          datasourceId: 'ds-1',
          instanceConnectionName: 'my-project:europe-west1:prod',
          database: 'app',
          authType: 'IAM',
          saKeySealed: sealedFor('sa-key').secretSealed,
          saKeyDekWrapped: sealedFor('sa-key').dekWrapped,
          saKeyDekKeyId: 'env:12345678',
        },
        credentials: [
          { role: 'READ_ONLY', username: 'ro', ...sealedFor('ro') },
          { role: 'READ_WRITE', username: 'rw', ...sealedFor('rw') },
        ],
      };
      const { service, cloudSqlUpdate, sealSecret } = buildUpdateService({
        datasourceRow: iamRow,
      });

      await service.update('ws-1', 'proj-1', 'ds-1', {
        cloudSql: { saKeyJson: '{"new":"key"}' },
      } as UpdateDatasourceDto);

      expect(sealSecret).toHaveBeenCalledWith('{"new":"key"}');
      expect(cloudSqlUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { datasourceId: 'ds-1' },
          data: expect.objectContaining({
            saKeyDekKeyId: 'env:12345678',
          }) as object,
        }),
      );
      const written = (
        cloudSqlUpdate.mock.calls[0] as [{ data: { saKeySealed: Uint8Array } }]
      )[0].data;
      // Bytes columns get Uint8Array copies (Prisma 7 typing), never strings.
      expect(written.saKeySealed).toBeInstanceOf(Uint8Array);
    });

    it('enforces the password rules of the stored method on role updates', async () => {
      const iamRow = {
        id: 'ds-1',
        projectId: 'proj-1',
        connectionMethod: 'CLOUDSQL',
        direct: null,
        cloudSql: {
          id: 'cs-1',
          datasourceId: 'ds-1',
          instanceConnectionName: 'my-project:europe-west1:prod',
          database: 'app',
          authType: 'IAM',
          saKeySealed: sealedFor('sa-key').secretSealed,
          saKeyDekWrapped: sealedFor('sa-key').dekWrapped,
          saKeyDekKeyId: 'env:12345678',
        },
        credentials: [
          { role: 'READ_ONLY', username: 'ro', ...sealedFor('ro') },
          { role: 'READ_WRITE', username: 'rw', ...sealedFor('rw') },
        ],
      };

      // IAM: a password is the mistake.
      const iam = buildUpdateService({ datasourceRow: iamRow });
      await expect(
        iam.service.update('ws-1', 'proj-1', 'ds-1', {
          readOnly: { username: 'ro2', password: 'nope' },
        } as UpdateDatasourceDto),
      ).rejects.toThrow(/ephemeral tokens/);

      // DIRECT: the password is required to re-seal.
      const direct = buildUpdateService();
      await expect(
        direct.service.update('ws-1', 'proj-1', 'ds-1', {
          readOnly: { username: 'ro2' },
        } as UpdateDatasourceDto),
      ).rejects.toThrow(/password is required/);
    });

    it('404s a datasource from another workspace before touching anything', async () => {
      const { service } = buildService({ projectFound: false });

      await expect(
        service.update('ws-other', 'proj-1', 'ds-1', {
          host: 'x',
        } as UpdateDatasourceDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('testConnection', () => {
    it('passes when both roles connect and read-only holds no write grants', async () => {
      const { service, openSecret, probeFn, auditRecord } = buildService();

      const result = await service.testConnection(
        'ws-1',
        'proj-1',
        'ds-1',
        'user-1',
      );

      expect(result).toEqual({ ok: true, problems: [] });
      // One journal entry per probed role (decision D3).
      expect(auditRecord).toHaveBeenCalledTimes(2);
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONNECTION_TEST',
          actorId: 'user-1',
          role: 'READ_ONLY',
          status: 'OK',
        }),
      );
      // Secrets were unsealed just-in-time by the resolver, one per role, and
      // handed to the probe as part of the resolved method config.
      expect(openSecret).toHaveBeenCalledTimes(2);
      expect(probeFn).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'DIRECT',
          host: 'db.example.com',
          ssl: 'REQUIRE',
          user: 'ro',
          password: 'open:sealed:ro',
        }),
        { checkWriteCapability: true },
      );
      expect(probeFn).toHaveBeenCalledWith(
        expect.objectContaining({ user: 'rw', password: 'open:sealed:rw' }),
        { checkWriteCapability: false },
      );
    });

    it('rejects a write-capable read-only role with an actionable problem', async () => {
      const { service } = buildService({
        probeResults: [
          { connected: true, canWrite: true },
          { connected: true, canWrite: false },
        ],
      });

      const result = await service.testConnection(
        'ws-1',
        'proj-1',
        'ds-1',
        'user-1',
      );

      expect(result.ok).toBe(false);
      expect(result.problems).toEqual([
        expect.stringContaining('READ_ONLY: this role can write'),
      ]);
    });

    it('journals a failed guardrail as an ERROR audit event', async () => {
      const { service, auditRecord } = buildService({
        probeResults: [
          { connected: true, canWrite: true },
          { connected: true, canWrite: false },
        ],
      });

      await service.testConnection('ws-1', 'proj-1', 'ds-1', 'user-1');

      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'READ_ONLY',
          status: 'ERROR',
          errorMessage: expect.stringContaining(
            'this role can write',
          ) as string,
        }),
      );
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'READ_WRITE', status: 'OK' }),
      );
    });

    it('aggregates connection failures per role', async () => {
      const { service } = buildService({
        probeResults: [
          { connected: false, canWrite: false, error: 'ECONNREFUSED' },
          { connected: false, canWrite: false, error: 'bad password' },
        ],
      });

      const result = await service.testConnection(
        'ws-1',
        'proj-1',
        'ds-1',
        'user-1',
      );

      expect(result.ok).toBe(false);
      expect(result.problems).toEqual([
        'READ_ONLY: connection failed — ECONNREFUSED',
        'READ_WRITE: connection failed — bad password',
      ]);
    });

    it('400s on a row missing one of the two roles', async () => {
      const { service } = buildService({
        credentials: [
          { role: 'READ_ONLY', username: 'ro', ...sealedFor('ro') },
        ],
      });

      await expect(
        service.testConnection('ws-1', 'proj-1', 'ds-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
