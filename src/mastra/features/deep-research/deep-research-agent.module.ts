import { Module } from '@nestjs/common';
import { DeepResearchAgentController } from './deep-research-agent.controller';
import { DeepResearchAgentService } from './services/deep-research-agent.service';
import { ParallelSseService } from '../../shared/services/streaming/parallel-sse.service';
import { ParallelTaskService } from '../../common/parallel-task.service';
import { FileLoggerService } from '../../common/file-logger.service';
import { DeepResearchStreamingService } from './services/deep-research-streaming.service';

@Module({
  controllers: [DeepResearchAgentController],
  providers: [
    DeepResearchAgentService,
    FileLoggerService,
    ParallelSseService,
    ParallelTaskService,
    DeepResearchStreamingService,
  ],
  exports: [DeepResearchAgentService, DeepResearchStreamingService],
})
export class DeepResearchAgentModule {}
