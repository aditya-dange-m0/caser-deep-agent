/**
 * Shared constants for Parallel AI integration
 */
export const PARALLEL_API_ENDPOINTS = {
  TASK_RUNS: 'https://api.parallel.ai/v1/tasks/runs',
  TASK_RUN_EVENTS: (runId: string) =>
    `https://api.parallel.ai/v1beta/tasks/runs/${runId}/events`,
  FINDALL_BASE: 'https://api.parallel.ai/v1beta/findall',
} as const;

export const PARALLEL_BETA_HEADERS = {
  EVENTS_SSE: 'events-sse-2025-07-24',
  FINDALL: 'findall-2025-09-15',
} as const;

export const STREAMING_CONFIG = {
  DEFAULT_TIMEOUT_MS: 18000000, // 5 hours - covers ultra processors that can take up to 4.8 hours
  ULTRA_PROCESSOR_TIMEOUT_MS: 18000000, // 5 hours for ultra/ultra2x/ultra4x/ultra8x
  STANDARD_PROCESSOR_TIMEOUT_MS: 3600000, // 1 hour for base/core/pro processors
  POLLING_INTERVAL_MS: 2000, // 2 seconds for FindAll
  MAX_FINDALL_WAIT_SECONDS: 900, // 15 minutes
} as const;

