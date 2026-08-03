import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { CurrentWorkspace } from '@/auth/decorators';
import { WorkspaceMemberGuard } from '@/auth/workspace.guard';
import {
  CreateProjectDto,
  ListProjectsQueryDto,
  ProjectDto,
  ProjectPageDto,
  toProjectDto,
} from './project.dto';
import { ProjectService } from './project.service';

/**
 * Workspace-scoped project CRUD. The global AuthGuard authenticates the
 * caller; WorkspaceMemberGuard then verifies membership of `:workspaceId`
 * before any handler runs — every query below is filtered by the verified
 * workspace id, never by a client-supplied value.
 */
@Controller('workspaces/:workspaceId/projects')
@UseGuards(WorkspaceMemberGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @ZodResponse({ status: 201, type: ProjectDto })
  async create(
    @CurrentWorkspace() workspaceId: string,
    @Body() body: CreateProjectDto,
  ): Promise<ProjectDto> {
    return toProjectDto(
      await this.projectService.create(workspaceId, body.name),
    );
  }

  @Get()
  @ZodResponse({ status: 200, type: ProjectPageDto })
  async list(
    @CurrentWorkspace() workspaceId: string,
    @Query() query: ListProjectsQueryDto,
  ): Promise<ProjectPageDto> {
    const page = await this.projectService.list(workspaceId, query);
    return { items: page.items.map(toProjectDto), nextCursor: page.nextCursor };
  }

  @Get(':projectId')
  @ZodResponse({ status: 200, type: ProjectDto })
  async get(
    @CurrentWorkspace() workspaceId: string,
    @Param('projectId') projectId: string,
  ): Promise<ProjectDto> {
    return toProjectDto(await this.projectService.get(workspaceId, projectId));
  }
}
