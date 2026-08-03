import { Module } from '@nestjs/common';
import { TargetDbModule } from '@/target-db/target-db.module';
import { ConnectionProbe } from './connection-probe.service';
import { DatasourceController } from './datasource.controller';
import { DatasourceService } from './datasource.service';

@Module({
  imports: [TargetDbModule],
  controllers: [DatasourceController],
  providers: [DatasourceService, ConnectionProbe],
})
export class DatasourceModule {}
