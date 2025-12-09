# Timeout Configuration Guide

## Overview

All timeout values in the application are now managed through the `TimeoutConfigService`, which provides a centralized, configurable approach to timeout management. This replaces all hardcoded timeout values with environment-variable-configurable settings.

## Configuration Service

The `TimeoutConfigService` is a NestJS injectable service that provides:

- **Task Polling Configuration**: For Parallel AI task result polling
- **FindAll Polling Configuration**: For FindAll API status polling
- **FindAll Wait Configuration**: For FindAll completion waiting
- **Processor-Specific Timeouts**: Different timeouts for standard vs ultra processors
- **SSE Streaming Configuration**: For Server-Sent Events streaming

## Environment Variables

All timeout values can be overridden via environment variables:

### Task Polling
- `TASK_POLLING_MAX_ATTEMPTS` (default: 144) - Maximum polling attempts
- `TASK_POLLING_TIMEOUT_PER_ATTEMPT_SECONDS` (default: 25) - Timeout per attempt in seconds
- `TASK_POLLING_INTERVAL_MS` (default: 1000) - Interval between attempts in milliseconds

### FindAll Polling
- `FINDALL_POLLING_MAX_ATTEMPTS` (default: 900) - Maximum polling attempts (15 minutes)
- `FINDALL_POLLING_INTERVAL_MS` (default: 1000) - Interval between attempts in milliseconds

### FindAll Wait
- `FINDALL_DEFAULT_WAIT_SECONDS` (default: 300) - Default wait time (5 minutes)
- `FINDALL_MAX_WAIT_SECONDS` (default: 900) - Maximum wait time (15 minutes)

### Processor-Specific
- `STANDARD_PROCESSOR_MAX_ATTEMPTS` (default: 144) - For base/core/pro processors
- `STANDARD_PROCESSOR_TIMEOUT_PER_ATTEMPT_SECONDS` (default: 25)
- `ULTRA_PROCESSOR_MAX_ATTEMPTS` (default: 18000) - For ultra/ultra2x/ultra4x/ultra8x (5 hours)
- `ULTRA_PROCESSOR_TIMEOUT_PER_ATTEMPT_SECONDS` (default: 25)

### SSE Streaming
- `SSE_STREAM_TIMEOUT_MS` (default: 18000000) - 5 hours
- `SSE_RECONNECT_BASE_DELAY_MS` (default: 1000) - Base delay for exponential backoff

## Usage

### In NestJS Services (Dependency Injection)

```typescript
import { TimeoutConfigService } from '../common/timeout-config.service';

@Injectable()
export class MyService {
  constructor(private readonly timeoutConfig: TimeoutConfigService) {}

  async doSomething() {
    const config = this.timeoutConfig.getTaskPollingConfig();
    // Use config.maxAttempts, config.timeoutPerAttempt, config.intervalMs
  }
}
```

### In Tools (Non-NestJS Context)

```typescript
import { getTimeoutConfig } from '../common/timeout-config.service';

const timeoutConfig = getTimeoutConfig();
const config = timeoutConfig.getTaskPollingConfigForProcessor('ultra');
// Use config values
```

## Default Values

| Configuration | Default | Description |
|--------------|---------|-------------|
| Task Polling Max Attempts | 144 | ~1 hour (144 * 1 second) |
| Task Polling Timeout | 25s | Per attempt timeout |
| Task Polling Interval | 1000ms | Between attempts |
| FindAll Polling Max Attempts | 900 | 15 minutes (900 * 1 second) |
| FindAll Polling Interval | 1000ms | Between attempts |
| FindAll Default Wait | 300s | 5 minutes |
| FindAll Max Wait | 900s | 15 minutes |
| Standard Processor Max Attempts | 144 | ~1 hour |
| Ultra Processor Max Attempts | 18000 | 5 hours |

## Benefits

1. **Centralized Configuration**: All timeouts in one place
2. **Environment-Based**: Easy to adjust for different environments
3. **Processor-Aware**: Automatically uses appropriate timeouts for different processors
4. **Type-Safe**: Full TypeScript support
5. **Maintainable**: Easy to update defaults without code changes

## Migration Notes

All hardcoded timeout values have been replaced:
- ✅ `pollTaskResult` now uses configurable timeouts
- ✅ `pollFindAllStatus` now uses configurable timeouts
- ✅ All tool default values now come from config
- ✅ Service layer uses injected TimeoutConfigService

