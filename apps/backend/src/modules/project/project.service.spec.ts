import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProjectService } from './project.service';
import type { PrismaService } from '@/prisma/prisma.service';

function buildRow(id: string, createdAt = new Date('2026-08-03T10:00:00Z')) {
  return {
    id,
    workspaceId: 'ws-1',
    name: `Project ${id}`,
    createdAt,
    updatedAt: createdAt,
  };
}

function createService(overrides: {
  create?: jest.Mock;
  findMany?: jest.Mock;
  findFirst?: jest.Mock;
}) {
  const project = {
    create: overrides.create ?? jest.fn(),
    findMany: overrides.findMany ?? jest.fn().mockResolvedValue([]),
    findFirst: overrides.findFirst ?? jest.fn().mockResolvedValue(null),
  };
  const prisma = { client: { project } } as unknown as PrismaService;
  return { service: new ProjectService(prisma), project };
}

describe('ProjectService', () => {
  describe('create', () => {
    it('creates the project scoped to the workspace', async () => {
      const row = buildRow('p-1');
      const create = jest.fn().mockResolvedValue(row);
      const { service } = createService({ create });

      await expect(service.create('ws-1', 'Project p-1')).resolves.toBe(row);
      expect(create).toHaveBeenCalledWith({
        data: { workspaceId: 'ws-1', name: 'Project p-1' },
      });
    });

    it('maps a unique-name violation to a 409 conflict', async () => {
      const create = jest.fn().mockRejectedValue(
        Object.assign(new Error('unique'), {
          code: 'P2002',
          name: 'PrismaClientKnownRequestError',
        }),
      );
      const { service } = createService({ create });

      await expect(service.create('ws-1', 'dup')).rejects.toThrow(
        ConflictException,
      );
    });

    it('re-throws unexpected database errors untouched', async () => {
      const boom = new Error('connection lost');
      const create = jest.fn().mockRejectedValue(boom);
      const { service } = createService({ create });

      await expect(service.create('ws-1', 'x')).rejects.toBe(boom);
    });
  });

  describe('list', () => {
    it('over-fetches by one and returns a next cursor when more rows exist', async () => {
      const rows = [buildRow('p-3'), buildRow('p-2'), buildRow('p-1')];
      const findMany = jest.fn().mockResolvedValue(rows);
      const { service } = createService({ findMany });

      const page = await service.list('ws-1', { limit: 2 });

      expect(findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 3,
      });
      expect(page.items.map((r) => r.id)).toEqual(['p-3', 'p-2']);
      expect(page.nextCursor).toBe('p-2');
    });

    it('resumes from a cursor with skip 1', async () => {
      const findMany = jest.fn().mockResolvedValue([buildRow('p-1')]);
      const { service } = createService({ findMany });

      const page = await service.list('ws-1', { cursor: 'p-2', limit: 2 });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: { id: 'p-2' }, skip: 1 }),
      );
      expect(page.nextCursor).toBeNull();
    });

    it('clamps an out-of-range limit', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const { service } = createService({ findMany });

      await service.list('ws-1', { limit: 9999 });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 51 }),
      );
    });
  });

  describe('get', () => {
    it('returns the project when it belongs to the workspace', async () => {
      const row = buildRow('p-1');
      const findFirst = jest.fn().mockResolvedValue(row);
      const { service } = createService({ findFirst });

      await expect(service.get('ws-1', 'p-1')).resolves.toBe(row);
      expect(findFirst).toHaveBeenCalledWith({
        where: { id: 'p-1', workspaceId: 'ws-1' },
      });
    });

    it('404s when the project belongs to another workspace', async () => {
      const findFirst = jest.fn().mockResolvedValue(null);
      const { service } = createService({ findFirst });

      await expect(service.get('ws-1', 'p-other')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
