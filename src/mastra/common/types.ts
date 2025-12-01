/**
 * Shared types and interfaces for Parallel AI integration
 */
import { MessageEvent } from '@nestjs/common';

export interface ParallelTaskCreateRequest {
  input: string;
  processor: string;
  enable_events?: boolean;
}

export interface ParallelTaskCreateResponse {
  run_id: string;
}

export interface ParallelEvent {
  type: string;
  data: unknown;
}

export interface StreamingObserver {
  next: (event: MessageEvent) => void;
  error: (error: Error) => void;
  complete: () => void;
}

export interface TaskStreamConfig {
  query: string;
  processor: string;
  includeAnalysis?: boolean;
  [key: string]: unknown;
}

export interface FindAllStreamConfig {
  objective: string;
  generator: string;
  matchLimit?: number;
  entityType?: string;
  matchConditions?: Array<{ name: string; description: string }>;
  enrichments?: string[];
  maxWaitSeconds?: number;
}

export interface EventEmitter {
  emitEvent(type: string, data: unknown): void;
  emitConnected(config: TaskStreamConfig | FindAllStreamConfig): void;
  emitComplete(message: string): void;
  emitError(error: string | Error): void;
}

