/**
 * Streaming service for Deep Research tasks
 * Extends BaseTaskStreamingService to provide deep research specific functionality
 */
import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { BaseTaskStreamingService } from '../../../shared/services/streaming/base-task-streaming.service';
import { ParallelTaskService } from '../../../common/parallel-task.service';
import { ParallelSseService } from '../../../shared/services/streaming/parallel-sse.service';
import type { TaskStreamConfig } from '../../../common/types';

@Injectable()
export class DeepResearchStreamingService extends BaseTaskStreamingService {
  constructor(
    taskService: ParallelTaskService,
    sseService: ParallelSseService,
  ) {
    super(taskService, sseService, DeepResearchStreamingService.name);
  }

  /**
   * Stream deep research with Observable pattern (for NestJS SSE)
   * Maintains backward compatibility with existing API
   *
   * @param query - Research query
   * @param processor - Processor type (core or pro)
   * @returns Observable that emits MessageEvent objects
   */
  streamResearchObservable(
    query: string,
    processor: string = 'core',
  ): Observable<MessageEvent> {
    return this.streamObservable({
      query,
      processor,
      includeAnalysis: true,
    });
  }

  /**
   * Generate task input for deep research
   *
   * @param config - Task configuration
   * @returns The task input string
   */
  protected generateTaskInput(config: TaskStreamConfig): string {
    const { query, includeAnalysis = true } = config;

    return `Perform an extensive and comprehensive deep research on: ${query}. 

Requirements:
- Conduct thorough, multi-faceted investigation and analysis
- Gather information from diverse, credible, and authoritative sources
- Provide detailed insights, findings, and comprehensive analysis
- Include relevant data, statistics, evidence, and expert opinions
- ${includeAnalysis ? 'Include in-depth analysis, trends, implications, and future outlook' : 'Provide comprehensive factual information'}
- Structure the research with clear sections, subsections, and well-reasoned conclusions
- Cite sources and provide references where applicable
- Identify key stakeholders, trends, and patterns
- Address potential counterarguments or alternative perspectives

Deliver a comprehensive, well-structured research report that thoroughly covers all aspects of the topic with depth and rigor.`;
  }

  /**
   * Get the connection message
   */
  protected getConnectedMessage(): string {
    return 'Connected, starting deep research...';
  }

  /**
   * Get the completion message
   */
  protected getCompletionMessage(): string {
    return 'Deep research completed successfully';
  }
}
