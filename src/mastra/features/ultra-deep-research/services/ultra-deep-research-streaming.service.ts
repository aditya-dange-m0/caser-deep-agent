/**
 * Streaming service for Ultra Deep Research tasks
 * Extends BaseTaskStreamingService to provide ultra deep research specific functionality
 */
import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { BaseTaskStreamingService } from '../../../shared/services/streaming/base-task-streaming.service';
import { ParallelTaskService } from '../../../common/parallel-task.service';
import { ParallelSseService } from '../../../shared/services/streaming/parallel-sse.service';
import type { TaskStreamConfig } from '../../../common/types';

@Injectable()
export class UltraDeepResearchStreamingService extends BaseTaskStreamingService {
  constructor(
    taskService: ParallelTaskService,
    sseService: ParallelSseService,
  ) {
    super(taskService, sseService, UltraDeepResearchStreamingService.name);
  }

  /**
   * Stream ultra deep research with Observable pattern (for NestJS SSE)
   * Maintains backward compatibility with existing API
   *
   * @param query - Research query
   * @param processor - Processor type (pro, ultra, ultra2x, ultra4x, or ultra8x)
   * @returns Observable that emits MessageEvent objects
   */
  streamResearchObservable(
    query: string,
    processor: string = 'pro',
  ): Observable<MessageEvent> {
    return this.streamObservable({
      query,
      processor,
      includeAnalysis: true,
    });
  }

  /**
   * Generate task input for ultra deep research
   *
   * @param config - Task configuration
   * @returns The task input string
   */
  protected generateTaskInput(config: TaskStreamConfig): string {
    const { query, includeAnalysis = true } = config;

    return `Perform an ultra-comprehensive, exhaustive deep research on: ${query}. 

Requirements:
- Conduct the most thorough, multi-dimensional investigation and analysis possible
- Gather information from the widest range of credible, authoritative, and expert sources
- Provide extremely detailed insights, findings, and comprehensive analysis
- Include extensive relevant data, statistics, evidence, expert opinions, and case studies
- ${includeAnalysis ? 'Include exhaustive in-depth analysis, trends, implications, future outlook, and strategic recommendations' : 'Provide the most comprehensive factual information available'}
- Structure the research with clear sections, subsections, detailed analysis, and well-reasoned conclusions
- Cite all sources and provide comprehensive references
- Identify all key stakeholders, trends, patterns, and relationships
- Address all potential counterarguments, alternative perspectives, and edge cases
- Include comparative analysis, historical context, and forward-looking projections
- Provide actionable insights and recommendations where applicable

Deliver an ultra-comprehensive, meticulously structured research report that exhaustively covers all aspects of the topic with maximum depth, rigor, and analytical sophistication. This should be the most thorough research possible on the subject.`;
  }

  /**
   * Get the connection message
   */
  protected getConnectedMessage(): string {
    return 'Connected, starting ultra deep research...';
  }

  /**
   * Get the completion message
   */
  protected getCompletionMessage(): string {
    return 'Ultra deep research completed successfully';
  }
}
