import { Injectable, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { config } from 'dotenv';

config();

@Injectable()
export class FindAllStreamingService {
  private readonly logger = new Logger(FindAllStreamingService.name);

  private readonly PARALLEL_API_KEY = process.env.PARALLEL_API_KEY;
  private readonly PARALLEL_BETA_HEADER = 'findall-2025-09-15';
  private readonly PARALLEL_API_BASE = 'https://api.parallel.ai/v1beta/findall';

  /**
   * Helper function to make API requests to FindAll API
   */
  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any,
  ): Promise<any> {
    if (!this.PARALLEL_API_KEY) {
      throw new Error(
        'PARALLEL_API_KEY environment variable is not set. Please configure it in your .env file.',
      );
    }

    const url = `${this.PARALLEL_API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      'x-api-key': this.PARALLEL_API_KEY,
      'parallel-beta': this.PARALLEL_BETA_HEADER,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `FindAll API request failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return await response.json();
  }

  /**
   * Stream FindAll run progress with Observable pattern (for NestJS SSE)
   * Uses polling to check status and stream updates
   *
   * @param findallId - The FindAll run ID
   * @param maxWaitSeconds - Maximum time to wait for completion
   * @returns Observable that emits MessageEvent objects
   */
  streamRunObservable(
    findallId: string,
    maxWaitSeconds: number = 900,
  ): Observable<MessageEvent> {
    this.logger.log(
      `[Streaming] Starting FindAll stream - findall_id: ${findallId}, MaxWait: ${maxWaitSeconds}s`,
    );

    return new Observable((observer) => {
      this.streamRun(findallId, maxWaitSeconds, observer).catch((error) => {
        this.logger.error(`[Streaming] Error in streamRunObservable:`, error);
        observer.error(error);
      });
    });
  }

  /**
   * Create FindAll run and stream status updates via polling
   *
   * @param objective - Natural language query
   * @param generator - Generator type (base, core, or pro)
   * @param matchLimit - Maximum number of matches
   * @param entityType - Entity type (optional)
   * @param matchConditions - Match conditions (optional)
   * @param enrichments - Enrichments (optional)
   * @param maxWaitSeconds - Maximum time to wait
   * @param observer - RxJS observer for emitting events
   * @returns Promise that resolves when streaming is complete
   */
  async streamComplete(
    objective: string,
    generator: string = 'core',
    matchLimit: number = 10,
    entityType?: string,
    matchConditions?: Array<{ name: string; description: string }>,
    enrichments?: string[],
    maxWaitSeconds: number = 900,
    observer?: any,
  ): Promise<void> {
    this.logger.log(
      `[Streaming] Starting FindAll complete workflow - Objective: "${objective.substring(0, 100)}${objective.length > 100 ? '...' : ''}", Generator: ${generator}`,
    );

    try {
      // Step 1: Create the run
      let finalEntityType = entityType;
      let finalMatchConditions = matchConditions;

      if (!finalEntityType || !finalMatchConditions || finalMatchConditions.length === 0) {
        this.logger.debug(
          '[Streaming] Entity type or match conditions missing, calling ingest first',
        );
        if (observer) {
          observer.next({
            data: JSON.stringify({
              type: 'ingest',
              data: {
                message: 'Extracting schema from objective...',
                objective,
              },
            }),
          } as MessageEvent);
        }

        try {
          const ingestResult = await this.makeRequest('/ingest', 'POST', { objective });
          finalEntityType = finalEntityType || ingestResult.entity_type;
          finalMatchConditions =
            finalMatchConditions || ingestResult.match_conditions || [];

          this.logger.debug('[Streaming] Ingest completed', {
            entity_type: finalEntityType,
            match_conditions_count: finalMatchConditions?.length || 0,
          });

          if (observer) {
            observer.next({
              data: JSON.stringify({
                type: 'ingest_complete',
                data: {
                  message: 'Schema extracted successfully',
                  entity_type: finalEntityType,
                  match_conditions: finalMatchConditions,
                },
              }),
            } as MessageEvent);
          }
        } catch (ingestError) {
          this.logger.warn('[Streaming] Ingest failed, proceeding with provided values', ingestError);
        }
      }

      // Step 2: Create the run
      const requestBody: any = {
        objective,
        generator,
        match_limit: matchLimit,
      };

      if (finalEntityType) {
        requestBody.entity_type = finalEntityType;
      }

      if (finalMatchConditions && finalMatchConditions.length > 0) {
        requestBody.match_conditions = finalMatchConditions;
      }

      if (enrichments && enrichments.length > 0) {
        requestBody.enrichments = enrichments;
      }

      this.logger.log('[Streaming] Creating FindAll run');

      if (observer) {
        observer.next({
          data: JSON.stringify({
            type: 'run_creating',
            data: {
              message: 'Creating FindAll run...',
              objective,
              generator,
            },
          }),
        } as MessageEvent);
      }

      const createResult = await this.makeRequest('/runs', 'POST', requestBody);

      if (!createResult.findall_id) {
        throw new Error('Failed to create FindAll run: No findall_id returned');
      }

      const findallId = createResult.findall_id;
      this.logger.log(`[Streaming] FindAll run created - findall_id: ${findallId}`);

      if (observer) {
        observer.next({
          data: JSON.stringify({
            type: 'run_created',
            data: {
              message: 'FindAll run created successfully',
              findall_id: findallId,
            },
          }),
        } as MessageEvent);
      }

      // Step 3: Stream status updates
      await this.streamRun(findallId, maxWaitSeconds, observer);

      this.logger.log(`[Streaming] FindAll complete workflow finished - findall_id: ${findallId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Streaming] Error during FindAll complete workflow:`, error);

      if (observer) {
        observer.next({
          data: JSON.stringify({
            type: 'error',
            data: {
              error: errorMessage,
            },
          }),
        } as MessageEvent);
        observer.error(error);
      } else {
        throw error;
      }
    }
  }

  /**
   * Stream FindAll run status updates via polling
   *
   * @param findallId - The FindAll run ID
   * @param maxWaitSeconds - Maximum time to wait
   * @param observer - RxJS observer for emitting events
   * @returns Promise that resolves when streaming is complete
   */
  async streamRun(
    findallId: string,
    maxWaitSeconds: number = 900,
    observer?: any,
  ): Promise<void> {
    this.logger.log(
      `[Streaming] Starting to stream status for findall_id: ${findallId}, MaxWait: ${maxWaitSeconds}s`,
    );

    const startTime = Date.now();
    const maxWaitMs = maxWaitSeconds * 1000;
    const pollInterval = 2000; // Poll every 2 seconds
    let lastStatus: string | null = null;
    let pollCount = 0;

    if (observer) {
      observer.next({
        data: JSON.stringify({
          type: 'connected',
          data: {
            message: 'Connected, streaming FindAll run status...',
            findall_id: findallId,
          },
        }),
      } as MessageEvent);
    }

    try {
      while (Date.now() - startTime < maxWaitMs) {
        pollCount++;
        this.logger.debug(`[Streaming] Polling attempt #${pollCount} for findall_id: ${findallId}`);

        try {
          const status = await this.makeRequest(`/runs/${findallId}`);

          const currentStatus = status.status?.status || 'unknown';
          const isActive = status.status?.is_active !== false;

          // Only emit status if it changed
          if (currentStatus !== lastStatus) {
            lastStatus = currentStatus;
            this.logger.debug(
              `[Streaming] Status changed to: ${currentStatus} (is_active: ${isActive})`,
            );

            if (observer) {
              observer.next({
                data: JSON.stringify({
                  type: 'status_update',
                  data: {
                    findall_id: findallId,
                    status: status.status,
                    metrics: status.status?.metrics,
                  },
                }),
              } as MessageEvent);
            }
          } else {
            // Still emit periodic updates even if status hasn't changed (for metrics updates)
            if (pollCount % 5 === 0 && observer) {
              observer.next({
                data: JSON.stringify({
                  type: 'status_update',
                  data: {
                    findall_id: findallId,
                    status: status.status,
                    metrics: status.status?.metrics,
                  },
                }),
              } as MessageEvent);
            }
          }

          // Check if completed
          const isCompleted =
            currentStatus === 'completed' ||
            currentStatus === 'failed' ||
            !isActive;

          if (isCompleted) {
            this.logger.log(
              `[Streaming] FindAll run completed - findall_id: ${findallId}, Status: ${currentStatus}`,
            );

            // Fetch final results
            try {
              const results = await this.makeRequest(`/runs/${findallId}/result`);
              if (observer) {
                observer.next({
                  data: JSON.stringify({
                    type: 'complete',
                    data: {
                      message: 'FindAll run completed successfully',
                      findall_id: findallId,
                      results: results,
                    },
                  }),
                } as MessageEvent);
                observer.complete();
              }
              this.logger.log(
                `[Streaming] Stream completed successfully for findall_id: ${findallId}`,
              );
            } catch (resultError) {
              this.logger.warn(
                `[Streaming] Failed to fetch results, but run is complete:`,
                resultError,
              );
              if (observer) {
                observer.next({
                  data: JSON.stringify({
                    type: 'complete',
                    data: {
                      message: 'FindAll run completed',
                      findall_id: findallId,
                      status: status.status,
                    },
                  }),
                } as MessageEvent);
                observer.complete();
              }
            }
            return;
          }

          // Wait before next poll
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
        } catch (pollError) {
          this.logger.error(`[Streaming] Polling error on attempt #${pollCount}:`, pollError);
          // Continue polling on error (might be transient)
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
        }
      }

      // Timeout reached
      this.logger.warn(
        `[Streaming] Polling timeout reached for findall_id: ${findallId} (${maxWaitSeconds}s)`,
      );
      if (observer) {
        observer.next({
          data: JSON.stringify({
            type: 'timeout',
            data: {
              message: `Polling timeout after ${maxWaitSeconds} seconds`,
              findall_id: findallId,
            },
          }),
        } as MessageEvent);
        observer.complete();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Streaming] Error during streaming for findall_id ${findallId}:`, error);

      if (observer) {
        observer.next({
          data: JSON.stringify({
            type: 'error',
            data: {
              error: errorMessage,
            },
          }),
        } as MessageEvent);
        observer.error(error);
      } else {
        throw error;
      }
    }
  }
}

