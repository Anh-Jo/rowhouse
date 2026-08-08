import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { WorkspaceMemberGuard } from '@/auth/workspace.guard';
import { RoleSnippetDto, RoleSnippetRequestDto } from './datasource.dto';
import { buildRoleSnippet } from './role-snippet';

/**
 * Serves the least-privilege setup script (decision D11). Workspace-level —
 * it is the first step of the connect flow, before any datasource row
 * exists. POST because the snippet is derived from the request body; it
 * reads nothing and writes nothing.
 */
@Controller('workspaces/:workspaceId/datasource-role-snippet')
@ApiParam({ name: 'workspaceId', type: 'string' })
@UseGuards(WorkspaceMemberGuard)
export class RoleSnippetController {
  @Post()
  @HttpCode(200)
  @ZodResponse({ status: 200, type: RoleSnippetDto })
  build(@Body() body: RoleSnippetRequestDto): RoleSnippetDto {
    return { sql: buildRoleSnippet(body) };
  }
}
