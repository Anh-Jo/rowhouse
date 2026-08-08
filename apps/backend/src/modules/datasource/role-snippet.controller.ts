import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { WorkspaceMemberGuard } from '@/auth/workspace.guard';
import {
  CloudSqlSnippetDto,
  CloudSqlSnippetRequestDto,
  RoleSnippetDto,
  RoleSnippetRequestDto,
} from './datasource.dto';
import { buildCloudSqlSnippet } from './cloud-sql-snippet';
import { buildRoleSnippet } from './role-snippet';

/**
 * Serves the least-privilege setup scripts (decision D11), one per
 * connection method (decision D12). Workspace-level — it is the first step
 * of the connect flow, before any datasource row exists. POST because the
 * snippets are derived from the request body; they read nothing and write
 * nothing.
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

  /** Cloud SQL sibling: gcloud + SQL, IAM database users, zero passwords. */
  @Post('cloud-sql')
  @HttpCode(200)
  @ZodResponse({ status: 200, type: CloudSqlSnippetDto })
  buildCloudSql(@Body() body: CloudSqlSnippetRequestDto): CloudSqlSnippetDto {
    return { script: buildCloudSqlSnippet(body) };
  }
}
