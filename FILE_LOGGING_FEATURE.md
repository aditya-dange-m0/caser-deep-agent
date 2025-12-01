# File Logging Feature Documentation

## Overview
All Parallel AI agent runs now automatically create detailed log files that capture every event, progress update, error, and completion status.

## Log File Location

Log files are stored in:
```
caser-deep-agent/logs/parallel-ai-runs/
```

## Log File Naming

Each log file is named using this pattern:
```
{ISO_TIMESTAMP}_{RUN_ID}.log
```

Example:
```
2024-01-15T10-30-45-123Z_trun_abc123def456.log
```

## What Gets Logged

### 1. Run Start
- Run ID
- Timestamp
- Metadata (query, processor, service name)

### 2. Task Creation
- Query
- Processor type
- Task input length
- Service name

### 3. All SSE Events
Every event from Parallel AI is logged:
- `task_run.state` - Status changes (running, completed, failed)
- `task_run.progress_msg` - Progress messages
- `task_run.progress_stats` - Statistics (pages read, sources considered)
- All other event types

### 4. Stream Lifecycle
- Stream start
- Stream completion
- Errors
- Timeouts

### 5. Completion Status
- Total event count
- Output length
- Final status

## Log Format

Each log entry follows this format:
```
[TIMESTAMP] [EVENT_TYPE]
{
  "data": {...}
}
================================================================================
```

Example:
```
[2024-01-15T10:30:45.123Z] [SSE_task_run.progress_msg]
{
  "data": {
    "message": "Searching www.example.com..."
  },
  "timestamp": "2024-01-15T10:30:45.123Z"
}
================================================================================
```

## Log File Structure

1. **RUN_START** - Initial log entry with metadata
2. **TASK_CREATED** - Task creation confirmation
3. **SSE_STREAM_START** - SSE connection established
4. **SSE_task_run.state** - State changes
5. **SSE_task_run.progress_msg** - Progress messages
6. **SSE_task_run.progress_stats** - Statistics
7. **RUN_COMPLETE** - Final completion entry

## Features

### Automatic Log Creation
- Log files are created automatically when a task starts
- No manual intervention required

### Non-Blocking Logging
- File writes are asynchronous and fire-and-forget
- Won't slow down or block the streaming process
- Errors in logging don't affect the main flow

### Comprehensive Coverage
- Every event is logged
- Errors are captured with stack traces
- Timeouts and failures are recorded

### Organized Storage
- All logs in dedicated directory
- Easy to find by timestamp or run ID
- Can be searched and analyzed

## Usage

### Finding a Specific Run's Log

1. Get the `run_id` from your API response or logs
2. Navigate to `logs/parallel-ai-runs/`
3. Search for files containing the run_id

### Analyzing Logs

Logs are in JSON format, making them easy to:
- Parse programmatically
- Search for specific events
- Analyze patterns
- Debug issues

### Example: Reading a Log File

```javascript
const fs = require('fs');
const logContent = fs.readFileSync('logs/parallel-ai-runs/2024-01-15T10-30-45-123Z_trun_abc123.log', 'utf-8');
// Parse and analyze...
```

## Log Retention

Currently, logs are kept indefinitely. You can:

1. **Manual Cleanup**: Delete old log files manually
2. **Programmatic Cleanup**: Use `FileLoggerService.cleanOldLogs(daysToKeep)`
3. **Automated Cleanup**: Set up a cron job to run cleanup

Example cleanup (keeps last 30 days):
```typescript
await fileLoggerService.cleanOldLogs(30);
```

## Error Handling

- Logging failures are caught and won't crash the application
- Errors are logged to console as warnings
- Main streaming flow continues even if file logging fails

## Configuration

Log directory is automatically created at:
```
{project_root}/logs/parallel-ai-runs/
```

The directory is created on first use if it doesn't exist.

## Integration Points

File logging is integrated at:

1. **ParallelTaskService** - Logs task creation
2. **ParallelSseService** - Logs all SSE events
3. **BaseTaskStreamingService** - Coordinates logging

## Service Injection

`FileLoggerService` is provided in all agent modules:
- `DeepResearchAgentModule`
- `QuickDeepResearchAgentModule`
- `UltraDeepResearchAgentModule`
- `WebSearchAgentModule`

## Example Log File

```
[2024-01-15T10:30:45.123Z] [RUN_START]
{
  "runId": "trun_abc123def456",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "metadata": {
    "query": "quantum computing applications",
    "processor": "core",
    "serviceName": "DeepResearchStreamingService"
  }
}
================================================================================

[2024-01-15T10:30:45.234Z] [TASK_CREATED]
{
  "query": "quantum computing applications",
  "processor": "core",
  "taskInputLength": 523,
  "serviceName": "DeepResearchStreamingService",
  "timestamp": "2024-01-15T10:30:45.234Z"
}
================================================================================

[2024-01-15T10:30:45.456Z] [SSE_STREAM_START]
{
  "runId": "trun_abc123def456",
  "timestamp": "2024-01-15T10:30:45.456Z"
}
================================================================================

[2024-01-15T10:30:46.123Z] [SSE_task_run.state]
{
  "data": {
    "run": {
      "status": "running"
    }
  },
  "timestamp": "2024-01-15T10:30:46.123Z"
}
================================================================================

[2024-01-15T10:30:47.789Z] [SSE_task_run.progress_msg]
{
  "data": {
    "message": "Searching www.example.com..."
  },
  "timestamp": "2024-01-15T10:30:47.789Z"
}
================================================================================

[2024-01-15T10:32:15.456Z] [RUN_COMPLETE]
{
  "status": "completed",
  "eventCount": 42,
  "outputLength": 15234,
  "timestamp": "2024-01-15T10:32:15.456Z"
}
================================================================================
```

## Benefits

1. **Debugging**: Full trace of what happened during each run
2. **Audit Trail**: Complete record of all agent activities
3. **Analysis**: Can analyze patterns and performance
4. **Troubleshooting**: Easy to identify issues and errors
5. **Monitoring**: Track success rates and error patterns

