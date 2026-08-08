import { PrismaPGlite } from 'pglite-prisma-adapter';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaClient as AuthPrismaClient } from '../../src/generated/auth-prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthPrismaService } from '@/auth/auth-prisma.service';
import { resolveBackendDir, setupPGlite } from './pglite.helper';

/**
 * Creates a PrismaService backed by an in-memory PGlite instance (app
 * database). Use with NestJS `overrideProvider` in e2e tests:
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

/**
 * Creates an AuthPrismaService backed by a second in-memory PGlite instance,
 * migrated with the better-auth schema (`prisma/auth/migrations`).
 */
export async function createPGliteAuthPrismaService() {
  const { pg, stop } = await setupPGlite(
    resolveBackendDir('prisma/auth/migrations'),
  );
  const adapter = new PrismaPGlite(pg);
  const authPrismaClient = new AuthPrismaClient({ adapter });
  await authPrismaClient.$connect();

  const authPrismaService = {
    client: authPrismaClient,
    onModuleInit: async () => {},
    onModuleDestroy: async () => {
      await authPrismaClient.$disconnect();
      await stop();
    },
  } as unknown as AuthPrismaService;

  return {
    authPrismaService,
    cleanup: async () => {
      await authPrismaClient.$disconnect();
      await stop();
    },
  };
}

/**
 * Sets up both databases (app + auth) on separate PGlite instances and returns
 * the services to override plus a single combined `cleanup`. This is the
 * standard fixture for the auth-aware e2e suites.
 */
export async function createPGliteDatabases() {
  const { prismaService, cleanup: cleanupApp } =
    await createPGlitePrismaService();
  const { authPrismaService, cleanup: cleanupAuth } =
    await createPGliteAuthPrismaService();

  return {
    prismaService,
    authPrismaService,
    cleanup: async () => {
      await cleanupApp();
      await cleanupAuth();
    },
  };
}
