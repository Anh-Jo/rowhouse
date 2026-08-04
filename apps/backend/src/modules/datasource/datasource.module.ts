import { Module } from '@nestjs/common';
import { TargetDbModule } from '@/target-db/target-db.module';
import { ConnectionProbe } from './connection-probe.service';
import { DatasourceController } from './datasource.controller';
import { DatasourceService } from './datasource.service';
import { RoleSnippetController } from './role-snippet.controller';

@Module({
  imports: [TargetDbModule],
  controllers: [DatasourceController, RoleSnippetController],
  providers: [DatasourceService, ConnectionProbe],
})
export class DatasourceModule {}
