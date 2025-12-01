import { Module } from '@nestjs/common';
import { WebSearchAgentController } from './web-search-agent.controller';
import { WebSearchAgentService } from './services/web-search-agent.service';
import { ParallelSseService } from '../../shared/services/streaming/parallel-sse.service';
import { ParallelTaskService } from '../../common/parallel-task.service';
import { FileLoggerService } from '../../common/file-logger.service';
import { WebSearchStreamingService } from './services/web-search-streaming.service';

@Module({
  controllers: [WebSearchAgentController],
  providers: [
    WebSearchAgentService,
    FileLoggerService,
    ParallelSseService,
    ParallelTaskService,
    WebSearchStreamingService,
  ],
  exports: [WebSearchAgentService, WebSearchStreamingService],
})
export class WebSearchAgentModule {}
