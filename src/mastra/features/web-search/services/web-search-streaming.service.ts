/**
 * Streaming service for Web Search tasks
 * Extends BaseTaskStreamingService to provide web search specific functionality
 */
import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { BaseTaskStreamingService } from '../../../shared/services/streaming/base-task-streaming.service';
import { ParallelTaskService } from '../../../common/parallel-task.service';
import { ParallelSseService } from '../../../shared/services/streaming/parallel-sse.service';
import type { TaskStreamConfig } from '../../../common/types';

@Injectable()
export class WebSearchStreamingService extends BaseTaskStreamingService {
  constructor(
    taskService: ParallelTaskService,
    sseService: ParallelSseService,
  ) {
    super(taskService, sseService, WebSearchStreamingService.name);
  }

  /**
   * Stream web search with Observable pattern (for NestJS SSE)
   * Maintains backward compatibility with existing API
   *
   * @param query - Search query
   * @param processor - Processor type (lite or base)
   * @param maxResults - Maximum number of results
   * @param includeExcerpts - Whether to include detailed excerpts
   * @returns Observable that emits MessageEvent objects
   */
  streamSearchObservable(
    query: string,
    processor: string = 'lite',
    maxResults: number = 10,
    includeExcerpts: boolean = true,
  ): Observable<MessageEvent> {
    return this.streamObservable({
      query,
      processor,
      maxResults,
      includeExcerpts,
    } as TaskStreamConfig);
  }

  /**
   * Generate task input for web search
   *
   * @param config - Task configuration
   * @returns The task input string
   */
  protected generateTaskInput(config: TaskStreamConfig): string {
    const {
      query,
      maxResults = 10,
      includeExcerpts = true,
    } = config as TaskStreamConfig & {
      maxResults?: number;
      includeExcerpts?: boolean;
    };

    return `Find relevant, accurate, and up-to-date information about: ${query}. Return up to ${maxResults} results with ${includeExcerpts ? 'detailed excerpts' : 'brief summaries'}. Include source URLs and titles for each result. Format the results as a structured list with the following information for each result:
1. Title
2. Content/Excerpt (${includeExcerpts ? 'detailed' : 'brief'})
3. Source URL
4. Relevance score (if available)
5. Published date (if available)

Provide ${maxResults} results total.`;
  }

  /**
   * Override streamObservable to handle web search specific config
   */
  override streamObservable(
    config: TaskStreamConfig,
  ): Observable<MessageEvent> {
    const queryPreview = config.query?.substring(0, 100) || 'N/A';
    this.logger.log(
      `[Streaming] Starting ${this.serviceName} stream - Query: "${queryPreview}${config.query && config.query.length > 100 ? '...' : ''}", Processor: ${config.processor || 'lite'}, MaxResults: ${(config as TaskStreamConfig & { maxResults?: number }).maxResults || 10}`,
    );

    return super.streamObservable(config);
  }

  /**
   * Override to include maxResults in connected message
   */
  protected getConnectedMessage(): string {
    return 'Connected, starting web search...';
  }

  /**
   * Get the completion message
   */
  protected getCompletionMessage(): string {
    return 'Web search completed successfully';
  }
}
