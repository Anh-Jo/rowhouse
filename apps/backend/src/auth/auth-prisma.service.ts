import { PrismaPg } from '@prisma/adapter-pg';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
// Relative import required: a `@prisma/*` alias would conflict with the npm `@prisma/client` package.
import { PrismaClient } from '../generated/auth-prisma/client';
import { env } from '@/config/env';

/**
 * Prisma client for the better-auth database (`AUTH_DATABASE_URL`), separate
 * from the app database. better-auth owns these tables; the app never writes
 * to them directly — only the auth handler and hooks do.
 */
@Injectable()
export class AuthPrismaService implements OnModuleInit, OnModuleDestroy {
  private _client: PrismaClient | null = null;

  get client(): PrismaClient {
    if (!this._client) {
      const connectionString = env.get('AUTH_DATABASE_URL');
      const adapter = new PrismaPg({ connectionString });
      this._client = new PrismaClient({ adapter });
    }
    return this._client;
  }

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    if (this._client) {
      await this._client.$disconnect();
      this._client = null;
    }
  }
}
