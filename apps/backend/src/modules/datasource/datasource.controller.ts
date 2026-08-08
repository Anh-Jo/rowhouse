import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { CurrentUser, CurrentWorkspace } from '@/auth/decorators';
import { WorkspaceMemberGuard } from '@/auth/workspace.guard';
import {
  ConnectionTestDto,
  CreateDatasourceDto,
  DatasourceDto,
  DatasourcePageDto,
  ListDatasourcesQueryDto,
  UpdateDatasourceDto,
} from './datasource.dto';
import {
  DatasourceService,
  type DatasourceWithCredentials,
} from './datasource.service';

/**
 * Maps a row to the response shape: role usernames and non-secret method
 * fields only — the sealed secret columns (role passwords, the Cloud SQL
 * service-account key) never cross this boundary (decision D10).
 */
function toDatasourceDto(row: DatasourceWithCredentials): DatasourceDto {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    type: row.type,
    method: row.connectionMethod,
    ...(row.direct
      ? {
          host: row.direct.host,
          port: row.direct.port,
          database: row.direct.database,
          sslMode: row.direct.sslMode,
          caCert: row.direct.caCert,
        }
      : {}),
    ...(row.cloudSql
      ? {
          cloudSql: {
            instanceConnectionName: row.cloudSql.instanceConnectionName,
            database: row.cloudSql.database,
            authType: row.cloudSql.authType,
          },
        }
      : {}),
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
@ApiParam({ name: 'workspaceId', type: 'string' })
@ApiParam({ name: 'projectId', type: 'string' })
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

  @Patch(':datasourceId')
  @ZodResponse({ status: 200, type: DatasourceDto })
  async update(
    @CurrentWorkspace() workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('datasourceId') datasourceId: string,
    @Body() body: UpdateDatasourceDto,
  ): Promise<DatasourceDto> {
    return toDatasourceDto(
      await this.datasourceService.update(
        workspaceId,
        projectId,
        datasourceId,
        body,
      ),
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
    @CurrentUser() actorId: string,
  ): Promise<ConnectionTestDto> {
    return this.datasourceService.testConnection(
      workspaceId,
      projectId,
      datasourceId,
      actorId,
    );
  }
}
