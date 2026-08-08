import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { CurrentWorkspace } from '@/auth/decorators';
import { WorkspaceMemberGuard } from '@/auth/workspace.guard';
import {
  ConnectionTestDto,
  CreateDatasourceDto,
  DatasourceDto,
  DatasourcePageDto,
  ListDatasourcesQueryDto,
} from './datasource.dto';
import {
  DatasourceService,
  type DatasourceWithCredentials,
} from './datasource.service';

/**
 * Maps a row to the response shape: role usernames only — the sealed secret
 * columns never cross this boundary (decision D10).
 */
function toDatasourceDto(row: DatasourceWithCredentials): DatasourceDto {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    type: row.type,
    host: row.host,
    port: row.port,
    database: row.database,
    sslMode: row.sslMode,
    roles: row.credentials.map((credential) => ({
      role: credential.role,
      username: credential.username,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Same guard regime as projects: membership verified before any handler. */
@Controller('workspaces/:workspaceId/projects/:projectId/datasources')
@UseGuards(WorkspaceMemberGuard)
export class DatasourceController {
  constructor(private readonly datasourceService: DatasourceService) {}

  @Post()
  @ZodResponse({ status: 201, type: DatasourceDto })
  async create(
    @CurrentWorkspace() workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() body: CreateDatasourceDto,
  ): Promise<DatasourceDto> {
    return toDatasourceDto(
      await this.datasourceService.create(workspaceId, projectId, body),
    );
  }

  @Get()
  @ZodResponse({ status: 200, type: DatasourcePageDto })
  async list(
    @CurrentWorkspace() workspaceId: string,
    @Param('projectId') projectId: string,
    @Query() query: ListDatasourcesQueryDto,
  ): Promise<DatasourcePageDto> {
    const page = await this.datasourceService.list(
      workspaceId,
      projectId,
      query,
    );
    return {
      items: page.items.map(toDatasourceDto),
      nextCursor: page.nextCursor,
    };
  }

  @Get(':datasourceId')
  @ZodResponse({ status: 200, type: DatasourceDto })
  async get(
    @CurrentWorkspace() workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('datasourceId') datasourceId: string,
  ): Promise<DatasourceDto> {
    return toDatasourceDto(
      await this.datasourceService.get(workspaceId, projectId, datasourceId),
    );
  }

  /**
   * POST (not GET): probing opens live connections to the customer database.
   * 200 with `ok: false` + actionable problems, never a 500, for expected
   * failures — unreachable host, bad password, write-capable read-only role.
   */
  @Post(':datasourceId/test-connection')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: ConnectionTestDto })
  testConnection(
    @CurrentWorkspace() workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('datasourceId') datasourceId: string,
  ): Promise<ConnectionTestDto> {
    return this.datasourceService.testConnection(
      workspaceId,
      projectId,
      datasourceId,
    );
  }
}
