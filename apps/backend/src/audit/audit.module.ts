import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

/**
 * The append-only journal (decision D3). `@Global()` like AuthModule: every
 * layer that executes anything against a customer database must be able to
 * journal it without ceremony — friction here would create silent gaps.
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
