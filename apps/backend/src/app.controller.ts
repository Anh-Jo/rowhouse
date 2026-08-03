import { Controller, Get } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { AppService } from './app.service';
import { HelloResponseDto } from './app.dto';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ZodResponse({ status: 200, type: HelloResponseDto })
  getHello(): HelloResponseDto {
    return { message: this.appService.getHello() };
  }
}
