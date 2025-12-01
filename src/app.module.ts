import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WebSearchAgentModule } from './mastra/features/web-search/web-search-agent.module';
import { QuickDeepResearchAgentModule } from './mastra/features/quick-deep-research/quick-deep-research-agent.module';
import { DeepResearchAgentModule } from './mastra/features/deep-research/deep-research-agent.module';
import { UltraDeepResearchAgentModule } from './mastra/features/ultra-deep-research/ultra-deep-research-agent.module';
import { FindAllAgentModule } from './mastra/features/findall/findall-agent.module';

@Module({
  imports: [
    WebSearchAgentModule,
    QuickDeepResearchAgentModule,
    DeepResearchAgentModule,
    UltraDeepResearchAgentModule,
    FindAllAgentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
