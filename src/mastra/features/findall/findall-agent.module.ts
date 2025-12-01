import { Module } from '@nestjs/common';
import { FindAllAgentController } from './findall-agent.controller';
import { FindAllAgentService } from './services/findall-agent.service';
import { FindAllStreamingService } from './services/findall-streaming.service';

@Module({
  controllers: [FindAllAgentController],
  providers: [FindAllAgentService, FindAllStreamingService],
  exports: [FindAllAgentService, FindAllStreamingService],
})
export class FindAllAgentModule {}
