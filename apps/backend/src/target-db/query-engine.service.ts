import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/audit/audit.service';
import type { CredentialRole } from '../generated/prisma/client';
import type {
  IntrospectedSchema,
  ReadResult,
} from './external-datasource.d.ts';
import { PostgresExternalDatasource } from './postgres.external-datasource';
import { resolveConnectionConfig } from './resolve-connection-config';
import {
  TargetConnectionFactory,
  type TargetConnection,
} from './target-connection.factory';
import { CredentialVault } from './vault/credential-vault.service';

/** Who is acting, on which datasource, inside which workspace. */
export type ExecutionContext = {
  workspaceId: string;
  actorId: string;
  datasourceId: string;
};

/**
 * THE governed execution path (transverse decisions D2, D3, D4). Every read
 * against a customer database goes through here — humans via the explorer,
 * the agent later via the very same methods. Guarantees, in the execution
 * path and not in any prompt or convention:
 *
 * - workspace scoping: the datasource is resolved through its project's
 *   workspace, so a foreign id 404s exactly like a missing one;
 * - read-only by default: this service only exposes reads, on the READ_ONLY
 *   role's connection (the READ_WRITE role has no code path until P2's
 *   approval flow);
 * - one audit event per execution, success or failure — written even when
 *   the connection could not be opened.
 */
@Injectable()
export class QueryEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: CredentialVault,
    private readonly connections: TargetConnectionFactory,
    private readonly postgres: PostgresExternalDatasource,
    private readonly audit: AuditService,
  ) {}

  async introspect(context: ExecutionContext): Promise<IntrospectedSchema> {
    return this.execute(context, 'INTROSPECT', undefined, [], (connection) =>
      this.postgres.introspect(connection),
    );
  }

  async executeRead(
    context: ExecutionContext,
    sql: string,
    params: unknown[] = [],
  ): Promise<ReadResult> {
    return this.execute(context, 'READ', sql, params, (connection) =>
      this.postgres.executeRead(connection, sql, params),
    );
  }

  private async execute<T extends IntrospectedSchema | ReadResult>(
    context: ExecutionContext,
    action: 'INTROSPECT' | 'READ',
    statement: string | undefined,
    params: unknown[],
    run: (connection: TargetConnection) => Promise<T>,
  ): Promise<T> {
    const role: CredentialRole = 'READ_ONLY';
    const datasource = await this.prisma.client.datasource.findFirst({
      where: {
        id: context.datasourceId,
        project: { workspaceId: context.workspaceId },
      },
      include: {
        credentials: { where: { role } },
        direct: true,
        cloudSql: true,
      },
    });
    if (!datasource || datasource.credentials.length === 0) {
      throw new NotFoundException('Datasource not found');
    }
    const credential = datasource.credentials[0];

    const startedAt = Date.now();
    let connection: TargetConnection | null = null;
    try {
      // Resolves the method row (decision D12) and unseals just-in-time.
      connection = await this.connections.connect(
        await resolveConnectionConfig(datasource, credential, this.vault),
      );
      const result = await run(connection);
      await this.audit.record({
        workspaceId: context.workspaceId,
        actorId: context.actorId,
        datasourceId: datasource.id,
        role,
        action,
        statement,
        params,
        rowCount: 'rowCount' in result ? result.rowCount : undefined,
        durationMs: Date.now() - startedAt,
        status: 'OK',
      });
      return result;
    } catch (error) {
      await this.audit.record({
        workspaceId: context.workspaceId,
        actorId: context.actorId,
        datasourceId: datasource.id,
        role,
        action,
        statement,
        params,
        durationMs: Date.now() - startedAt,
        status: 'ERROR',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      await connection?.end().catch(() => undefined);
    }
  }
}
