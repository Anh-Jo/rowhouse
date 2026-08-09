import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { CurrentUser, CurrentWorkspace } from '@/auth/decorators';
import { WorkspaceMemberGuard } from '@/auth/workspace.guard';
import type { SchemaColumn } from '../../generated/prisma/client';
import {
  DatasourceSchemaDto,
  SchemaColumnDto,
  SchemaTableDto,
  SyncResultDto,
  UpdateColumnMetadataDto,
  UpdateTableMetadataDto,
} from './introspection.dto';
import {
  IntrospectionService,
  type TableWithColumns,
} from './introspection.service';

function toColumnDto(column: SchemaColumn) {
  return {
    id: column.id,
    name: column.name,
    dataType: column.dataType,
    enumValues: column.enumValues,
    isNullable: column.isNullable,
    isPrimaryKey: column.isPrimaryKey,
    refTable: column.refTable,
    refColumn: column.refColumn,
    position: column.position,
    description: column.description,
    isPii: column.isPii,
  };
}

function toTableDto(table: TableWithColumns): SchemaTableDto {
  return {
    id: table.id,
    schema: table.schema,
    name: table.name,
    description: table.description,
    columns: table.columns.map(toColumnDto),
  };
}

/** Same guard regime as the rest of the tree: membership before anything. */
@Controller(
  'workspaces/:workspaceId/projects/:projectId/datasources/:datasourceId/schema',
)
@ApiParam({ name: 'workspaceId', type: 'string' })
@ApiParam({ name: 'projectId', type: 'string' })
@ApiParam({ name: 'datasourceId', type: 'string' })
@UseGuards(WorkspaceMemberGuard)
export class IntrospectionController {
  constructor(private readonly introspectionService: IntrospectionService) {}

  /** POST: introspects the live database (audited) and reconciles the snapshot. */
  @Post('sync')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: SyncResultDto })
  sync(
    @CurrentWorkspace() workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('datasourceId') datasourceId: string,
    @CurrentUser() actorId: string,
  ): Promise<SyncResultDto> {
    return this.introspectionService.sync(
      workspaceId,
      projectId,
      datasourceId,
      actorId,
    );
  }

  @Get()
  @ZodResponse({ status: 200, type: DatasourceSchemaDto })
  async getSchema(
    @CurrentWorkspace() workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('datasourceId') datasourceId: string,
  ): Promise<DatasourceSchemaDto> {
    const { tables, syncedAt } = await this.introspectionService.getSchema(
      workspaceId,
      projectId,
      datasourceId,
    );
    return {
      tables: tables.map(toTableDto),
      syncedAt: syncedAt ? syncedAt.toISOString() : null,
    };
  }

  @Patch('tables/:tableId')
  @ZodResponse({ status: 200, type: SchemaTableDto })
  async updateTable(
    @CurrentWorkspace() workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('tableId') tableId: string,
    @Body() body: UpdateTableMetadataDto,
  ): Promise<SchemaTableDto> {
    return toTableDto(
      await this.introspectionService.updateTableMetadata(
        workspaceId,
        projectId,
        tableId,
        body,
      ),
    );
  }

  @Patch('columns/:columnId')
  @ZodResponse({ status: 200, type: SchemaColumnDto })
  async updateColumn(
    @CurrentWorkspace() workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('columnId') columnId: string,
    @Body() body: UpdateColumnMetadataDto,
  ): Promise<SchemaColumnDto> {
    return toColumnDto(
      await this.introspectionService.updateColumnMetadata(
        workspaceId,
        projectId,
        columnId,
        body,
      ),
    );
  }
}
