import { Module } from '@nestjs/common';
import { TargetDbModule } from '@/target-db/target-db.module';
import { ExplorerController } from './explorer.controller';
import { ExplorerService } from './explorer.service';

@Module({
  imports: [TargetDbModule],
  controllers: [ExplorerController],
  providers: [ExplorerService],
})
export class ExplorerModule {}
