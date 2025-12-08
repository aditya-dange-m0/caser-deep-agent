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
   * Supports automatic reconnection using last_event_id when stream disconnects
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

    const PARALLEL_API_KEY = process.env.PARALLEL_API_KEY;

    if (!PARALLEL_API_KEY) {
      throw new Error('PARALLEL_API_KEY is not set');
    }

    // Shared state across reconnections
    let hasCompleted = false;
    let finalResult: any = null;
    let eventCount = 0;
    let lastKnownStatus: string | null = null;
    let lastKnownRun: any = null;
    let lastEventId: string | null = null;
    let reconnectAttempt = 0;
    const maxReconnectAttempts = 10;

    return new Promise((resolve, reject) => {
      const streamWithReconnect = async (
        lastEventIdParam: string | null = null,
      ) => {
        // Update lastEventId from parameter if provided
        if (lastEventIdParam !== null) {
          lastEventId = lastEventIdParam;
        }

        // Build URL with last_event_id parameter if we have one
        const baseUrl = `https://api.parallel.ai/v1beta/tasks/runs/${runId}/events`;
        const url = lastEventId
          ? `${baseUrl}?last_event_id=${encodeURIComponent(lastEventId)}`
          : baseUrl;

        const connectionLabel = lastEventId
          ? `[SSE] Reconnecting (attempt ${reconnectAttempt + 1}/${maxReconnectAttempts}) for run_id: ${runId} from event_id: ${lastEventId}`
          : `[SSE] Connecting to Parallel AI SSE endpoint for run_id: ${runId}`;

        this.logger.log(connectionLabel);
        this.logger.debug(`[SSE] URL: ${url}`);

        try {
          const response = await fetch(url, {
            headers: {
              'x-api-key': PARALLEL_API_KEY,
              'parallel-beta': 'events-sse-2025-07-24',
              Accept: 'text/event-stream',
            },
          });

          this.logger.log(
            `[SSE] HTTP response received: ${response.status} ${response.statusText}`,
          );

          if (!response.ok) {
            throw new Error(
              `HTTP error! status: ${response.status} ${response.statusText}`,
            );
          }

          if (!response.body) {
            throw new Error('Response body is null');
          }

          this.logger.log(
            `[SSE] SSE stream connected successfully for run_id: ${runId}${lastEventId ? ` (resumed from event ${lastEventId})` : ''}`,
          );

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let currentEventType = 'message';
          let currentEventId: string | null = null;

          const handleEvent = (
            eventType: string,
            data: any,
            eventId: string | null,
          ) => {
            eventCount++;

            // Update lastEventId if we received one
            if (eventId) {
              lastEventId = eventId;
            }

            // Log significant events
            if (eventType === 'task_run.state') {
              lastKnownStatus = data.run?.status || null;
              lastKnownRun = data.run || null;
              const processorType = data.run?.processor;
              this.logger.debug(
                `[SSE] State event received: ${lastKnownStatus || 'unknown'} (event #${eventCount})${processorType ? `, processor: ${processorType}` : ''}${eventId ? `, id: ${eventId}` : ''}`,
              );
            } else if (eventType === 'task_run.progress_msg') {
              this.logger.debug(
                `[SSE] Progress message received (event #${eventCount})${eventId ? `, id: ${eventId}` : ''}`,
              );
            } else if (eventType === 'task_run.progress_stats') {
              this.logger.debug(
                `[SSE] Progress stats received: ${JSON.stringify(data)}${eventId ? `, id: ${eventId}` : ''}`,
              );
            } else if (eventType === 'error') {
              const errorMessage =
                typeof data === 'object' && data !== null
                  ? data.message || data.error?.message || JSON.stringify(data)
                  : data || 'Unknown error';
              this.logger.error(
                `[SSE] Error event received (event #${eventCount}): ${errorMessage}${eventId ? `, id: ${eventId}` : ''}`,
              );
            } else {
              this.logger.debug(
                `[SSE] Event received: ${eventType} (event #${eventCount})${eventId ? `, id: ${eventId}` : ''}`,
              );
            }

            // Log event to file (fire and forget - don't block streaming)
            if (this.fileLogger) {
              this.fileLogger
                .logSseEvent(runId, eventType, data)
                .catch((err: Error) => {
                  this.logger.warn(`[SSE] Failed to log event to file:`, err);
                });
            }

            // Normalize error data before passing to callback
            let normalizedData = data;
            if (eventType === 'error') {
              if (typeof data === 'object' && data !== null) {
                normalizedData = {
                  message:
                    data.message || data.error?.message || JSON.stringify(data),
                  ...data,
                };
              }
            }

            // Call the callback (synchronously - don't block)
            onEvent({
              type: eventType,
              data: normalizedData,
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
                  this.logger.log(
                    `[SSE] Stream completed successfully for run_id: ${runId} (total events: ${eventCount})`,
                  );
                  // Log completion to file
                  if (this.fileLogger) {
                    this.fileLogger
                      .logStreamCompletion(runId, {
                        status: 'completed',
                        eventCount,
                        outputLength: finalResult?.output?.length || 0,
                      })
                      .catch((err: Error) => {
                        this.logger.warn(
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
                  // Extract error message from error object
                  const errorObj = data.run?.error;
                  const errorMsg =
                    typeof errorObj === 'object' && errorObj !== null
                      ? errorObj.message || JSON.stringify(errorObj)
                      : errorObj || 'Task failed';

                  const errorDetails = {
                    message: errorMsg,
                    refId: errorObj?.ref_id || null,
                    detail: errorObj?.detail || null,
                    fullError: errorObj,
                  };

                  this.logger.error(
                    `[SSE] Task failed for run_id: ${runId} - ${errorMsg}`,
                    errorObj?.detail ? `Detail: ${errorObj.detail}` : '',
                  );
                  // Log failure to file
                  if (this.fileLogger) {
                    this.fileLogger
                      .logError(runId, {
                        ...errorDetails,
                        type: 'task_failed',
                        eventCount,
                      })
                      .catch((err: Error) => {
                        this.logger.warn(
                          `[SSE] Failed to log error to file:`,
                          err,
                        );
                      });
                  }
                  reject(new Error(errorMsg));
                }
              }
            }
          };

          const processStream = async () => {
            try {
              while (!hasCompleted) {
                const { done, value } = await reader.read();

                if (done) {
                  this.logger.log(
                    `[SSE] Stream reader done for run_id: ${runId} (events processed: ${eventCount})`,
                  );

                  // If stream ended and task is still running, reconnect
                  if (
                    !finalResult &&
                    !hasCompleted &&
                    lastKnownStatus === 'running'
                  ) {
                    if (reconnectAttempt < maxReconnectAttempts) {
                      reconnectAttempt++;
                      const delayMs = Math.min(
                        1000 * Math.pow(2, reconnectAttempt - 1),
                        30000,
                      ); // Exponential backoff, max 30s

                      this.logger.warn(
                        `[SSE] Stream disconnected while task is still running. Reconnecting in ${delayMs}ms (attempt ${reconnectAttempt}/${maxReconnectAttempts})...`,
                      );

                      // Emit reconnection event
                      onEvent({
                        type: 'stream_reconnect',
                        data: {
                          message: `Stream disconnected, reconnecting... (attempt ${reconnectAttempt}/${maxReconnectAttempts})`,
                          lastEventId,
                          reconnectAttempt,
                          lastKnownStatus,
                        },
                      });

                      // Wait before reconnecting
                      await new Promise((resolve) =>
                        setTimeout(resolve, delayMs),
                      );

                      // Reconnect with last event ID
                      await streamWithReconnect(lastEventId);
                      return;
                    } else {
                      // Max reconnection attempts reached
                      const errorMessage = `Stream ended without final result after ${maxReconnectAttempts} reconnection attempts. Last known status: ${lastKnownStatus} (events processed: ${eventCount})`;
                      this.logger.error(`[SSE] ${errorMessage}`);

                      if (this.fileLogger) {
                        this.fileLogger
                          .logError(runId, {
                            message: errorMessage,
                            type: 'max_reconnect_attempts_reached',
                            eventCount,
                            lastKnownStatus,
                            lastKnownRun,
                            lastEventId,
                            reconnectAttempts: reconnectAttempt,
                          })
                          .catch((err: Error) => {
                            this.logger.warn(
                              `[SSE] Failed to log error to file:`,
                              err,
                            );
                          });
                      }
                      reject(new Error(errorMessage));
                      return;
                    }
                  } else if (!finalResult && !hasCompleted) {
                    // Stream ended but task is not running - treat as error
                    const errorMessage = lastKnownStatus
                      ? `Stream ended without final result. Last known status: ${lastKnownStatus} (events processed: ${eventCount})`
                      : `Stream ended without result. No status events received (events processed: ${eventCount})`;

                    this.logger.warn(
                      `[SSE] Stream ended without result for run_id: ${runId}. Last known status: ${lastKnownStatus || 'none'}`,
                    );
                    // Log incomplete stream to file
                    if (this.fileLogger) {
                      this.fileLogger
                        .logError(runId, {
                          message: errorMessage,
                          type: 'incomplete_stream',
                          eventCount,
                          lastKnownStatus,
                          lastKnownRun,
                          lastEventId,
                        })
                        .catch((err: Error) => {
                          this.logger.warn(
                            `[SSE] Failed to log error to file:`,
                            err,
                          );
                        });
                    }
                    reject(new Error(errorMessage));
                    return;
                  }
                  return;
                }

                buffer += decoder.decode(value, { stream: true });

                // Parse complete SSE events (events are separated by double newlines)
                const eventBlocks = buffer.split('\n\n');
                buffer = eventBlocks.pop() || ''; // Keep incomplete event in buffer

                for (const eventBlock of eventBlocks) {
                  if (!eventBlock.trim()) continue;

                  let eventId: string | null = null;
                  let eventType = 'message';
                  let eventData: any = null;

                  const lines = eventBlock.split('\n');
                  for (const line of lines) {
                    if (line.startsWith('id: ')) {
                      eventId = line.substring(4).trim() || null;
                    } else if (line.startsWith('event: ')) {
                      eventType = line.substring(7).trim();
                    } else if (line.startsWith('data: ')) {
                      try {
                        const dataStr = line.substring(6);
                        eventData = JSON.parse(dataStr);
                      } catch (error) {
                        this.logger.error(
                          `[SSE] Error parsing event data for run_id ${runId}:`,
                          error,
                        );
                        this.logger.debug(
                          `[SSE] Failed to parse data line: ${line.substring(0, 200)}`,
                        );
                        continue; // Skip this event if data parsing fails
                      }
                    }
                  }

                  // Process the complete event if we have data
                  if (eventData !== null) {
                    handleEvent(eventType, eventData, eventId);
                  }
                }
              }
            } catch (error) {
              if (!hasCompleted) {
                // Connection error - try to reconnect if task is still running
                if (
                  lastKnownStatus === 'running' &&
                  reconnectAttempt < maxReconnectAttempts
                ) {
                  reconnectAttempt++;
                  const delayMs = Math.min(
                    1000 * Math.pow(2, reconnectAttempt - 1),
                    30000,
                  );

                  this.logger.warn(
                    `[SSE] Stream processing error for run_id ${runId}. Reconnecting in ${delayMs}ms (attempt ${reconnectAttempt}/${maxReconnectAttempts})...`,
                    error,
                  );

                  // Emit reconnection event
                  onEvent({
                    type: 'stream_reconnect',
                    data: {
                      message: `Stream error occurred, reconnecting... (attempt ${reconnectAttempt}/${maxReconnectAttempts})`,
                      lastEventId,
                      reconnectAttempt,
                      lastKnownStatus,
                      error:
                        error instanceof Error
                          ? error.message
                          : 'Unknown error',
                    },
                  });

                  // Wait before reconnecting
                  await new Promise((resolve) => setTimeout(resolve, delayMs));

                  // Reconnect with last event ID
                  await streamWithReconnect(lastEventId);
                } else {
                  hasCompleted = true;
                  this.logger.error(
                    `[SSE] Stream processing error for run_id ${runId}:`,
                    error,
                  );
                  // Log stream processing error to file
                  if (this.fileLogger) {
                    this.fileLogger
                      .logError(runId, {
                        message:
                          error instanceof Error
                            ? error.message
                            : 'Unknown error',
                        type: 'stream_processing_error',
                        stack: error instanceof Error ? error.stack : undefined,
                        eventCount,
                        lastEventId,
                        reconnectAttempts: reconnectAttempt,
                      })
                      .catch((err: Error) => {
                        this.logger.warn(
                          `[SSE] Failed to log error to file:`,
                          err,
                        );
                      });
                  }
                  reject(error);
                }
              }
            }
          };

          // Start processing the stream
          processStream();
        } catch (error) {
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
        }
      };

      // Start the initial stream
      streamWithReconnect();
    });
  }
}
