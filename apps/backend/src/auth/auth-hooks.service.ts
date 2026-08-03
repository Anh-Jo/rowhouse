import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { AuthHooksPort } from './auth.d.ts';

/**
 * Keeps the app-side `User` row in sync with the better-auth user lifecycle.
 * Wired into better-auth via `databaseHooks` in `buildAuthOptions`.
 */
@Injectable()
export class AuthHooks implements AuthHooksPort {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A better-auth user was created → create the mirror app `User` with the
   * same id. `displayName` defaults to the sign-up name.
   */
  async handleUserCreated(user: { id: string; name: string }): Promise<void> {
    await this.prisma.client.user.create({
      data: { id: user.id, displayName: user.name },
    });
  }

  /**
   * A better-auth user is being deleted → remove the app `User`. Related rows
   * cascade once your models declare `onDelete: Cascade` on their User
   * relation. `deleteMany` is idempotent: it never throws if the row is gone.
   */
  async handleUserDeleted(user: { id: string }): Promise<void> {
    await this.prisma.client.user.deleteMany({ where: { id: user.id } });
  }
}
