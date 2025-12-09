import { Injectable, Logger } from '@nestjs/common';
import { config } from 'dotenv';
import { FileLoggerService } from '../../../common/file-logger.service';
import {
  TimeoutConfigService,
  getTimeoutConfig,
} from '../../../common/timeout-config.service';

config();

@Injectable()
export class ParallelSseService {
  private readonly logger = new Logger(ParallelSseService.name);
  private readonly sseConfig: ReturnType<
    TimeoutConfigService['getSseStreamConfig']
  >;

  constructor(
    private readonly fileLogger?: FileLoggerService,
    private readonly timeoutConfig?: TimeoutConfigService,
  ) {
    // Use injected config if available, otherwise get singleton
    const configService = this.timeoutConfig || getTimeoutConfig();
    this.sseConfig = configService.getSseStreamConfig();
  }

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
    let currentReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let streamTimeoutId: NodeJS.Timeout | null = null;

    return new Promise((resolve, reject) => {
      // Set overall stream timeout (inside Promise to access reject)
      streamTimeoutId = setTimeout(() => {
        if (!hasCompleted) {
          hasCompleted = true;
          this.logger.error(
            `[SSE] Stream timeout after ${this.sseConfig.streamTimeoutMs}ms for run_id: ${runId}`,
          );
          // Close reader if still open
          if (currentReader) {
            try {
              currentReader.cancel();
              currentReader.releaseLock();
            } catch (err) {
              this.logger.warn(`[SSE] Error closing reader on timeout:`, err);
            }
            currentReader = null;
          }
          if (this.fileLogger) {
            this.fileLogger
              .logError(runId, {
                message: `Stream timeout after ${this.sseConfig.streamTimeoutMs}ms`,
                type: 'stream_timeout',
                eventCount,
              })
              .catch(() => {});
          }
          reject(
            new Error(
              `Stream timeout after ${this.sseConfig.streamTimeoutMs}ms`,
            ),
          );
        }
      }, this.sseConfig.streamTimeoutMs);
      const streamWithReconnect = async (
        lastEventIdParam: string | null = null,
        reconnectAttemptParam: number = 0,
      ) => {
        // Isolate reconnection variables per connection attempt
        const currentReconnectAttempt = reconnectAttemptParam;

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
          ? `[SSE] Reconnecting (attempt ${currentReconnectAttempt + 1}/${this.sseConfig.maxReconnectAttempts}) for run_id: ${runId} from event_id: ${lastEventId}`
          : `[SSE] Connecting to Parallel AI SSE endpoint for run_id: ${runId}`;

        this.logger.log(connectionLabel);
        this.logger.debug(`[SSE] URL: ${url}`);

        let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

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

          // Close previous reader if it exists
          if (currentReader) {
            try {
              currentReader.cancel();
              currentReader.releaseLock();
            } catch (err) {
              this.logger.warn(`[SSE] Error closing previous reader:`, err);
            }
          }

          reader = response.body.getReader();
          currentReader = reader; // Track current reader for cleanup

          const decoder = new TextDecoder();
          let buffer = '';
          let bufferSizeBytes = 0;
          const maxBufferSize = this.sseConfig.bufferMaxSizeBytes;
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

                  // Clean up: close reader and clear timeout
                  try {
                    if (currentReader) {
                      currentReader.cancel().catch(() => {});
                      currentReader.releaseLock();
                      currentReader = null;
                    }
                  } catch (closeError) {
                    this.logger.warn(
                      `[SSE] Error closing reader on completion:`,
                      closeError,
                    );
                  }

                  if (streamTimeoutId) {
                    clearTimeout(streamTimeoutId);
                    streamTimeoutId = null;
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

                  // Clean up: close reader and clear timeout
                  try {
                    if (currentReader) {
                      currentReader.cancel().catch(() => {});
                      currentReader.releaseLock();
                      currentReader = null;
                    }
                  } catch (closeError) {
                    this.logger.warn(
                      `[SSE] Error closing reader on failure:`,
                      closeError,
                    );
                  }

                  if (streamTimeoutId) {
                    clearTimeout(streamTimeoutId);
                    streamTimeoutId = null;
                  }

                  reject(new Error(errorMsg));
                }
              }
            }
          };

