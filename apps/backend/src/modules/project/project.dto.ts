import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const ProjectNameSchema = z
  .string()
  .trim()
  .min(1, 'Project name is required')
  .max(100, 'Project name must be 100 characters or fewer')
  .describe('Human-readable project name, unique inside the workspace');

const CreateProjectSchema = z.object({
  name: ProjectNameSchema,
});

export class CreateProjectDto extends createZodDto(CreateProjectSchema) {}

const ProjectSchema = z.object({
  id: z.string().describe('Project id'),
  workspaceId: z.string().describe('Owning workspace (organization) id'),
  name: ProjectNameSchema,
  createdAt: z.iso.datetime().describe('Creation timestamp (ISO 8601)'),
  updatedAt: z.iso.datetime().describe('Last update timestamp (ISO 8601)'),
});

export class ProjectDto extends createZodDto(ProjectSchema) {}

/**
 * Maps a Prisma row to the response shape. Dates go out as ISO strings —
 * `z.date()` cannot be represented in the OpenAPI JSON schema, so the
 * serialization is explicit here instead of implicit in JSON.stringify.
 */
export function toProjectDto(row: {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}): ProjectDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const ListProjectsQuerySchema = z.object({
  cursor: z.string().optional().describe('Opaque cursor from a previous page'),
  limit: z.coerce
    .number()
    .int()
    .optional()
    .describe('Page size (clamped server-side)'),
});

export class ListProjectsQueryDto extends createZodDto(
  ListProjectsQuerySchema,
) {}

const ProjectPageSchema = z.object({
  items: z.array(ProjectSchema).describe('Projects, newest first'),
  nextCursor: z
    .string()
    .nullable()
    .describe('Cursor for the next page, null on the last page'),
});

export class ProjectPageDto extends createZodDto(ProjectPageSchema) {}
