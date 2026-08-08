import { Module } from '@nestjs/common';
import { TargetDbModule } from '@/target-db/target-db.module';
import { IntrospectionController } from './introspection.controller';
import { IntrospectionService } from './introspection.service';

@Module({
  imports: [TargetDbModule],
  controllers: [IntrospectionController],
  providers: [IntrospectionService],
})
export class IntrospectionModule {}
