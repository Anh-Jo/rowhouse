import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { CurrentWorkspace } from '@/auth/decorators';
import { WorkspaceMemberGuard } from '@/auth/workspace.guard';
import {
  AuditEventDto,
  AuditEventPageDto,
  ListAuditEventsQueryDto,
} from './audit.dto';
import { AuditService } from './audit.service';
import type { AuditEvent } from '../generated/prisma/client';

function toAuditEventDto(row: AuditEvent): AuditEventDto {
  return {
    id: row.id,
    actorId: row.actorId,
    datasourceId: row.datasourceId,
    role: row.role,
    action: row.action,
    statement: row.statement,
    rowCount: row.rowCount,
    durationMs: row.durationMs,
    status: row.status,
    errorMessage: row.errorMessage,
    approvedBy: row.approvedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Read-only view of the journal, workspace-scoped. There is no write route. */
@Controller('workspaces/:workspaceId/audit-events')
@ApiParam({ name: 'workspaceId', type: 'string' })
@UseGuards(WorkspaceMemberGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ZodResponse({ status: 200, type: AuditEventPageDto })
  async list(
    @CurrentWorkspace() workspaceId: string,
    @Query() query: ListAuditEventsQueryDto,
  ): Promise<AuditEventPageDto> {
    const page = await this.auditService.list(workspaceId, query);
    return {
      items: page.items.map(toAuditEventDto),
      nextCursor: page.nextCursor,
    };
  }
}
