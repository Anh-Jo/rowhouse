import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/audit/audit.service';
import type { AuditAction, CredentialRole } from '../generated/prisma/client';
import type {
  IntrospectedSchema,
  ReadResult,
  WriteResult,
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
 * and every write against a customer database goes through here — humans via
 * the explorer, the agent later via the very same methods. Guarantees, in the
 * execution path and not in any prompt or convention:
 *
 * - workspace scoping: the datasource is resolved through its project's
 *   workspace, so a foreign id 404s exactly like a missing one;
 * - role separation: reads run on the READ_ONLY role; writes run on the
 *   READ_WRITE role and only through `executeWrite`, whose datasource-level
 *   transaction refuses to commit anything but a single-row change;
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
    return this.execute(
      context,
      { action: 'INTROSPECT', role: 'READ_ONLY', params: [] },
      (connection) => this.postgres.introspect(connection),
    );
  }

  async executeRead(
    context: ExecutionContext,
    sql: string,
    params: unknown[] = [],
  ): Promise<ReadResult> {
    return this.execute(
      context,
      { action: 'READ', role: 'READ_ONLY', statement: sql, params },
      (connection) => this.postgres.executeRead(connection, sql, params),
    );
  }

  /**
   * The governed write path (decision D2): the READ_WRITE role's connection
   * opens only here. The single-row transaction guard lives in the datasource
   * implementation; this method resolves the datasource through the workspace,
   * selects the READ_WRITE credential and journals exactly one WRITE event.
   * `approvedBy` stays undefined until P2's approval flow (slice C) routes an
   * approved change through here.
   */
  async executeWrite(
    context: ExecutionContext,
    sql: string,
    params: unknown[] = [],
    options: { approvedBy?: string } = {},
  ): Promise<WriteResult> {
    return this.execute(
      context,
      {
        action: 'WRITE',
        role: 'READ_WRITE',
        statement: sql,
        params,
        approvedBy: options.approvedBy,
      },
      (connection) => this.postgres.executeWrite(connection, sql, params),
    );
  }

  private async execute<
    T extends IntrospectedSchema | ReadResult | WriteResult,
  >(
    context: ExecutionContext,
    op: {
      action: AuditAction;
      role: CredentialRole;
      statement?: string;
      params: unknown[];
      approvedBy?: string;
    },
    run: (connection: TargetConnection) => Promise<T>,
  ): Promise<T> {
    const datasource = await this.prisma.client.datasource.findFirst({
      where: {
        id: context.datasourceId,
        project: { workspaceId: context.workspaceId },
      },
      include: {
        credentials: { where: { role: op.role } },
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
        role: op.role,
        action: op.action,
        statement: op.statement,
        params: op.params,
        rowCount: 'rowCount' in result ? result.rowCount : undefined,
        durationMs: Date.now() - startedAt,
        status: 'OK',
        approvedBy: op.approvedBy,
      });
      return result;
    } catch (error) {
      await this.audit.record({
        workspaceId: context.workspaceId,
        actorId: context.actorId,
        datasourceId: datasource.id,
        role: op.role,
        action: op.action,
        statement: op.statement,
        params: op.params,
        durationMs: Date.now() - startedAt,
        status: 'ERROR',
        errorMessage: error instanceof Error ? error.message : String(error),
        approvedBy: op.approvedBy,
      });
      throw error;
    } finally {
      await connection?.end().catch(() => undefined);
    }
  }
}
