import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WebSearchAgentModule } from './mastra/web-search-agent.module';
import { QuickDeepResearchAgentModule } from './mastra/quick-deep-research-agent.module';
import { DeepResearchAgentModule } from './mastra/deep-research-agent.module';
import { UltraDeepResearchAgentModule } from './mastra/ultra-deep-research-agent.module';

@Module({
  imports: [
    WebSearchAgentModule,
    QuickDeepResearchAgentModule,
    DeepResearchAgentModule,
    UltraDeepResearchAgentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
