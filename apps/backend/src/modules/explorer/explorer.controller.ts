import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { CurrentUser, CurrentWorkspace } from '@/auth/decorators';
import { WorkspaceMemberGuard } from '@/auth/workspace.guard';
import { ListRowsQueryDto, RecordDetailDto, RowPageDto } from './explorer.dto';
import { ExplorerService } from './explorer.service';

/**
 * Row reading for the explorer views. Same guard regime as the whole tree;
 * every page served is one governed, audited READ on the READ_ONLY role.
 */
@Controller(
  'workspaces/:workspaceId/projects/:projectId/datasources/:datasourceId/tables/:tableId',
)
@ApiParam({ name: 'workspaceId', type: 'string' })
@ApiParam({ name: 'projectId', type: 'string' })
@ApiParam({ name: 'datasourceId', type: 'string' })
@ApiParam({ name: 'tableId', type: 'string' })
@UseGuards(WorkspaceMemberGuard)
export class ExplorerController {
  constructor(private readonly explorerService: ExplorerService) {}

  @Get('rows')
  @ZodResponse({ status: 200, type: RowPageDto })
  listRows(
    @CurrentWorkspace() workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('datasourceId') datasourceId: string,
    @Param('tableId') tableId: string,
    @CurrentUser() actorId: string,
    @Query() query: ListRowsQueryDto,
  ): Promise<RowPageDto> {
    return this.explorerService.listRows(
      workspaceId,
      projectId,
      datasourceId,
      tableId,
      actorId,
      query,
    );
  }

  @Get('rows/:rowKey')
  @ZodResponse({ status: 200, type: RecordDetailDto })
  getRecord(
    @CurrentWorkspace() workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('datasourceId') datasourceId: string,
    @Param('tableId') tableId: string,
    @Param('rowKey') rowKey: string,
    @CurrentUser() actorId: string,
  ): Promise<RecordDetailDto> {
    return this.explorerService.getRecord(
      workspaceId,
      projectId,
      datasourceId,
      tableId,
      rowKey,
      actorId,
    );
  }
}