          const processStream = async () => {
            try {
              while (!hasCompleted) {
                if (!reader) {
                  throw new Error('Reader is null');
                }

                let readResult: ReadableStreamReadResult<Uint8Array>;
                try {
                  readResult = await reader.read();
                } catch (readError) {
                  // Reader error - try to recover
                  this.logger.warn(
                    `[SSE] Reader read error for run_id ${runId}:`,
                    readError,
                  );

                  // Try to close and release the reader
                  try {
                    if (reader) {
                      await reader.cancel();
                      reader.releaseLock();
                    }
                  } catch (closeError) {
                    this.logger.warn(
                      `[SSE] Error closing reader after read error:`,
                      closeError,
                    );
                  }

                  // Reconnect if task is still running
                  if (
                    lastKnownStatus === 'running' &&
                    currentReconnectAttempt <
                      this.sseConfig.maxReconnectAttempts
                  ) {
                    const nextAttempt = currentReconnectAttempt + 1;
                    reconnectAttempt = nextAttempt;
                    const delayMs = this.timeoutConfig
                      ? this.timeoutConfig.getSseReconnectDelay(nextAttempt)
                      : getTimeoutConfig().getSseReconnectDelay(nextAttempt);

                    this.logger.warn(
                      `[SSE] Reader error, reconnecting in ${delayMs}ms (attempt ${nextAttempt}/${this.sseConfig.maxReconnectAttempts})...`,
                    );

                    onEvent({
                      type: 'stream_reconnect',
                      data: {
                        message: `Reader error, reconnecting... (attempt ${nextAttempt}/${this.sseConfig.maxReconnectAttempts})`,
                        lastEventId,
                        reconnectAttempt: nextAttempt,
                        lastKnownStatus,
                        error:
                          readError instanceof Error
                            ? readError.message
                            : 'Reader read error',
                      },
                    });

                    await new Promise((resolve) =>
                      setTimeout(resolve, delayMs),
                    );
                    await streamWithReconnect(lastEventId, nextAttempt);
                    return;
                  } else {
                    throw readError;
                  }
                }

                const { done, value } = readResult;

                if (done) {
                  this.logger.log(
                    `[SSE] Stream reader done for run_id: ${runId} (events processed: ${eventCount})`,
                  );

                  // Properly close the reader
                  try {
                    if (reader) {
                      reader.releaseLock();
                      currentReader = null;
                    }
                  } catch (closeError) {
                    this.logger.warn(
                      `[SSE] Error releasing reader lock:`,
                      closeError,
                    );
                  }

                  // If stream ended and task is still running, reconnect
                  if (
                    !finalResult &&
                    !hasCompleted &&
                    lastKnownStatus === 'running'
                  ) {
                    const nextAttempt = currentReconnectAttempt + 1;
                    if (nextAttempt < this.sseConfig.maxReconnectAttempts) {
                      reconnectAttempt = nextAttempt;
                      const delayMs = this.timeoutConfig
                        ? this.timeoutConfig.getSseReconnectDelay(nextAttempt)
                        : getTimeoutConfig().getSseReconnectDelay(nextAttempt);

                      this.logger.warn(
                        `[SSE] Stream disconnected while task is still running. Reconnecting in ${delayMs}ms (attempt ${nextAttempt}/${this.sseConfig.maxReconnectAttempts})...`,
                      );

                      // Emit reconnection event
                      onEvent({
                        type: 'stream_reconnect',
                        data: {
                          message: `Stream disconnected, reconnecting... (attempt ${nextAttempt}/${this.sseConfig.maxReconnectAttempts})`,
                          lastEventId,
                          reconnectAttempt: nextAttempt,
                          lastKnownStatus,
                        },
                      });

                      // Wait before reconnecting
                      await new Promise((resolve) =>
                        setTimeout(resolve, delayMs),
                      );

                      // Reconnect with last event ID
                      await streamWithReconnect(lastEventId, nextAttempt);
                      return;
                    } else {
                      // Max reconnection attempts reached
                      const errorMessage = `Stream ended without final result after ${this.sseConfig.maxReconnectAttempts} reconnection attempts. Last known status: ${lastKnownStatus} (events processed: ${eventCount})`;
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
                            reconnectAttempts: nextAttempt,
                          })
                          .catch((err: Error) => {
                            this.logger.warn(
                              `[SSE] Failed to log error to file:`,
                              err,
                            );
                          });
                      }
                      if (streamTimeoutId) {
                        clearTimeout(streamTimeoutId);
                        streamTimeoutId = null;
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
                    if (streamTimeoutId) {
                      clearTimeout(streamTimeoutId);
                      streamTimeoutId = null;
                    }
                    reject(new Error(errorMessage));
                    return;
                  }
                  return;
                }

                // Decode new chunk and add to buffer
                const decodedChunk = decoder.decode(value, { stream: true });
                const chunkSizeBytes = new TextEncoder().encode(
                  decodedChunk,
                ).length;
                bufferSizeBytes += chunkSizeBytes;

                // Check buffer size limit to prevent unbounded growth
                if (bufferSizeBytes > maxBufferSize) {
                  const errorMessage = `SSE buffer exceeded maximum size of ${maxBufferSize} bytes (current: ${bufferSizeBytes} bytes). This may indicate a malformed stream or excessive data.`;
                  this.logger.error(
                    `[SSE] ${errorMessage} for run_id: ${runId}`,
                  );

                  // Try to close reader
                  try {
                    if (reader) {
                      await reader.cancel();
                      reader.releaseLock();
                      currentReader = null;
                    }
                  } catch (closeError) {
                    this.logger.warn(
                      `[SSE] Error closing reader after buffer overflow:`,
                      closeError,
                    );
                  }

                  if (this.fileLogger) {
                    this.fileLogger
                      .logError(runId, {
                        message: errorMessage,
                        type: 'buffer_overflow',
                        bufferSizeBytes,
                        maxBufferSize,
                        eventCount,
                      })
                      .catch(() => {});
                  }

                  if (streamTimeoutId) {
                    clearTimeout(streamTimeoutId);
                    streamTimeoutId = null;
                  }
                  reject(new Error(errorMessage));
                  return;
                }

                buffer += decodedChunk;

                // Parse complete SSE events (events are separated by double newlines)
                const eventBlocks = buffer.split('\n\n');
                const incompleteEvent = eventBlocks.pop() || '';
                buffer = incompleteEvent; // Keep incomplete event in buffer
                // Update buffer size after removing processed events
                bufferSizeBytes = new TextEncoder().encode(buffer).length;

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
              // Ensure reader is closed on error
              try {
                if (reader) {
                  await reader.cancel();
                  reader.releaseLock();
                  currentReader = null;
                }
              } catch (closeError) {
                this.logger.warn(
                  `[SSE] Error closing reader on stream error:`,
                  closeError,
                );
              }

              if (!hasCompleted) {
                // Connection error - try to reconnect if task is still running
                if (
                  lastKnownStatus === 'running' &&
                  currentReconnectAttempt < this.sseConfig.maxReconnectAttempts
                ) {
                  const nextAttempt = currentReconnectAttempt + 1;
                  reconnectAttempt = nextAttempt;
                  const delayMs = this.timeoutConfig
                    ? this.timeoutConfig.getSseReconnectDelay(nextAttempt)
                    : getTimeoutConfig().getSseReconnectDelay(nextAttempt);

                  this.logger.warn(
                    `[SSE] Stream processing error for run_id ${runId}. Reconnecting in ${delayMs}ms (attempt ${nextAttempt}/${this.sseConfig.maxReconnectAttempts})...`,
                    error,
                  );

                  // Emit reconnection event
                  onEvent({
                    type: 'stream_reconnect',
                    data: {
                      message: `Stream error occurred, reconnecting... (attempt ${nextAttempt}/${this.sseConfig.maxReconnectAttempts})`,
                      lastEventId,
                      reconnectAttempt: nextAttempt,
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
                  await streamWithReconnect(lastEventId, nextAttempt);
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
                        reconnectAttempts: currentReconnectAttempt,
                      })
                      .catch((err: Error) => {
                        this.logger.warn(
                          `[SSE] Failed to log error to file:`,
                          err,
                        );
                      });
                  }
                  if (streamTimeoutId) {
                    clearTimeout(streamTimeoutId);
                    streamTimeoutId = null;
                  }
                  reject(error);
                }
              }
            }
          };

