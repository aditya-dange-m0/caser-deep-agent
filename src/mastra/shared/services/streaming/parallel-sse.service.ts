import { Injectable, Logger } from '@nestjs/common';
import { config } from 'dotenv';
import { FileLoggerService } from '../../../common/file-logger.service';

config();

@Injectable()
export class ParallelSseService {
  private readonly logger = new Logger(ParallelSseService.name);

  constructor(private readonly fileLogger?: FileLoggerService) {}

  /**
   * Stream Parallel AI events using SSE (Node.js compatible)
   * Uses fetch API with streaming for server-side execution
   *
   * @param runId - The Parallel AI task run ID
   * @param onEvent - Callback function called for each event
   * @returns Promise that resolves with the final result
   */
  async streamParallelEvents(
    runId: string,
    onEvent: (event: { type: string; data: any }) => void,
  ): Promise<any> {
    this.logger.log(`[SSE] Starting to stream events for run_id: ${runId}`);

    // Log stream start to file (fire and forget)
    if (this.fileLogger) {
      this.fileLogger
        .logEvent(runId, 'SSE_STREAM_START', {
          runId,
          timestamp: new Date().toISOString(),
        })
        .catch((err: Error) => {
          this.logger.warn(`[SSE] Failed to log stream start to file:`, err);
        });
    }

    return new Promise((resolve, reject) => {
      const PARALLEL_API_KEY = process.env.PARALLEL_API_KEY;

      if (!PARALLEL_API_KEY) {
        this.logger.error('[SSE] PARALLEL_API_KEY is not set');
        reject(new Error('PARALLEL_API_KEY is not set'));
        return;
      }

      const url = `https://api.parallel.ai/v1beta/tasks/runs/${runId}/events`;
      this.logger.debug(`[SSE] Connecting to Parallel AI SSE endpoint: ${url}`);

      let hasCompleted = false;
      let timeoutId: NodeJS.Timeout | null = null;
      let finalResult: any = null;
      let eventCount = 0;

      // Timeout after 10 minutes
      const fileLoggerRef = this.fileLogger; // Capture fileLogger for timeout
      timeoutId = setTimeout(() => {
        if (!hasCompleted) {
          hasCompleted = true;
          this.logger.warn(
            `[SSE] Stream timeout after 10 minutes for run_id: ${runId}`,
          );
          // Log timeout to file
          if (fileLoggerRef) {
            fileLoggerRef
              .logError(runId, {
                message: 'Stream timeout after 10 minutes',
                type: 'timeout',
                eventCount,
              })
              .catch((err: Error) => {
                this.logger.warn(`[SSE] Failed to log timeout to file:`, err);
              });
          }
          reject(new Error('Stream timeout after 10 minutes'));
        }
      }, 600000);

      // Use fetch with streaming for Node.js (server-side)
      fetch(url, {
        headers: {
          'x-api-key': PARALLEL_API_KEY,
          'parallel-beta': 'events-sse-2025-07-24',
          Accept: 'text/event-stream',
        },
      })
        .then((response) => {
          this.logger.log(
            `[SSE] HTTP response received: ${response.status} ${response.statusText}`,
          );

          if (!response.ok) {
            if (timeoutId) clearTimeout(timeoutId);
            this.logger.error(
              `[SSE] HTTP error for run_id ${runId}: ${response.status} ${response.statusText}`,
            );
            throw new Error(
              `HTTP error! status: ${response.status} ${response.statusText}`,
            );
          }

          if (!response.body) {
            if (timeoutId) clearTimeout(timeoutId);
            this.logger.error(
              `[SSE] Response body is null for run_id: ${runId}`,
            );
            throw new Error('Response body is null');
          }

          this.logger.log(
            `[SSE] SSE stream connected successfully for run_id: ${runId}`,
          );

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let currentEventType = 'message';
          const logger = this.logger; // Capture logger reference
          const fileLogger = this.fileLogger; // Capture fileLogger reference

          const handleEvent = (eventType: string, data: any) => {
            eventCount++;

            // Log significant events
            if (eventType === 'task_run.state') {
              logger.debug(
                `[SSE] State event received: ${data.run?.status || 'unknown'} (event #${eventCount})`,
              );
            } else if (eventType === 'task_run.progress_msg') {
              logger.debug(
                `[SSE] Progress message received (event #${eventCount})`,
              );
            } else if (eventType === 'task_run.progress_stats') {
              logger.debug(
                `[SSE] Progress stats received: ${JSON.stringify(data)}`,
              );
            } else {
              logger.debug(
                `[SSE] Event received: ${eventType} (event #${eventCount})`,
              );
            }

            // Log event to file (fire and forget - don't block streaming)
            if (fileLogger) {
              fileLogger
                .logSseEvent(runId, eventType, data)
                .catch((err: Error) => {
                  logger.warn(`[SSE] Failed to log event to file:`, err);
                });
            }

            // Call the callback (synchronously - don't block)
            onEvent({
              type: eventType,
              data: data,
            });

            // Handle completion events
            if (eventType === 'task_run.state') {
              if (data.run?.status === 'completed' && data.output !== null) {
                finalResult = {
                  output: data.output,
                  run: data.run,
                  status: 'completed',
                };
                if (!hasCompleted) {
                  hasCompleted = true;
                  if (timeoutId) clearTimeout(timeoutId);
                  logger.log(
                    `[SSE] Stream completed successfully for run_id: ${runId} (total events: ${eventCount})`,
                  );
                  // Log completion to file
                  if (fileLogger) {
                    fileLogger
                      .logStreamCompletion(runId, {
                        status: 'completed',
                        eventCount,
                        outputLength: finalResult?.output?.length || 0,
                      })
                      .catch((err: Error) => {
                        logger.warn(
                          `[SSE] Failed to log completion to file:`,
                          err,
                        );
                      });
                  }
                  resolve(finalResult);
                }
              } else if (data.run?.status === 'failed') {
                if (!hasCompleted) {
                  hasCompleted = true;
                  if (timeoutId) clearTimeout(timeoutId);
                  const errorMsg = data.run?.error || 'Task failed';
                  logger.error(
                    `[SSE] Task failed for run_id: ${runId} - ${errorMsg}`,
                  );
                  // Log failure to file
                  if (fileLogger) {
                    fileLogger
                      .logError(runId, {
                        message: errorMsg,
                        type: 'task_failed',
                        eventCount,
                      })
                      .catch((err: Error) => {
                        logger.warn(`[SSE] Failed to log error to file:`, err);
                      });
                  }
                  reject(new Error(errorMsg));
                }
              }
            }
          };

          function processStream() {
            reader
              .read()
              .then(({ done, value }) => {
                if (done) {
                  logger.log(
                    `[SSE] Stream reader done for run_id: ${runId} (events processed: ${eventCount})`,
                  );
                  if (!finalResult && !hasCompleted) {
                    if (timeoutId) clearTimeout(timeoutId);
                    logger.warn(
                      `[SSE] Stream ended without result for run_id: ${runId}`,
                    );
                    // Log incomplete stream to file
                    if (fileLogger) {
                      fileLogger
                        .logError(runId, {
                          message: 'Stream ended without result',
                          type: 'incomplete_stream',
                          eventCount,
                        })
                        .catch((err: Error) => {
                          logger.warn(
                            `[SSE] Failed to log error to file:`,
                            err,
                          );
                        });
                    }
                    reject(new Error('Stream ended without result'));
                  }
                  return;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                  if (line.trim() === '') continue; // Skip empty lines

                  if (line.startsWith('event: ')) {
                    currentEventType = line.substring(7).trim();
                  } else if (line.startsWith('data: ')) {
                    try {
                      const data = JSON.parse(line.substring(6));
                      handleEvent(currentEventType, data);
                    } catch (error) {
                      logger.error(
                        `[SSE] Error parsing event data for run_id ${runId}:`,
                        error,
                      );
                      logger.debug(
                        `[SSE] Failed to parse line: ${line.substring(0, 200)}`,
                      );
                    }
                  }
                }

                if (!hasCompleted) {
                  processStream();
                }
              })
              .catch((error) => {
                if (!hasCompleted) {
                  hasCompleted = true;
                  if (timeoutId) clearTimeout(timeoutId);
                  logger.error(
                    `[SSE] Stream processing error for run_id ${runId}:`,
                    error,
                  );
                  // Log stream processing error to file
                  if (fileLogger) {
                    fileLogger
                      .logError(runId, {
                        message:
                          error instanceof Error
                            ? error.message
                            : 'Unknown error',
                        type: 'stream_processing_error',
                        stack: error instanceof Error ? error.stack : undefined,
                        eventCount,
                      })
                      .catch((err: Error) => {
                        logger.warn(`[SSE] Failed to log error to file:`, err);
                      });
                  }
                  reject(error);
                }
              });
          }

          processStream();
        })
        .catch((error) => {
          if (timeoutId) clearTimeout(timeoutId);
          if (!hasCompleted) {
            hasCompleted = true;
            this.logger.error(`[SSE] Fetch error for run_id ${runId}:`, error);
            // Log fetch error to file
            if (this.fileLogger) {
              this.fileLogger
                .logError(runId, {
                  message:
                    error instanceof Error
                      ? error.message
                      : 'Unknown fetch error',
                  type: 'fetch_error',
                  stack: error instanceof Error ? error.stack : undefined,
                })
                .catch((err: Error) => {
                  this.logger.warn(`[SSE] Failed to log error to file:`, err);
                });
            }
            reject(error);
          }
        });
    });
  }
}
