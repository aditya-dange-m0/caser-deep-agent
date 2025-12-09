/**
 * Helper class for emitting streaming events to observers
 */
import { Logger } from '@nestjs/common';
import { MessageEvent } from '@nestjs/common';
import type { StreamingObserver, TaskStreamConfig } from './types';
import { sanitizeErrorMessage } from './errors';

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
   * Emit an error event (sanitized for client safety)
   */
  emitError(error: string | Error): void {
    // Sanitize error message to prevent leaking sensitive information
    const sanitizedMessage = sanitizeErrorMessage(error);
    this.emitEvent('error', {
      error: sanitizedMessage,
    });
    this.logger.debug(
      `[${this.serviceName}] Error event emitted: ${sanitizedMessage}`,
    );
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
   * Error the stream (with sanitized error)
   */
  error(error: Error): void {
    if (this.observer) {
      // Create a safe error without sensitive information
      const safeError = new Error(sanitizeErrorMessage(error));
      safeError.name = error.name; // Keep error type for debugging
      this.observer.error(safeError);
      this.logger.error(`[${this.serviceName}] Stream errored:`, error);
    }
  }
}
