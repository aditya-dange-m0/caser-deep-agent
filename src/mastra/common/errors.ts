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

/**
 * Error sanitization utilities to prevent leaking sensitive information
 * to clients (API keys, stack traces, internal URLs, etc.)
 */

/**
 * Sanitizes an error message by removing sensitive information
 * @param error - Error object or error message string
 * @returns Sanitized error message safe for client exposure
 */
export function sanitizeErrorMessage(error: unknown): string {
  let errorMessage: string;

  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else {
    return 'An internal error occurred. Please try again later.';
  }

  // Remove API keys (common patterns)
  errorMessage = errorMessage.replace(
    /x-api-key['":\s]*[=:]\s*['"]?[a-zA-Z0-9_-]+['"]?/gi,
    '[API_KEY_REDACTED]',
  );
  errorMessage = errorMessage.replace(
    /api[_-]?key['":\s]*[=:]\s*['"]?[a-zA-Z0-9_-]+['"]?/gi,
    '[API_KEY_REDACTED]',
  );
  errorMessage = errorMessage.replace(
    /PARALLEL_API_KEY['":\s]*[=:]\s*['"]?[a-zA-Z0-9_-]+['"]?/gi,
    '[API_KEY_REDACTED]',
  );

  // Remove internal API URLs
  errorMessage = errorMessage.replace(
    /https?:\/\/api\.parallel\.ai\/[^\s\)]+/gi,
    '[INTERNAL_API_URL]',
  );
  errorMessage = errorMessage.replace(
    /https?:\/\/[^\s\)]*parallel[^\s\)]*\/[^\s\)]+/gi,
    '[INTERNAL_API_URL]',
  );

  // Remove stack traces (lines starting with "at" or file paths)
  errorMessage = errorMessage.replace(/\s+at\s+.*/g, '');
  errorMessage = errorMessage.replace(/\([^)]*:\d+:\d+\)/g, '');
  errorMessage = errorMessage.replace(/\[.*node_modules.*\]/g, '');

  // Remove file system paths
  errorMessage = errorMessage.replace(/[A-Z]:\\[^\s\)]+/gi, '[FILE_PATH]');
  errorMessage = errorMessage.replace(/\/[^\s\)]+/g, (match) => {
    // Keep simple paths like /api/endpoint but remove file paths
    if (match.includes('.') && !match.startsWith('/api')) {
      return '[FILE_PATH]';
    }
    return match;
  });

  // Remove environment variable names that might contain sensitive data
  errorMessage = errorMessage.replace(/process\.env\.[A-Z_]+/g, '[ENV_VAR]');

  // Remove potential tokens and secrets (long alphanumeric strings)
  errorMessage = errorMessage.replace(/\b[a-zA-Z0-9_-]{32,}\b/g, (match) => {
    // Keep common non-sensitive patterns
    if (
      match.includes('run_id') ||
      match.includes('event_id') ||
      match.length < 40
    ) {
      return match;
    }
    return '[TOKEN_REDACTED]';
  });

  // If message is empty or only contains redacted info, return generic message
  const cleaned = errorMessage.trim();
  if (!cleaned || cleaned.length < 10) {
    return 'An internal error occurred. Please try again later.';
  }

  return cleaned;
}

/**
 * Creates a safe error object for client exposure
 * @param error - Original error
 * @param fallbackMessage - Fallback message if sanitization removes everything
 * @returns Error with sanitized message
 */
export function createSafeError(
  error: unknown,
  fallbackMessage: string = 'An internal error occurred. Please try again later.',
): Error {
  const sanitizedMessage = sanitizeErrorMessage(error);
  const safeMessage =
    sanitizedMessage && sanitizedMessage.length > 0
      ? sanitizedMessage
      : fallbackMessage;

  return new Error(safeMessage);
}

/**
 * Sanitizes error data for logging (keeps more details but still removes sensitive info)
 * @param error - Error object
 * @returns Sanitized error object safe for logging
 */
export function sanitizeErrorForLogging(error: unknown): {
  message: string;
  name?: string;
  stack?: string;
} {
  const sanitized: {
    message: string;
    name?: string;
    stack?: string;
  } = {
    message: sanitizeErrorMessage(error),
  };

  if (error instanceof Error) {
    sanitized.name = error.name;

    // Keep stack trace for logging but sanitize it
    if (error.stack) {
      let stack = error.stack;
      // Remove file paths from stack
      stack = stack.replace(/[A-Z]:\\[^\s\)]+/gi, '[FILE_PATH]');
      stack = stack.replace(
        /\/[^\s\)]*node_modules[^\s\)]*/g,
        '[NODE_MODULES]',
      );
      // Remove API keys from stack
      stack = stack.replace(
        /x-api-key['":\s]*[=:]\s*['"]?[a-zA-Z0-9_-]+['"]?/gi,
        '[API_KEY_REDACTED]',
      );
      sanitized.stack = stack;
    }
  }

  return sanitized;
}

