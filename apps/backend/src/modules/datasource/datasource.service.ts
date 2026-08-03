import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
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
import type { CreateDatasourceDto } from './datasource.dto';
import { ConnectionProbe } from './connection-probe.service';
import { CredentialVault } from './vault/credential-vault.service';

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
    }

    return { ok: problems.length === 0, problems };
  }
}
