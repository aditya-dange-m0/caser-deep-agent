# Streaming Architecture Explanation

## Overview
This codebase implements **Server-Sent Events (SSE)** streaming to provide real-time progress updates from Parallel AI tasks. The streaming flow involves multiple layers working together.

## Streaming Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Client Request (Browser/Frontend)                           │
│    GET /api/deep-research/research/stream?query=...            │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. NestJS Controller (@Sse() decorator)                        │
│    - Receives HTTP GET request                                  │
│    - Returns Observable<MessageEvent>                           │
│    - NestJS automatically handles SSE protocol                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Streaming Service (e.g., DeepResearchStreamingService)      │
│    - streamResearchObservable() returns Observable              │
│    - Wraps streamTask() in Observable                          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. BaseTaskStreamingService                                    │
│    - Creates task via ParallelTaskService                       │
│    - Connects to Parallel AI SSE via ParallelSseService         │
│    - Emits events via StreamEventEmitter                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────────┐    ┌─────────────────────┐
│ 5a. Task Creation│    │ 5b. SSE Connection  │
│ ParallelTaskService│   │ ParallelSseService  │
│                  │    │                     │
│ POST /tasks/runs │    │ GET /tasks/runs/    │
│ Returns: run_id  │    │   {runId}/events    │
└──────────────────┘    │ SSE Stream          │
                        └─────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Parallel AI SSE Stream                                       │
│    - Server-Sent Events format                                  │
│    - Events: task_run.state, task_run.progress_msg, etc.        │
│    - Streams internal reasoning, sources searched, progress     │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Event Processing & Forwarding                                │
│    - Parse SSE format (event: ..., data: ...)                   │
│    - Transform to MessageEvent                                  │
│    - Forward to NestJS Observable                               │
│    - Sent to client as SSE stream                               │
└─────────────────────────────────────────────────────────────────┘
```

## Detailed Component Breakdown

### 1. Controller Layer (`deep-research-agent.controller.ts`)

```typescript
@Get('research/stream')
@Sse()  // NestJS decorator - converts Observable to SSE stream
streamResearch(
  @Query('query') query: string,
  @Query('processor') processor?: ProcessorType,
): Observable<MessageEvent> {
  // Returns RxJS Observable
  return this.streamingService.streamResearchObservable(query, processor);
}
```

**What happens:**
- `@Sse()` decorator tells NestJS to use Server-Sent Events protocol
- NestJS automatically sets headers: `Content-Type: text/event-stream`
- The Observable is converted to SSE format automatically

### 2. Streaming Service Layer (`deep-research-streaming.service.ts`)

```typescript
streamResearchObservable(query: string, processor: string): Observable<MessageEvent> {
  return new Observable((observer) => {
    // Wraps async streamTask() in Observable
    this.streamTask(config, observer).catch((error) => {
      observer.error(error);
    });
  });
}
```

**What happens:**
- Creates RxJS Observable that wraps async streaming logic
- Observer pattern allows emitting events: `observer.next()`, `observer.complete()`, `observer.error()`

### 3. Base Streaming Service (`base-task-streaming.service.ts`)

This is where the core streaming logic lives:

```typescript
protected async streamTask(config, observer) {
  // Step 1: Create Parallel AI task
  const runId = await this.taskService.createTask(taskInput, processor);
  
  // Step 2: Emit "connected" event to client
  eventEmitter.emitConnected("Connected, starting...");
  
  // Step 3: Connect to Parallel AI SSE stream
  await this.sseService.streamParallelEvents(runId, (event) => {
    // Step 4: Forward each event to client
    eventEmitter.emitEvent(event.type, event.data);
  });
  
  // Step 5: Emit completion
  eventEmitter.emitComplete("Completed successfully");
}
```

### 4. ParallelSseService (`parallel-sse.service.ts`) - **The Core**

This service handles the actual SSE connection to Parallel AI:

```typescript
async streamParallelEvents(runId: string, onEvent: callback) {
  // 1. Connect to Parallel AI SSE endpoint
  const response = await fetch(
    `https://api.parallel.ai/v1beta/tasks/runs/${runId}/events`,
    {
      headers: {
        'x-api-key': PARALLEL_API_KEY,
        'parallel-beta': 'events-sse-2025-07-24',
        'Accept': 'text/event-stream',
      },
    }
  );
  
  // 2. Get the stream reader
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  
  // 3. Read stream chunk by chunk
  function processStream() {
    reader.read().then(({ done, value }) => {
      if (done) return; // Stream ended
      
      // 4. Decode bytes to text
      buffer += decoder.decode(value, { stream: true });
      
      // 5. Parse SSE format
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line
      
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEventType = line.substring(7).trim();
        } else if (line.startsWith('data: ')) {
          const data = JSON.parse(line.substring(6));
          // 6. Call callback with parsed event
          onEvent({ type: currentEventType, data });
        }
      }
      
      // 7. Continue reading
      processStream();
    });
  }
  
  processStream();
}
```

### 5. SSE Format Parsing

Parallel AI sends events in SSE format:
```
event: task_run.state
data: {"run":{"status":"running"}}

