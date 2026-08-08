import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  const findUnique = jest.fn();

  beforeEach(async () => {
    findUnique.mockReset();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: { client: { user: { findUnique } } },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return the greeting message', () => {
      expect(appController.getHello()).toEqual({ message: 'Hello World!' });
    });
  });

  describe('me', () => {
    it('returns the app user mirror for the authenticated id', async () => {
      findUnique.mockResolvedValue({
        id: 'user-1',
        displayName: 'Ada Lovelace',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(appController.getMe('user-1')).resolves.toEqual({
        id: 'user-1',
        displayName: 'Ada Lovelace',
      });
      expect(findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });

    it('throws NotFound when the mirror row is missing', async () => {
      findUnique.mockResolvedValue(null);

      await expect(appController.getMe('ghost')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