          // Start processing the stream
          processStream().catch((streamError) => {
            // Additional error handling for processStream promise rejection
            if (!hasCompleted) {
              this.logger.error(
                `[SSE] Unhandled error in processStream for run_id ${runId}:`,
                streamError,
              );

              // Ensure reader is closed
              try {
                if (reader) {
                  reader.cancel().catch(() => {});
                  reader.releaseLock();
                  currentReader = null;
                }
              } catch (closeError) {
                this.logger.warn(
                  `[SSE] Error closing reader in catch:`,
                  closeError,
                );
              }

              // Try to reconnect if possible
              if (
                lastKnownStatus === 'running' &&
                currentReconnectAttempt < this.sseConfig.maxReconnectAttempts
              ) {
                const nextAttempt = currentReconnectAttempt + 1;
                reconnectAttempt = nextAttempt;
                const delayMs = this.timeoutConfig
                  ? this.timeoutConfig.getSseReconnectDelay(nextAttempt)
                  : getTimeoutConfig().getSseReconnectDelay(nextAttempt);

                this.logger.warn(
                  `[SSE] Unhandled stream error, attempting recovery reconnect in ${delayMs}ms (attempt ${nextAttempt}/${this.sseConfig.maxReconnectAttempts})...`,
                );

                onEvent({
                  type: 'stream_reconnect',
                  data: {
                    message: `Unhandled stream error, attempting recovery... (attempt ${nextAttempt}/${this.sseConfig.maxReconnectAttempts})`,
                    lastEventId,
                    reconnectAttempt: nextAttempt,
                    lastKnownStatus,
                    error:
                      streamError instanceof Error
                        ? streamError.message
                        : 'Unknown stream error',
                  },
                });

                setTimeout(() => {
                  streamWithReconnect(lastEventId, nextAttempt).catch(
                    (reconnectError) => {
                      hasCompleted = true;
                      if (streamTimeoutId) {
                        clearTimeout(streamTimeoutId);
                        streamTimeoutId = null;
                      }
                      reject(reconnectError);
                    },
                  );
                }, delayMs);
              } else {
                hasCompleted = true;
                if (streamTimeoutId) {
                  clearTimeout(streamTimeoutId);
                  streamTimeoutId = null;
                }
                reject(streamError);
              }
            }
          });
        } catch (error) {
          // Ensure reader is closed on fetch error
          try {
            if (reader) {
              reader.cancel().catch(() => {});
              reader.releaseLock();
              currentReader = null;
            }
          } catch (closeError) {
            this.logger.warn(
              `[SSE] Error closing reader on fetch error:`,
              closeError,
            );
          }

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
            if (streamTimeoutId) {
              clearTimeout(streamTimeoutId);
              streamTimeoutId = null;
            }
            reject(error);
          }
        }
      };

      // Start the initial stream
      streamWithReconnect(null, 0);
    });
  }
}
