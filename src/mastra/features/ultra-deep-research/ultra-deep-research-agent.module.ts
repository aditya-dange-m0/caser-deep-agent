import { Module } from '@nestjs/common';
import { UltraDeepResearchAgentController } from './ultra-deep-research-agent.controller';
import { UltraDeepResearchAgentService } from './services/ultra-deep-research-agent.service';
import { ParallelSseService } from '../../shared/services/streaming/parallel-sse.service';
import { ParallelTaskService } from '../../common/parallel-task.service';
import { FileLoggerService } from '../../common/file-logger.service';
import { UltraDeepResearchStreamingService } from './services/ultra-deep-research-streaming.service';

@Module({
  controllers: [UltraDeepResearchAgentController],
  providers: [
    UltraDeepResearchAgentService,
    FileLoggerService,
    ParallelSseService,
    ParallelTaskService,
    UltraDeepResearchStreamingService,
  ],
  exports: [UltraDeepResearchAgentService, UltraDeepResearchStreamingService],
})
export class UltraDeepResearchAgentModule {}
