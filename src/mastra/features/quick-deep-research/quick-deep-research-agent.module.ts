import { Module } from '@nestjs/common';
import { QuickDeepResearchAgentController } from './quick-deep-research-agent.controller';
import { QuickDeepResearchAgentService } from './services/quick-deep-research-agent.service';
import { ParallelSseService } from '../../shared/services/streaming/parallel-sse.service';
import { ParallelTaskService } from '../../common/parallel-task.service';
import { FileLoggerService } from '../../common/file-logger.service';
import { TimeoutConfigService } from '../../common/timeout-config.service';
import { QuickDeepResearchStreamingService } from './services/quick-deep-research-streaming.service';

@Module({
  controllers: [QuickDeepResearchAgentController],
  providers: [
    QuickDeepResearchAgentService,
    FileLoggerService,
    TimeoutConfigService,
    ParallelSseService,
    ParallelTaskService,
    QuickDeepResearchStreamingService,
  ],
  exports: [QuickDeepResearchAgentService, QuickDeepResearchStreamingService],
})
export class QuickDeepResearchAgentModule {}
