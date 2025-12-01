/**
 * Helper class for emitting streaming events to observers
 */
import { Logger } from '@nestjs/common';
import { MessageEvent } from '@nestjs/common';
import type { StreamingObserver, TaskStreamConfig } from './types';

export class StreamEventEmitter {
  constructor(
    private readonly logger: Logger,
    private readonly observer?: StreamingObserver,
    private readonly serviceName?: string,
  ) {}

  /**
   * Check if observer is available
   */
  hasObserver(): boolean {
    return !!this.observer;
  }

  /**
   * Get the observer (for internal use)
   */
  getObserver(): StreamingObserver | undefined {
    return this.observer;
  }

  /**
   * Emit a generic event
   */
  emitEvent(type: string, data: unknown): void {
    if (!this.observer) {
      return;
    }

    this.logger.debug(`[${this.serviceName}] Emitting event: ${type}`);
    this.observer.next({
      data: JSON.stringify({
        type,
        data,
      }),
    } as MessageEvent);
  }

  /**
   * Emit a connection event
   */
  emitConnected(
    message: string,
    config: TaskStreamConfig & { [key: string]: unknown },
  ): void {
    this.emitEvent('connected', {
      message,
      ...config,
    });
    this.logger.debug(
      `[${this.serviceName}] Connection event emitted - Query: "${config.query?.substring(0, 50) || 'N/A'}..."`,
    );
  }

  /**
   * Emit a completion event
   */
  emitComplete(message: string): void {
    this.emitEvent('complete', {
      message,
    });
    this.logger.debug(`[${this.serviceName}] Completion event emitted`);
  }

  /**
   * Emit an error event
   */
  emitError(error: string | Error): void {
    const errorMessage = error instanceof Error ? error.message : error;
    this.emitEvent('error', {
      error: errorMessage,
    });
    this.logger.debug(`[${this.serviceName}] Error event emitted: ${errorMessage}`);
  }

  /**
   * Complete the stream
   */
  complete(): void {
    if (this.observer) {
      this.observer.complete();
      this.logger.debug(`[${this.serviceName}] Stream completed`);
    }
  }

  /**
   * Error the stream
   */
  error(error: Error): void {
    if (this.observer) {
      this.observer.error(error);
      this.logger.error(`[${this.serviceName}] Stream errored:`, error);
    }
  }
}

