/**
 * Custom error classes for better error handling
 */
export class ParallelApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = 'ParallelApiError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class TaskCreationError extends ParallelApiError {
  constructor(message: string, statusCode?: number, originalError?: Error) {
    super(message, statusCode, originalError);
    this.name = 'TaskCreationError';
  }
}

export class StreamingError extends ParallelApiError {
  constructor(message: string, originalError?: Error) {
    super(message, undefined, originalError);
    this.name = 'StreamingError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
    Error.captureStackTrace(this, this.constructor);
  }
}

