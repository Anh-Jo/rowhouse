import { Controller, Get } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { CurrentUser, Public } from '@/auth/decorators';
import { AppService } from './app.service';
import { HelloResponseDto, MeResponseDto } from './app.dto';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // `@Public()` sits on the handler (not the class) so the app-wide
  // protected-by-default regime holds for any future route added here.
  @Get()
  @Public()
  @ZodResponse({ status: 200, type: HelloResponseDto })
  getHello(): HelloResponseDto {
    return { message: this.appService.getHello() };
  }

  /**
   * Reference protected route: no `@Public()`, so AuthGuard requires a session
   * and `@CurrentUser()` injects the verified app user id (see the invariant
   * on the decorator — non-optional `string` is safe on protected handlers).
   */
  @Get('me')
  @ZodResponse({ status: 200, type: MeResponseDto })
  getMe(@CurrentUser() userId: string): Promise<MeResponseDto> {
    return this.appService.getMe(userId);
  }
}
