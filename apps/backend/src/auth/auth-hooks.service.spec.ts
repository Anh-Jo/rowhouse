import { AuthHooks } from './auth-hooks.service';
import type { PrismaService } from '@/prisma/prisma.service';

describe('AuthHooks', () => {
  const create = jest.fn().mockResolvedValue(undefined);
  const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
  const prisma = {
    client: { user: { create, deleteMany } },
  } as unknown as PrismaService;
  const hooks = new AuthHooks(prisma);

  beforeEach(() => {
    create.mockClear();
    deleteMany.mockClear();
  });

  describe('handleUserCreated', () => {
    it('mirrors the better-auth user into the app database (same id, name → displayName)', async () => {
      await hooks.handleUserCreated({ id: 'user-1', name: 'Ada Lovelace' });

      expect(create).toHaveBeenCalledWith({
        data: { id: 'user-1', displayName: 'Ada Lovelace' },
      });
    });
  });

  describe('handleUserDeleted', () => {
    it('removes the app user with an idempotent deleteMany', async () => {
      await hooks.handleUserDeleted({ id: 'user-2' });

      expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'user-2' } });
    });
  });
});
