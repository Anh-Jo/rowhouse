import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  clampLimit,
  type CursorPage,
  paginateRows,
} from '@/helpers/pagination';
import { isPrismaError } from '@/helpers/prisma-errors';
import type { Project } from '../../generated/prisma/client';

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceId: string, name: string): Promise<Project> {
    try {
      return await this.prisma.client.project.create({
        data: { workspaceId, name },
      });
    } catch (error) {
      // Unique (workspaceId, name): surface a conflict the UI can attach to
      // the name field instead of a generic 500.
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException(
          'A project with this name already exists in the workspace',
        );
      }
      throw error;
    }
  }

  async list(
    workspaceId: string,
    query: { cursor?: string; limit?: number },
  ): Promise<CursorPage<Project>> {
    const limit = clampLimit(query.limit);
    const rows = await this.prisma.client.project.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    return paginateRows(rows, limit, (row) => row.id);
  }

  /**
   * Fetches a project inside the caller's workspace. The workspace filter is
   * part of the query (not a post-check) so a project id from another
   * workspace behaves exactly like a missing one: 404, no existence probing.
   */
  async get(workspaceId: string, projectId: string): Promise<Project> {
    const project = await this.prisma.client.project.findFirst({
      where: { id: projectId, workspaceId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }
}
