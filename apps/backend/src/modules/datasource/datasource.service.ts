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
  CloudSqlConnection,
  CredentialRole,
  Datasource,
  DatasourceCredential,
  DirectConnection,
  Prisma,
} from '../../generated/prisma/client';
import type {
  CreateDatasourceDto,
  UpdateDatasourceDto,
} from './datasource.dto';
import { ConnectionProbe } from './connection-probe.service';
import { CredentialVault } from '@/target-db/vault/credential-vault.service';
import { resolveConnectionConfig } from '@/target-db/resolve-connection-config';

/**
 * A datasource joined with its credential rows and its method row (decision
 * D12) — secrets stay sealed.
 */
export type DatasourceWithCredentials = Datasource & {
  credentials: DatasourceCredential[];
  direct: DirectConnection | null;
  cloudSql: CloudSqlConnection | null;
};

/** Every read of a datasource joins the same relations. */
const DATASOURCE_INCLUDE = {
  credentials: true,
  direct: true,
  cloudSql: true,
} as const;

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

  /**
   * Seals a secret and converts to `Uint8Array` copies, which satisfy Prisma
   * 7's `Bytes` typing (`Uint8Array<ArrayBuffer>`) where Node's Buffer does
   * not. No plaintext lives longer than the caller's stack frame.
   */
  private async sealToBytes(plaintext: string): Promise<{
    secretSealed: Uint8Array<ArrayBuffer>;
    dekWrapped: Uint8Array<ArrayBuffer>;
    dekKeyId: string;
  }> {
    const sealed = await this.vault.sealSecret(plaintext);
    return {
      secretSealed: new Uint8Array(sealed.secretSealed),
      dekWrapped: new Uint8Array(sealed.dekWrapped),
      dekKeyId: sealed.dekKeyId,
    };
  }

  /**
   * The discriminator and its method row are written in ONE nested create —
   * a single transaction, so the D12 invariant ("exactly one method row,
   * matching the discriminator") can never be observed half-applied.
   */
  async create(
    workspaceId: string,
    projectId: string,
    input: CreateDatasourceDto,
  ): Promise<DatasourceWithCredentials> {
    await this.assertProjectInWorkspace(workspaceId, projectId);

    // Under Cloud SQL IAM auth roles hold no password (ephemeral tokens,
    // decision D12) — an empty secret is sealed so the ro/rw duality and the
    // sealed-triplet shape stay uniform across methods.
    const [readOnlySealed, readWriteSealed] = await Promise.all([
      this.sealToBytes(input.readOnly.password ?? ''),
      this.sealToBytes(input.readWrite.password ?? ''),
    ]);
    const credentials = {
      create: [
        {
          role: 'READ_ONLY' as const,
          username: input.readOnly.username,
          ...readOnlySealed,
        },
        {
          role: 'READ_WRITE' as const,
          username: input.readWrite.username,
          ...readWriteSealed,
        },
      ],
    };

    let methodData: Pick<
      Prisma.DatasourceUncheckedCreateInput,
      'connectionMethod' | 'direct' | 'cloudSql'
    >;
    if (input.method === 'CLOUDSQL') {
      const saKey = await this.sealToBytes(input.saKeyJson);
      methodData = {
        connectionMethod: 'CLOUDSQL',
        cloudSql: {
          create: {
            instanceConnectionName: input.instanceConnectionName,
            database: input.database,
            authType: input.authType,
            saKeySealed: saKey.secretSealed,
            saKeyDekWrapped: saKey.dekWrapped,
            saKeyDekKeyId: saKey.dekKeyId,
          },
        },
      };
    } else {
      methodData = {
        connectionMethod: 'DIRECT',
        direct: {
          create: {
            host: input.host,
            port: input.port,
            database: input.database,
            sslMode: input.sslMode,
            caCert: input.caCert ?? null,
          },
        },
      };
    }

    try {
      return await this.prisma.client.datasource.create({
        data: {
          projectId,
          name: input.name,
          ...methodData,
          credentials,
        },
        include: DATASOURCE_INCLUDE,
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
   * ones are left untouched. Method rules are enforced against the STORED
   * datasource: fields of the other method 400, and the method itself is
   * fixed in P1.5.
   */
  async update(
    workspaceId: string,
    projectId: string,
    datasourceId: string,
    input: UpdateDatasourceDto,
  ): Promise<DatasourceWithCredentials> {
    // Reuses the scoped lookup: foreign ids 404 before anything happens.
    const existing = await this.get(workspaceId, projectId, datasourceId);

    if (
      input.method !== undefined &&
      input.method !== existing.connectionMethod
    ) {
      throw new BadRequestException(
        'The connection method cannot change — create a new datasource to change the connection method',
      );
    }
    const directData = {
      ...(input.host !== undefined ? { host: input.host } : {}),
      ...(input.port !== undefined ? { port: input.port } : {}),
      ...(input.database !== undefined ? { database: input.database } : {}),
      ...(input.sslMode !== undefined ? { sslMode: input.sslMode } : {}),
      ...(input.caCert !== undefined ? { caCert: input.caCert } : {}),
    };
    if (
      existing.connectionMethod !== 'DIRECT' &&
      Object.keys(directData).length > 0
    ) {
      throw new BadRequestException(
        'host, port, database, sslMode and caCert only apply to the DIRECT connection method',
      );
    }
    if (existing.connectionMethod !== 'CLOUDSQL' && input.cloudSql) {
      throw new BadRequestException(
        'cloudSql settings only apply to the CLOUDSQL connection method',
      );
    }

    // Credential passwords follow the stored method: required everywhere
    // except under Cloud SQL IAM auth, where holding one is the mistake.
    const iamAuth =
      existing.connectionMethod === 'CLOUDSQL' &&
      existing.cloudSql?.authType === 'IAM';
    const roleUpdates = [
      { role: 'READ_ONLY' as CredentialRole, credentials: input.readOnly },
      { role: 'READ_WRITE' as CredentialRole, credentials: input.readWrite },
    ].filter(
      (
        entry,
      ): entry is {
        role: CredentialRole;
        credentials: { username: string; password?: string };
      } => entry.credentials !== undefined,
    );
    for (const entry of roleUpdates) {
      const hasPassword = entry.credentials.password !== undefined;
      if (!iamAuth && !hasPassword) {
        throw new BadRequestException(
          `${entry.role}: a password is required to update this role's credentials`,
        );
      }
      if (iamAuth && hasPassword) {
        throw new BadRequestException(
          `${entry.role}: IAM auth uses ephemeral tokens — database users hold no password`,
        );
      }
    }
    const sealedUpdates = await Promise.all(
      roleUpdates.map(async (entry) => ({
        role: entry.role,
        username: entry.credentials.username,
        ...(await this.sealToBytes(entry.credentials.password ?? '')),
      })),
    );

    const cloudSqlData = {
      ...(input.cloudSql?.instanceConnectionName !== undefined
        ? { instanceConnectionName: input.cloudSql.instanceConnectionName }
        : {}),
      ...(input.cloudSql?.database !== undefined
        ? { database: input.cloudSql.database }
        : {}),
      ...(input.cloudSql?.saKeyJson !== undefined
        ? await this.sealToBytes(input.cloudSql.saKeyJson).then((sealed) => ({
            saKeySealed: sealed.secretSealed,
            saKeyDekWrapped: sealed.dekWrapped,
            saKeyDekKeyId: sealed.dekKeyId,
          }))
        : {}),
    };

    try {
      // One transaction for the whole update: the discriminator, its method
      // row and the credentials can never drift apart (D12 invariant).
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
        if (Object.keys(directData).length > 0) {
          await tx.directConnection.update({
            where: { datasourceId },
            data: directData,
          });
        }
        if (Object.keys(cloudSqlData).length > 0) {
          await tx.cloudSqlConnection.update({
            where: { datasourceId },
            data: cloudSqlData,
          });
        }
        return tx.datasource.update({
          where: { id: datasourceId },
          data: input.name !== undefined ? { name: input.name } : {},
          include: DATASOURCE_INCLUDE,
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
      include: DATASOURCE_INCLUDE,
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
      include: DATASOURCE_INCLUDE,
    });
    if (!datasource) {
      throw new NotFoundException('Datasource not found');
    }
    return datasource;
  }

  /**
   * Opens both roles against the live database and enforces the guardrail:
   * the read-only role must hold no write capability (decisions D2/D11).
   * Secrets are unsealed just-in-time by the connection resolver, used for
   * the probe, and dropped.
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
      const result = await this.probe.probe(
        await resolveConnectionConfig(datasource, credential, this.vault),
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
