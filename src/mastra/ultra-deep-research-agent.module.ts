import { Module } from '@nestjs/common';
import { UltraDeepResearchAgentController } from './ultra-deep-research-agent.controller';
import { UltraDeepResearchAgentService } from './services/ultra-deep-research-agent.service';

@Module({
  controllers: [UltraDeepResearchAgentController],
  providers: [UltraDeepResearchAgentService],
  exports: [UltraDeepResearchAgentService],
})
export class UltraDeepResearchAgentModule {}

