# Logging Implementation for Deep Research Streaming

## Overview

Comprehensive logging has been implemented across all streaming services and controllers using NestJS Logger. This provides structured, contextual logging for debugging, monitoring, and observability.

## Logging Levels

The implementation uses NestJS Logger with different log levels:

- **`logger.log()`** - Important operational events (task creation, completion, connections)
- **`logger.debug()`** - Detailed diagnostic information (individual events, parsing steps)
- **`logger.warn()`** - Warning conditions (timeouts, missing data)
- **`logger.error()`** - Error conditions with full context

## Logged Components

### 1. DeepResearchAgentController

**Logger Context:** `DeepResearchAgentController`

#### POST /api/deep-research/research
- ✅ Request received with query and processor
- ✅ Request completed successfully
- ✅ Request failed with error details

#### GET /api/deep-research/research
- ✅ Request received with query and processor
- ✅ Request completed successfully
- ✅ Request failed with error details

#### GET /api/deep-research/research/stream
- ✅ SSE stream request received with query and processor
- ✅ Query validation (warns if missing)
- ✅ Observable creation

**Example Logs:**
```
[DeepResearchAgentController] [Stream] SSE stream request received - Query: "quantum computing applications", Processor: core
[DeepResearchAgentController] [Stream] Returning SSE observable for deep research
```

---

### 2. DeepResearchStreamingService

**Logger Context:** `DeepResearchStreamingService`

#### streamResearchObservable()
- ✅ Stream start with query and processor
- ✅ Error in observable creation

#### streamResearch()
- ✅ Task preparation details (query, processor, includeAnalysis)
- ✅ Parallel AI task creation attempt
- ✅ Task creation success with run_id
- ✅ Task creation failure with error details
- ✅ Initial connection event sent
- ✅ Event streaming start
- ✅ Event forwarding (with event counts)
- ✅ Stream completion with total event count
- ✅ Error during streaming with full context

**Example Logs:**
```
[DeepResearchStreamingService] [Streaming] Starting deep research stream - Query: "quantum computing...", Processor: core
[DeepResearchStreamingService] [Streaming] Preparing deep research task - Query: "quantum computing", Processor: core, IncludeAnalysis: true
[DeepResearchStreamingService] [Streaming] Creating Parallel AI task with events enabled - Processor: core
[DeepResearchStreamingService] [Streaming] Deep research task created successfully - run_id: trun_abc123
[DeepResearchStreamingService] [Streaming] Sending initial connection event for run_id: trun_abc123
[DeepResearchStreamingService] [Streaming] Starting to stream events for run_id: trun_abc123
[DeepResearchStreamingService] [Streaming] Forwarding state event (event #1): running
[DeepResearchStreamingService] [Streaming] All events streamed successfully for run_id: trun_abc123 (total events: 15)
[DeepResearchStreamingService] [Streaming] Stream completed successfully for run_id: trun_abc123
```

---

### 3. ParallelSseService

**Logger Context:** `ParallelSseService`

#### streamParallelEvents()
- ✅ Stream start with run_id
- ✅ API key validation
- ✅ SSE endpoint URL
- ✅ HTTP response status
- ✅ SSE stream connection success
- ✅ Individual events received (with event numbers)
- ✅ Event parsing errors
- ✅ Stream completion with event count
- ✅ Task completion detection
- ✅ Task failure detection
- ✅ Stream timeout warnings
- ✅ Stream processing errors
- ✅ Fetch errors

**Example Logs:**
```
[ParallelSseService] [SSE] Starting to stream events for run_id: trun_abc123
[ParallelSseService] [SSE] Connecting to Parallel AI SSE endpoint: https://api.parallel.ai/v1beta/tasks/runs/trun_abc123/events
[ParallelSseService] [SSE] HTTP response received: 200 OK
[ParallelSseService] [SSE] SSE stream connected successfully for run_id: trun_abc123
[ParallelSseService] [SSE] State event received: running (event #1)
[ParallelSseService] [SSE] Progress message received (event #2)
[ParallelSseService] [SSE] Progress stats received: {"pagesRead":5,"pagesConsidered":10...
[ParallelSseService] [SSE] Stream completed successfully for run_id: trun_abc123 (total events: 15)
```

