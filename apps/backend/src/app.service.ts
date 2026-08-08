import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MeResponseDto } from './app.dto';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  /** Loads the caller's app `User` mirror (created by AuthHooks at sign-up). */
  async getMe(userId: string): Promise<MeResponseDto> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return { id: user.id, displayName: user.displayName };
  }
}
