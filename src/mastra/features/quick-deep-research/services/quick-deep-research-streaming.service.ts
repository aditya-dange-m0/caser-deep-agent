/**
 * Streaming service for Quick Deep Research tasks
 * Extends BaseTaskStreamingService to provide quick deep research specific functionality
 */
import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { BaseTaskStreamingService } from '../../../shared/services/streaming/base-task-streaming.service';
import { ParallelTaskService } from '../../../common/parallel-task.service';
import { ParallelSseService } from '../../../shared/services/streaming/parallel-sse.service';
import type { TaskStreamConfig } from '../../../common/types';

@Injectable()
export class QuickDeepResearchStreamingService extends BaseTaskStreamingService {
  constructor(
    taskService: ParallelTaskService,
    sseService: ParallelSseService,
  ) {
    super(taskService, sseService, QuickDeepResearchStreamingService.name);
  }

  /**
   * Stream quick deep research with Observable pattern (for NestJS SSE)
   * Maintains backward compatibility with existing API
   *
   * @param query - Research query
   * @param processor - Processor type (base or core)
   * @returns Observable that emits MessageEvent objects
   */
  streamResearchObservable(
    query: string,
    processor: string = 'base',
  ): Observable<MessageEvent> {
    return this.streamObservable({
      query,
      processor,
      includeAnalysis: true,
    });
  }

  /**
   * Generate task input for quick deep research
   *
   * @param config - Task configuration
   * @returns The task input string
   */
  protected generateTaskInput(config: TaskStreamConfig): string {
    const { query, includeAnalysis = true } = config;

    return `Perform a comprehensive deep research on: ${query}. 

Requirements:
- Conduct thorough investigation and analysis
- Gather information from multiple credible sources
- Provide detailed insights and findings
- Include relevant data, statistics, and evidence
- ${includeAnalysis ? 'Include in-depth analysis, trends, and implications' : 'Provide factual information'}
- Structure the research with clear sections and conclusions
- Cite sources and provide references where applicable

Deliver a well-structured research report that covers all aspects of the topic.`;
  }

  /**
   * Get the connection message
   */
  protected getConnectedMessage(): string {
    return 'Connected, starting quick deep research...';
  }

  /**
   * Get the completion message
   */
  protected getCompletionMessage(): string {
    return 'Quick deep research completed successfully';
  }
}
