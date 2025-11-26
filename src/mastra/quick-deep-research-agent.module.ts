import { Module } from '@nestjs/common';
import { QuickDeepResearchAgentController } from './quick-deep-research-agent.controller';
import { QuickDeepResearchAgentService } from './services/quick-deep-research-agent.service';

@Module({
  controllers: [QuickDeepResearchAgentController],
  providers: [QuickDeepResearchAgentService],
  exports: [QuickDeepResearchAgentService],
})
export class QuickDeepResearchAgentModule {}

