/**
 * Base abstract class for Parallel AI task streaming services
 * Provides common functionality for all research and search streaming services
 */
import { Injectable, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { ParallelTaskService } from '../../../common/parallel-task.service';
import { ParallelSseService } from './parallel-sse.service';
import { StreamEventEmitter } from '../../../common/stream-event-emitter';
import { StreamingError } from '../../../common/errors';
import type { StreamingObserver, TaskStreamConfig } from '../../../common/types';

@Injectable()
export abstract class BaseTaskStreamingService {
  protected readonly logger: Logger;
  protected readonly serviceName: string;

  constructor(
    protected readonly taskService: ParallelTaskService,
    protected readonly sseService: ParallelSseService,
    serviceName: string,
  ) {
    this.serviceName = serviceName;
    this.logger = new Logger(serviceName);
  }

  /**
   * Stream task with Observable pattern (for NestJS SSE)
   *
   * @param config - Task configuration
   * @returns Observable that emits MessageEvent objects
   */
  streamObservable(config: TaskStreamConfig): Observable<MessageEvent> {
    const queryPreview =
      config.query?.substring(0, 100) || 'N/A';
    this.logger.log(
      `[Streaming] Starting ${this.serviceName} stream - Query: "${queryPreview}${config.query && config.query.length > 100 ? '...' : ''}", Processor: ${config.processor || 'default'}`,
    );

    return new Observable((observer) => {
      this.streamTask(config, observer).catch((error) => {
        this.logger.error(`[Streaming] Error in streamObservable:`, error);
        observer.error(error);
      });
    });
  }

  /**
   * Create task and stream events
   *
   * @param config - Task configuration
   * @param observer - RxJS observer for emitting events
   * @returns Promise that resolves when streaming is complete
   */
  protected async streamTask(
    config: TaskStreamConfig,
    observer?: StreamingObserver,
  ): Promise<void> {
    const eventEmitter = new StreamEventEmitter(
      this.logger,
      observer,
      this.serviceName,
    );

    this.logger.debug(
      `[Streaming] Preparing ${this.serviceName} task - Query: "${config.query}", Processor: ${config.processor}`,
    );

    try {
      // Generate task input using abstract method
      const taskInput = this.generateTaskInput(config);

      // Create the task (with metadata for logging)
      const runId = await this.taskService.createTask(
        taskInput,
        config.processor,
        {
          query: config.query,
          serviceName: this.serviceName,
          includeAnalysis: config.includeAnalysis,
        },
      );

      // Emit connection event
      eventEmitter.emitConnected(
        this.getConnectedMessage(),
        config as TaskStreamConfig & { [key: string]: unknown },
      );

      // Stream events
      await this.streamEvents(runId, eventEmitter, config);

      // Emit completion event
      eventEmitter.emitComplete(this.getCompletionMessage());
      eventEmitter.complete();

      this.logger.log(
        `[Streaming] ${this.serviceName} stream completed successfully - run_id: ${runId}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Streaming] Error during streaming:`, error);

      // Note: runId might not be available if task creation failed
      // In that case, error is logged by ParallelTaskService during task creation

      // Note: Errors are logged to file by ParallelTaskService or ParallelSseService
      // We don't need to log here since those services handle file logging

      eventEmitter.emitError(errorMessage);
      eventEmitter.error(
        error instanceof Error
          ? error
          : new StreamingError(errorMessage, error instanceof Error ? error : undefined),
      );
    }
  }

  /**
   * Stream events from Parallel AI SSE
   *
   * @param runId - Task run ID
   * @param eventEmitter - Event emitter helper
   * @param config - Task configuration
   */
  protected async streamEvents(
    runId: string,
    eventEmitter: StreamEventEmitter,
    config: TaskStreamConfig,
  ): Promise<void> {
    this.logger.log(
      `[Streaming] Starting to stream events for run_id: ${runId}`,
    );

    let eventCount = 0;

      await this.sseService.streamParallelEvents(runId, (event) => {
        eventCount++;
        this.handleEvent(event, eventCount);

        // Emit event to observer if available
        if (eventEmitter.hasObserver()) {
          eventEmitter.emitEvent(event.type, event.data);
        }
      });

    this.logger.log(
      `[Streaming] All events streamed successfully - run_id: ${runId} (total events: ${eventCount})`,
    );
  }

  /**
   * Handle individual events (can be overridden for custom handling)
   *
   * @param event - The event received
   * @param eventCount - Current event count
   */
  protected handleEvent(
    event: { type: string; data: unknown },
    eventCount: number,
  ): void {
    // Log significant events
    if (event.type === 'task_run.state') {
      const status = (event.data as { run?: { status?: string } })?.run?.status || 'unknown';
      this.logger.debug(
        `[Streaming] Forwarding state event (event #${eventCount}): ${status}`,
      );
    } else if (event.type === 'task_run.progress_msg') {
      this.logger.debug(
        `[Streaming] Forwarding progress message (event #${eventCount})`,
      );
    } else if (event.type === 'task_run.progress_stats') {
      this.logger.debug(
        `[Streaming] Forwarding progress stats (event #${eventCount})`,
      );
    } else {
      this.logger.debug(
        `[Streaming] Event received: ${event.type} (event #${eventCount})`,
      );
    }
  }

  // Abstract methods that must be implemented by subclasses

  /**
   * Generate the task input string based on configuration
   *
   * @param config - Task configuration
   * @returns The task input string
   */
  protected abstract generateTaskInput(config: TaskStreamConfig): string;

  /**
   * Get the connection message
   *
   * @returns Connection message string
   */
  protected abstract getConnectedMessage(): string;

  /**
   * Get the completion message
   *
   * @returns Completion message string
   */
  protected abstract getCompletionMessage(): string;
}

