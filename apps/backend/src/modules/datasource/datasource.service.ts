import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/audit/audit.service';
import {
  clampLimit,
  type CursorPage,
  paginateRows,
} from '@/helpers/pagination';
import { isPrismaError } from '@/helpers/prisma-errors';
import type {
  CredentialRole,
  Datasource,
  DatasourceCredential,
} from '../../generated/prisma/client';
import type {
  CreateDatasourceDto,
  UpdateDatasourceDto,
} from './datasource.dto';
import { ConnectionProbe } from './connection-probe.service';
import { CredentialVault } from '@/target-db/vault/credential-vault.service';

/** A datasource joined with its credential rows (secrets stay sealed). */
export type DatasourceWithCredentials = Datasource & {
  credentials: DatasourceCredential[];
};

@Injectable()
export class DatasourceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: CredentialVault,
    private readonly probe: ConnectionProbe,
    private readonly audit: AuditService,
  ) {}

  /**
   * The workspace filter is part of every project lookup (not a post-check):
   * a project id from another workspace behaves exactly like a missing one.
   */
  private async assertProjectInWorkspace(
    workspaceId: string,
    projectId: string,
  ): Promise<void> {
    const project = await this.prisma.client.project.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  async create(
    workspaceId: string,
    projectId: string,
    input: CreateDatasourceDto,
  ): Promise<DatasourceWithCredentials> {
    await this.assertProjectInWorkspace(workspaceId, projectId);

    // Seal both secrets before the transaction so no plaintext lives longer
    // than this method's stack frame. `Uint8Array` copies satisfy Prisma 7's
    // `Bytes` typing (`Uint8Array<ArrayBuffer>`), which Node's Buffer does not.
    const [readOnlySealed, readWriteSealed] = (
      await Promise.all([
        this.vault.sealSecret(input.readOnly.password),
        this.vault.sealSecret(input.readWrite.password),
      ])
    ).map((sealed) => ({
      secretSealed: new Uint8Array(sealed.secretSealed),
      dekWrapped: new Uint8Array(sealed.dekWrapped),
      dekKeyId: sealed.dekKeyId,
    }));

    try {
      return await this.prisma.client.datasource.create({
        data: {
          projectId,
          name: input.name,
          host: input.host,
          port: input.port,
          database: input.database,
          sslMode: input.sslMode,
          credentials: {
            create: [
              {
                role: 'READ_ONLY',
                username: input.readOnly.username,
                ...readOnlySealed,
              },
              {
                role: 'READ_WRITE',
                username: input.readWrite.username,
                ...readWriteSealed,
              },
            ],
          },
        },
        include: { credentials: true },
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException(
          'A datasource with this name already exists in the project',
        );
      }
      throw error;
    }
  }

  /**
   * Partial update — the "fix your typo" path the connect flow needs: a wrong
   * password or host must never be a dead end (standing order: security with
   * fluidity). Provided credentials are re-sealed under a fresh DEK; omitted
   * ones are left untouched.
   */
  async update(
    workspaceId: string,
    projectId: string,
    datasourceId: string,
    input: UpdateDatasourceDto,
  ): Promise<DatasourceWithCredentials> {
    // Reuses the scoped lookup: foreign ids 404 before anything happens.
    await this.get(workspaceId, projectId, datasourceId);

    const connectionData = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.host !== undefined ? { host: input.host } : {}),
      ...(input.port !== undefined ? { port: input.port } : {}),
      ...(input.database !== undefined ? { database: input.database } : {}),
      ...(input.sslMode !== undefined ? { sslMode: input.sslMode } : {}),
    };

    const roleUpdates = [
      { role: 'READ_ONLY' as const, credentials: input.readOnly },
      { role: 'READ_WRITE' as const, credentials: input.readWrite },
    ].filter(
      (
        entry,
      ): entry is {
        role: CredentialRole;
        credentials: { username: string; password: string };
      } => entry.credentials !== undefined,
    );
    const sealedUpdates = await Promise.all(
      roleUpdates.map(async (entry) => {
        const sealed = await this.vault.sealSecret(entry.credentials.password);
        return {
          role: entry.role,
          username: entry.credentials.username,
          secretSealed: new Uint8Array(sealed.secretSealed),
          dekWrapped: new Uint8Array(sealed.dekWrapped),
          dekKeyId: sealed.dekKeyId,
        };
      }),
    );

    try {
      return await this.prisma.client.$transaction(async (tx) => {
        for (const update of sealedUpdates) {
          const { role, ...data } = update;
          await tx.datasourceCredential.update({
            where: {
              datasourceId_role: { datasourceId, role },
            },
            data,
          });
        }
        return tx.datasource.update({
          where: { id: datasourceId },
          data: connectionData,
          include: { credentials: true },
        });
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException(
          'A datasource with this name already exists in the project',
        );
      }
      throw error;
    }
  }

  async list(
    workspaceId: string,
    projectId: string,
    query: { cursor?: string; limit?: number },
  ): Promise<CursorPage<DatasourceWithCredentials>> {
    await this.assertProjectInWorkspace(workspaceId, projectId);
    const limit = clampLimit(query.limit);
    const rows = await this.prisma.client.datasource.findMany({
      where: { projectId },
      include: { credentials: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    return paginateRows(rows, limit, (row) => row.id);
  }

  async get(
    workspaceId: string,
    projectId: string,
    datasourceId: string,
  ): Promise<DatasourceWithCredentials> {
    await this.assertProjectInWorkspace(workspaceId, projectId);
    const datasource = await this.prisma.client.datasource.findFirst({
      where: { id: datasourceId, projectId },
      include: { credentials: true },
    });
    if (!datasource) {
      throw new NotFoundException('Datasource not found');
    }
    return datasource;
  }

  /**
   * Opens both roles against the live database and enforces the guardrail:
   * the read-only role must hold no write capability (decisions D2/D11).
   * Secrets are unsealed just-in-time, used for the probe, and dropped.
   */
  async testConnection(
    workspaceId: string,
    projectId: string,
    datasourceId: string,
    actorId: string,
  ): Promise<{ ok: boolean; problems: string[] }> {
    const datasource = await this.get(workspaceId, projectId, datasourceId);
    const problems: string[] = [];

    for (const role of ['READ_ONLY', 'READ_WRITE'] as CredentialRole[]) {
      const credential = datasource.credentials.find((c) => c.role === role);
      if (!credential) {
        // Unreachable through the API (create always writes both roles) —
        // covers rows manipulated outside the app.
        throw new BadRequestException(`Missing ${role} credential`);
      }
      const startedAt = Date.now();
      const password = await this.vault.openSecret({
        secretSealed: Buffer.from(credential.secretSealed),
        dekWrapped: Buffer.from(credential.dekWrapped),
        dekKeyId: credential.dekKeyId,
      });
      const result = await this.probe.probe(
        {
          host: datasource.host,
          port: datasource.port,
          database: datasource.database,
          user: credential.username,
          password,
          ssl: datasource.sslMode === 'REQUIRE',
        },
        { checkWriteCapability: role === 'READ_ONLY' },
      );

      const problemsBefore = problems.length;
      if (!result.connected) {
        problems.push(
          `${role}: connection failed${result.error ? ` — ${result.error}` : ''}`,
        );
      } else if (result.error) {
        problems.push(`${role}: probe failed — ${result.error}`);
      } else if (role === 'READ_ONLY' && result.canWrite) {
        problems.push(
          'READ_ONLY: this role can write (CREATE or INSERT/UPDATE/DELETE grants detected). Use a truly read-only role — see the generated SQL snippet in the connect flow',
        );
      }

      // One journal entry per probed role (decision D3) — a failed guardrail
      // check is an ERROR entry, so "who tried to connect what, and when"
      // includes the misconfigurations.
      await this.audit.record({
        workspaceId,
        actorId,
        datasourceId: datasource.id,
        role,
        action: 'CONNECTION_TEST',
        durationMs: Date.now() - startedAt,
        status: problems.length === problemsBefore ? 'OK' : 'ERROR',
        errorMessage:
          problems.length > problemsBefore
            ? problems[problems.length - 1]
            : undefined,
      });
    }

    return { ok: problems.length === 0, problems };
  }
}
