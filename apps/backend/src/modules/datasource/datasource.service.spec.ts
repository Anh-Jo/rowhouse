import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DatasourceService } from './datasource.service';
import type { PrismaService } from '@/prisma/prisma.service';
import type { CredentialVault } from './vault/credential-vault.service';
import type { ConnectionProbe } from './connection-probe.service';
import type { CreateDatasourceDto } from './datasource.dto';

const CREATE_INPUT: CreateDatasourceDto = {
  name: 'Main DB',
  host: 'db.example.com',
  port: 5432,
  database: 'app',
  sslMode: 'REQUIRE',
  readOnly: { username: 'rowhouse_ro', password: 'ro-pw' },
  readWrite: { username: 'rowhouse_rw', password: 'rw-pw' },
};

function sealedFor(tag: string) {
  return {
    secretSealed: Buffer.from(`sealed:${tag}`),
    dekWrapped: Buffer.from(`dek:${tag}`),
    dekKeyId: 'env:12345678',
  };
}

function buildService(overrides?: {
  projectFound?: boolean;
  createError?: unknown;
  credentials?: unknown[];
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
  const datasourceFindFirst = jest.fn().mockResolvedValue({
    id: 'ds-1',
    projectId: 'proj-1',
    host: 'db.example.com',
    port: 5432,
    database: 'app',
    sslMode: 'REQUIRE',
    credentials: overrides?.credentials ?? [
      { role: 'READ_ONLY', username: 'ro', ...sealedFor('ro') },
      { role: 'READ_WRITE', username: 'rw', ...sealedFor('rw') },
    ],
  });
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

  return {
    service: new DatasourceService(prisma, vault, probe),
    datasourceCreate,
    sealSecret,
    openSecret,
    probeFn,
  };
}

describe('DatasourceService', () => {
  describe('create', () => {
    it('seals both role secrets and persists them as bytes', async () => {
      const { service, datasourceCreate, sealSecret } = buildService();

      await service.create('ws-1', 'proj-1', CREATE_INPUT);

      expect(sealSecret).toHaveBeenCalledWith('ro-pw');
      expect(sealSecret).toHaveBeenCalledWith('rw-pw');
      const data = (
        datasourceCreate.mock.calls[0] as [
          { data: { credentials: { create: Array<Record<string, unknown>> } } },
        ]
      )[0].data;
      const roles = data.credentials.create.map((c) => c.role);
      expect(roles).toEqual(['READ_ONLY', 'READ_WRITE']);
      for (const credential of data.credentials.create) {
        expect(credential.secretSealed).toBeInstanceOf(Uint8Array);
        expect(credential.dekWrapped).toBeInstanceOf(Uint8Array);
        expect(String(credential.secretSealed)).not.toContain('ro-pw');
        expect(String(credential.secretSealed)).not.toContain('rw-pw');
      }
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

  describe('testConnection', () => {
    it('passes when both roles connect and read-only holds no write grants', async () => {
      const { service, openSecret, probeFn } = buildService();

      const result = await service.testConnection('ws-1', 'proj-1', 'ds-1');

      expect(result).toEqual({ ok: true, problems: [] });
      // Secrets were unsealed just-in-time, one per role, and handed to the
      // probe — never to the response.
      expect(openSecret).toHaveBeenCalledTimes(2);
      expect(probeFn).toHaveBeenCalledWith(
        expect.objectContaining({ user: 'ro', password: 'open:sealed:ro' }),
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

      const result = await service.testConnection('ws-1', 'proj-1', 'ds-1');

      expect(result.ok).toBe(false);
      expect(result.problems).toEqual([
        expect.stringContaining('READ_ONLY: this role can write'),
      ]);
    });

    it('aggregates connection failures per role', async () => {
      const { service } = buildService({
        probeResults: [
          { connected: false, canWrite: false, error: 'ECONNREFUSED' },
          { connected: false, canWrite: false, error: 'bad password' },
        ],
      });

      const result = await service.testConnection('ws-1', 'proj-1', 'ds-1');

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
        service.testConnection('ws-1', 'proj-1', 'ds-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