---

## Log Format

All logs follow a consistent format:

```
[LoggerContext] [Category] Message - Additional Context
```

**Examples:**
- `[DeepResearchAgentController] [Research] POST request received - Query: "...", Processor: core`
- `[DeepResearchStreamingService] [Streaming] Deep research task created successfully - run_id: trun_abc123`
- `[ParallelSseService] [SSE] Stream completed successfully for run_id: trun_abc123 (total events: 15)`

---

## Key Events Logged

### Connection Events
- ✅ Client connection to SSE endpoint
- ✅ Initial connection event sent
- ✅ SSE stream connection to Parallel AI

### Task Lifecycle
- ✅ Task creation request
- ✅ Task creation success (with run_id)
- ✅ Task creation failure

### Streaming Events
- ✅ Each event type received (state, progress_msg, progress_stats, etc.)
- ✅ Event count tracking
- ✅ Event parsing errors

### Completion Events
- ✅ Stream completion
- ✅ Task completion
- ✅ Task failure

### Error Events
- ✅ API key missing
- ✅ HTTP errors
- ✅ Parsing errors
- ✅ Timeout errors
- ✅ Stream processing errors
- ✅ Task failures

---

## Log Levels by Event Type

| Event Type | Log Level | Description |
|------------|-----------|-------------|
| Request received | `log` | Client request received |
| Task created | `log` | Task successfully created |
| Stream connected | `log` | SSE connection established |
| Stream completed | `log` | Stream finished successfully |
| Individual events | `debug` | Each event received |
| Event parsing | `debug` | Event parsing details |
| Task failure | `error` | Task failed with error |
| HTTP errors | `error` | HTTP request errors |
| Timeouts | `warn` | Stream timeout |
| Missing data | `warn` | Expected data missing |

---

## Debugging Tips

### Enable Debug Logs

Set NestJS log level to debug:

```typescript
// In main.ts
app.useLogger(['log', 'error', 'warn', 'debug']);
```

Or via environment variable:
```bash
LOG_LEVEL=debug npm run start:dev
```

### Key Log Points for Debugging

1. **Connection Issues:**
   - Look for: `[SSE] SSE stream connected successfully`
   - If missing: Check API key and network connectivity

2. **Task Creation Issues:**
   - Look for: `[Streaming] Deep research task created successfully - run_id: ...`
   - If missing: Check Parallel API key and task creation request

3. **Streaming Issues:**
   - Look for: `[SSE] Event received: ...`
   - If missing: Check Parallel API SSE endpoint status

4. **Completion Issues:**
   - Look for: `[Streaming] Stream completed successfully`
   - Check for timeout warnings: `[SSE] Stream timeout after 10 minutes`

5. **Event Parsing Issues:**
   - Look for: `[SSE] Error parsing event data`
   - Check debug logs for failed line parsing

---

## Log Search Examples

### Find all streaming requests:
```bash
grep "\[Stream\] SSE stream request received" logs/app.log
```

### Find all task creations:
```bash
grep "Deep research task created successfully" logs/app.log
```

### Find all errors:
```bash
grep "\[ERROR\]" logs/app.log
```

### Find specific run_id logs:
```bash
grep "trun_abc123" logs/app.log
```

---

## Integration with Existing Logging

The streaming services integrate with:
- ✅ NestJS Logger (standard NestJS logging)
- ✅ Mastra Logger (via mastra?.getLogger() in tools)
- ✅ Console logs in tools (for backward compatibility)

All new logging uses NestJS Logger for consistency and better integration with NestJS logging infrastructure.

---

## Performance Considerations

- Debug logs are only output when log level is set to debug
- Event-level logs are at debug level to avoid log spam
- Important operational events use `log` level
- Errors always use `error` level for monitoring

---

## Future Enhancements

Potential logging improvements:
1. Structured JSON logging (using Pino or Winston)
2. Correlation IDs for request tracing
3. Performance metrics logging (duration, throughput)
4. Integration with logging aggregation services (DataDog, CloudWatch, etc.)

