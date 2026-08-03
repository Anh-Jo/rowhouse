import { PrismaPg } from '@prisma/adapter-pg';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
// Relative import required: a `@prisma/*` alias would conflict with the npm `@prisma/client` package.
import { PrismaClient } from '../generated/prisma/client';
import { env } from '@/config/env';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private _client: PrismaClient | null = null;

  get client(): PrismaClient {
    if (!this._client) {
      const connectionString = env.get('DATABASE_URL');
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
