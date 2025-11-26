import { Module } from '@nestjs/common';
import { DeepResearchAgentController } from './deep-research-agent.controller';
import { DeepResearchAgentService } from './services/deep-research-agent.service';

@Module({
  controllers: [DeepResearchAgentController],
  providers: [DeepResearchAgentService],
  exports: [DeepResearchAgentService],
})
export class DeepResearchAgentModule {}

