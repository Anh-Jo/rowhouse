import { PrismaPGlite } from 'pglite-prisma-adapter';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { setupPGlite } from './pglite.helper';

/**
 * Creates a PrismaService backed by an in-memory PGlite instance.
 * Use with NestJS `overrideProvider` in e2e tests:
 *
 * ```ts
 * const { prismaService, cleanup } = await createPGlitePrismaService();
 * const module = await Test.createTestingModule({ imports: [AppModule] })
 *   .overrideProvider(PrismaService)
 *   .useValue(prismaService)
 *   .compile();
 * ```
 */
export async function createPGlitePrismaService() {
  const { pg, stop } = await setupPGlite();
  const adapter = new PrismaPGlite(pg);
  const prismaClient = new PrismaClient({ adapter });
  await prismaClient.$connect();

  const prismaService = {
    client: prismaClient,
    onModuleInit: async () => {},
    onModuleDestroy: async () => {
      await prismaClient.$disconnect();
      await stop();
    },
  } as unknown as PrismaService;

  return {
    prismaService,
    cleanup: async () => {
      await prismaClient.$disconnect();
      await stop();
    },
  };
}
