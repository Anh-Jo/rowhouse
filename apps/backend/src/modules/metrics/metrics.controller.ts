import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiExcludeController } from '@nestjs/swagger';
import { register } from 'prom-client';
import { Public } from '@/auth/decorators';

@ApiExcludeController()
@Controller('metrics')
@SkipThrottle()
export class MetricsController {
  // `@Public()` on the handler keeps the protected-by-default regime for any
  // future route added to this controller.
  @Get()
  @Public()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}
