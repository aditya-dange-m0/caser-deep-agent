/**
 * Shared service for creating Parallel AI tasks
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { TaskCreationError, ConfigurationError } from './errors';
import {
  PARALLEL_API_ENDPOINTS,
  PARALLEL_BETA_HEADERS,
} from './constants';
import type {
  ParallelTaskCreateRequest,
  ParallelTaskCreateResponse,
} from './types';
import { FileLoggerService } from './file-logger.service';

@Injectable()
export class ParallelTaskService {
  private readonly logger = new Logger(ParallelTaskService.name);

  constructor(@Optional() private readonly fileLogger?: FileLoggerService) {}

  /**
   * Create a Parallel AI task with events enabled
   *
   * @param taskInput - The task input string
   * @param processor - Processor type
   * @param metadata - Optional metadata for logging (query, serviceName, etc.)
   * @returns Promise resolving to the run ID
   * @throws TaskCreationError if task creation fails
   */
  async createTask(
    taskInput: string,
    processor: string,
    metadata?: {
      query?: string;
      serviceName?: string;
      [key: string]: unknown;
    },
  ): Promise<string> {
    const apiKey = this.getApiKey();

    this.logger.log(
      `[TaskService] Creating Parallel AI task - Processor: ${processor}`,
    );
    this.logger.debug(`[TaskService] Task input length: ${taskInput.length} chars`);

    try {
      const response = await fetch(PARALLEL_API_ENDPOINTS.TASK_RUNS, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'parallel-beta': PARALLEL_BETA_HEADERS.EVENTS_SSE,
        },
        body: JSON.stringify({
          input: taskInput,
          processor,
          enable_events: true,
        } as ParallelTaskCreateRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `[TaskService] Failed to create task: ${response.status} ${response.statusText} - ${errorText}`,
        );
        throw new TaskCreationError(
          `Failed to create task: ${response.status} ${response.statusText} - ${errorText}`,
          response.status,
        );
      }

      const taskRun = (await response.json()) as ParallelTaskCreateResponse;
      const runId = taskRun.run_id;

      if (!runId) {
        this.logger.error('[TaskService] Task creation response missing run_id');
        throw new TaskCreationError('Failed to create task: No run ID returned');
      }

      this.logger.log(
        `[TaskService] Task created successfully - run_id: ${runId}`,
      );

      // Create log file and log task creation
      if (this.fileLogger) {
        await this.fileLogger.createRunLog(runId, {
          ...metadata,
          processor,
          taskInputLength: taskInput.length,
        });

        await this.fileLogger.logTaskCreation(runId, {
          query: metadata?.query,
          processor,
          taskInputLength: taskInput.length,
          serviceName: metadata?.serviceName || 'Unknown',
        });
      }

      return runId;
    } catch (error) {
      if (error instanceof TaskCreationError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[TaskService] Unexpected error creating task:`, error);
      throw new TaskCreationError(
        `Unexpected error creating task: ${errorMessage}`,
        undefined,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Get and validate the Parallel API key
   *
   * @returns The API key
   * @throws ConfigurationError if API key is not set
   */
  private getApiKey(): string {
    const apiKey = process.env.PARALLEL_API_KEY;
    if (!apiKey) {
      this.logger.error('[TaskService] PARALLEL_API_KEY is not set');
      throw new ConfigurationError(
        'PARALLEL_API_KEY environment variable is not set',
      );
    }
    return apiKey;
  }
}

