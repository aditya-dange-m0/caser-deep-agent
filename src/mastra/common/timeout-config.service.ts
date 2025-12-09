import { Injectable } from '@nestjs/common';
import { config } from 'dotenv';

config();

/**
 * Timeout configuration service for managing all timeout values across the application.
 * Supports environment variable overrides for all configurations.
 */
@Injectable()
export class TimeoutConfigService {
  // Task polling configuration
  private readonly taskPollingMaxAttempts: number;
  private readonly taskPollingTimeoutPerAttempt: number; // seconds
  private readonly taskPollingIntervalMs: number;

  // FindAll polling configuration
  private readonly findAllPollingMaxAttempts: number;
  private readonly findAllPollingIntervalMs: number;

  // FindAll wait configuration
  private readonly findAllDefaultWaitSeconds: number;
  private readonly findAllMaxWaitSeconds: number;

  // Processor-specific timeout configurations
  private readonly processorTimeouts: {
    standard: { maxAttempts: number; timeoutPerAttempt: number };
    ultra: { maxAttempts: number; timeoutPerAttempt: number };
  };

  // SSE streaming configuration
  private readonly sseStreamTimeoutMs: number;
  private readonly sseReconnectBaseDelayMs: number;

  constructor() {
    // Task polling defaults: 144 attempts * 1 second = ~1 hour max
    this.taskPollingMaxAttempts = this.getEnvNumber(
      'TASK_POLLING_MAX_ATTEMPTS',
      144,
    );
    this.taskPollingTimeoutPerAttempt = this.getEnvNumber(
      'TASK_POLLING_TIMEOUT_PER_ATTEMPT_SECONDS',
      25,
    );
    this.taskPollingIntervalMs = this.getEnvNumber(
      'TASK_POLLING_INTERVAL_MS',
      1000,
    );

    // FindAll polling defaults: 900 attempts * 1 second = 15 minutes max
    this.findAllPollingMaxAttempts = this.getEnvNumber(
      'FINDALL_POLLING_MAX_ATTEMPTS',
      900,
    );
    this.findAllPollingIntervalMs = this.getEnvNumber(
      'FINDALL_POLLING_INTERVAL_MS',
      1000,
    );

    // FindAll wait configuration
    this.findAllDefaultWaitSeconds = this.getEnvNumber(
      'FINDALL_DEFAULT_WAIT_SECONDS',
      300, // 5 minutes default
    );
    this.findAllMaxWaitSeconds = this.getEnvNumber(
      'FINDALL_MAX_WAIT_SECONDS',
      900, // 15 minutes max
    );

    // Processor-specific timeouts
    // Standard processors (base, core, pro): 1 hour max
    const standardMaxAttempts = this.getEnvNumber(
      'STANDARD_PROCESSOR_MAX_ATTEMPTS',
      144,
    );
    const standardTimeoutPerAttempt = this.getEnvNumber(
      'STANDARD_PROCESSOR_TIMEOUT_PER_ATTEMPT_SECONDS',
      25,
    );

    // Ultra processors (ultra, ultra2x, ultra4x, ultra8x): 5 hours max
    // Ultra processors can take up to 4.8 hours, so we use 5 hours as max
    const ultraMaxAttempts = this.getEnvNumber(
      'ULTRA_PROCESSOR_MAX_ATTEMPTS',
      18000, // 18000 attempts * 1 second = 5 hours
    );
    const ultraTimeoutPerAttempt = this.getEnvNumber(
      'ULTRA_PROCESSOR_TIMEOUT_PER_ATTEMPT_SECONDS',
      25,
    );

    this.processorTimeouts = {
      standard: {
        maxAttempts: standardMaxAttempts,
        timeoutPerAttempt: standardTimeoutPerAttempt,
      },
      ultra: {
        maxAttempts: ultraMaxAttempts,
        timeoutPerAttempt: ultraTimeoutPerAttempt,
      },
    };

    // SSE streaming configuration
    this.sseStreamTimeoutMs = this.getEnvNumber(
      'SSE_STREAM_TIMEOUT_MS',
      18000000, // 5 hours
    );
    this.sseReconnectBaseDelayMs = this.getEnvNumber(
      'SSE_RECONNECT_BASE_DELAY_MS',
      1000,
    );
  }

  /**
   * Get timeout configuration for task polling
   */
  getTaskPollingConfig() {
    return {
      maxAttempts: this.taskPollingMaxAttempts,
      timeoutPerAttempt: this.taskPollingTimeoutPerAttempt,
      intervalMs: this.taskPollingIntervalMs,
    };
  }

  /**
   * Get timeout configuration for FindAll polling
   */
  getFindAllPollingConfig() {
    return {
      maxAttempts: this.findAllPollingMaxAttempts,
      intervalMs: this.findAllPollingIntervalMs,
    };
  }

  /**
   * Get FindAll wait configuration
   */
  getFindAllWaitConfig() {
    return {
      defaultWaitSeconds: this.findAllDefaultWaitSeconds,
      maxWaitSeconds: this.findAllMaxWaitSeconds,
    };
  }

  /**
   * Get timeout configuration for a specific processor type
   */
  getProcessorTimeout(processor: string) {
    const isUltraProcessor = [
      'ultra',
      'ultra2x',
      'ultra4x',
      'ultra8x',
    ].includes(processor.toLowerCase());

    return isUltraProcessor
      ? this.processorTimeouts.ultra
      : this.processorTimeouts.standard;
  }

  /**
   * Get timeout configuration for task polling with processor-specific settings
   */
  getTaskPollingConfigForProcessor(processor: string) {
    const processorTimeout = this.getProcessorTimeout(processor);
    return {
      maxAttempts: processorTimeout.maxAttempts,
      timeoutPerAttempt: processorTimeout.timeoutPerAttempt,
      intervalMs: this.taskPollingIntervalMs,
    };
  }

  /**
   * Get SSE streaming timeout configuration
   */
  getSseStreamTimeout() {
    return this.sseStreamTimeoutMs;
  }

  /**
   * Get SSE reconnect delay configuration
   */
  getSseReconnectDelay(attempt: number): number {
    // Exponential backoff: baseDelay * 2^(attempt - 1)
    return this.sseReconnectBaseDelayMs * Math.pow(2, attempt - 1);
  }

  /**
   * Calculate max attempts from wait seconds for FindAll
   */
  calculateFindAllMaxAttempts(waitSeconds: number): number {
    const maxWait = Math.min(waitSeconds, this.findAllMaxWaitSeconds);
    return Math.floor(maxWait);
  }

  /**
   * Helper to get environment variable as number with default
   */
  private getEnvNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (!value) return defaultValue;

    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      console.warn(
        `Invalid value for ${key}: "${value}". Using default: ${defaultValue}`,
      );
      return defaultValue;
    }

    return parsed;
  }
}

/**
 * Singleton instance for use in non-NestJS contexts (e.g., tools)
 * This allows tools to access timeout configuration without dependency injection
 */
let timeoutConfigInstance: TimeoutConfigService | null = null;

/**
 * Get the singleton timeout config instance
 */
export function getTimeoutConfig(): TimeoutConfigService {
  if (!timeoutConfigInstance) {
    timeoutConfigInstance = new TimeoutConfigService();
  }
  return timeoutConfigInstance;
}
