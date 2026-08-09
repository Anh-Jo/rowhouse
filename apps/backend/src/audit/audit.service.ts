import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  clampLimit,
  type CursorPage,
  paginateRows,
} from '@/helpers/pagination';
import type {
  AuditAction,
  AuditEvent,
  AuditStatus,
  CredentialRole,
} from '../generated/prisma/client';

/** Everything a caller must provide to journal one target-DB execution. */
export type AuditRecord = {
  workspaceId: string;
  actorId: string;
  datasourceId?: string;
  role?: CredentialRole;
  action: AuditAction;
  statement?: string;
  /** Raw params — digested here, never stored (they may carry customer PII). */
  params?: unknown[];
  rowCount?: number;
  durationMs: number;
  status: AuditStatus;
  errorMessage?: string;
  /** The human who approved a sensitive action (P2 approval flow). */
  approvedBy?: string;
};

/**
 * Append-only journal (transverse decision D3). This service is the only way
 * the application touches AuditEvent, and it exposes record + list only — no
 * update, no delete. Recording failures are rethrown: an execution that
 * cannot be journaled must not look like it succeeded silently.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditRecord): Promise<AuditEvent> {
    return this.prisma.client.auditEvent.create({
      data: {
        workspaceId: entry.workspaceId,
        actorId: entry.actorId,
        datasourceId: entry.datasourceId,
        role: entry.role,
        action: entry.action,
        statement: entry.statement,
        paramsDigest:
          entry.params && entry.params.length > 0
            ? createHash('sha256')
                .update(JSON.stringify(entry.params))
                .digest('hex')
            : undefined,
        rowCount: entry.rowCount,
        durationMs: entry.durationMs,
        status: entry.status,
        errorMessage: entry.errorMessage,
        approvedBy: entry.approvedBy,
      },
    });
  }

  async list(
    workspaceId: string,
    query: { cursor?: string; limit?: number },
  ): Promise<CursorPage<AuditEvent>> {
    const limit = clampLimit(query.limit);
    const rows = await this.prisma.client.auditEvent.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    return paginateRows(rows, limit, (row) => row.id);
  }
}
