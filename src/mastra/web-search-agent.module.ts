import { Module } from '@nestjs/common';
import { WebSearchAgentController } from './web-search-agent.controller';
import { WebSearchAgentService } from './services/web-search-agent.service';

@Module({
  controllers: [WebSearchAgentController],
  providers: [WebSearchAgentService],
  exports: [WebSearchAgentService],
})
export class WebSearchAgentModule {}