event: task_run.progress_msg
data: {"message":"Searching sources..."}

event: task_run.progress_stats
data: {"pages_read":5,"sources_considered":12}
```

The parser:
1. Reads chunks from the stream
2. Accumulates in a buffer (handles partial lines)
3. Splits by `\n` to get lines
4. Parses `event:` and `data:` lines
5. Extracts JSON from `data:` line
6. Calls callback with `{ type, data }`

### 6. Event Forwarding

Each parsed event is:
1. Logged by the logger
2. Forwarded to `StreamEventEmitter`
3. Formatted as `MessageEvent`:
   ```typescript
   {
     data: JSON.stringify({
       type: event.type,
       data: event.data
     })
   }
   ```
4. Sent to client via Observable: `observer.next(messageEvent)`

## Key Technologies

### Server-Sent Events (SSE)
- **One-way**: Server → Client only
- **Protocol**: HTTP with special headers
- **Format**: `event: <type>\ndata: <json>\n\n`
- **Browser API**: `EventSource` (native support)

### RxJS Observables
- **Pattern**: Observer pattern for async streams
- **Methods**: `next()`, `complete()`, `error()`
- **NestJS**: Automatically converts Observable to SSE

### Fetch API Streaming
- **Why**: Node.js `EventSource` doesn't support custom headers
- **Solution**: Use `fetch()` with `response.body.getReader()`
- **Reading**: Async iteration with `reader.read()`

## Event Types from Parallel AI

The system streams these event types:

1. **`task_run.state`** - Task status changes
   ```json
   {
     "run": {
       "status": "running" | "completed" | "failed",
       "output": "..."
     }
   }
   ```

2. **`task_run.progress_msg`** - Progress messages
   ```json
   {
     "message": "Searching www.example.com..."
   }
   ```

3. **`task_run.progress_stats`** - Statistics
   ```json
   {
     "pages_read": 10,
     "sources_considered": 25,
     "sources_read_sample": ["url1", "url2"]
   }
   ```

## Benefits of This Architecture

1. **Real-time Updates**: Client sees progress immediately
2. **Non-blocking**: Server doesn't wait for task completion
3. **Scalable**: Can handle many concurrent streams
4. **Transparent**: Shows internal reasoning and sources
5. **Reliable**: Proper error handling and timeout management

## Error Handling

1. **Connection Errors**: Caught in `fetch()` promise
2. **Parse Errors**: Logged, stream continues
3. **Timeout**: 10-minute timeout with cleanup
4. **Task Failures**: Detected from `task_run.state` events
5. **Stream Errors**: Forwarded to Observable error handler

## Timeout Management

- **Default Timeout**: 10 minutes (600,000 ms)
- **Purpose**: Prevent hanging streams
- **Cleanup**: Clears timeout on completion/error
- **Detection**: Logs warning when timeout reached

## Example Client Usage

```javascript
// Browser
const eventSource = new EventSource(
  '/api/deep-research/research/stream?query=quantum%20computing&processor=core'
);

eventSource.addEventListener('connected', (e) => {
  console.log('Connected:', JSON.parse(e.data));
});

eventSource.addEventListener('task_run.progress_msg', (e) => {
  const data = JSON.parse(e.data);
  console.log('Progress:', data.message);
});

eventSource.addEventListener('task_run.progress_stats', (e) => {
  const data = JSON.parse(e.data);
  console.log('Stats:', data);
});

eventSource.addEventListener('complete', (e) => {
  console.log('Completed!');
  eventSource.close();
});
```

## FindAll Streaming (Different Pattern)

FindAll uses **polling-based streaming** instead of SSE because it uses a different API:

```typescript
// Polls status every 2 seconds
while (notComplete && notTimeout) {
  const status = await fetch(`/runs/${findallId}`);
  emitEvent('status_update', status);
  await sleep(2000);
}
```

This still provides real-time updates but uses polling instead of SSE.

