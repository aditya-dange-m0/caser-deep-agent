import { Module } from '@nestjs/common';
import { FindAllAgentController } from './findall-agent.controller';
import { FindAllAgentService } from './services/findall-agent.service';
import { TimeoutConfigService } from '../../common/timeout-config.service';

@Module({
  controllers: [FindAllAgentController],
  providers: [FindAllAgentService, TimeoutConfigService],
  exports: [FindAllAgentService],
})
export class FindAllAgentModule {}
