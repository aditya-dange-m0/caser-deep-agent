# Deep Research Streaming Endpoint Usage

## Overview

The deep research streaming endpoint provides real-time progress updates via Server-Sent Events (SSE) for long-running research tasks.

**Endpoint:** `GET /api/deep-research/research/stream`

## Swagger UI Documentation

The endpoint is documented in Swagger UI at: `http://localhost:3000/api-docs`

⚠️ **Note:** SSE endpoints cannot be fully tested in Swagger UI itself, but the documentation shows:
- Required query parameters
- Response format
- Event types you'll receive

## Testing the Endpoint

### Option 1: Using cURL (Recommended)

```bash
curl -N "http://localhost:3000/api/deep-research/research/stream?query=quantum%20computing%20applications&processor=core"
```

The `-N` flag disables buffering so you see events in real-time.

### Option 2: Using Browser EventSource API

Open browser console and run:

```javascript
const eventSource = new EventSource(
  'http://localhost:3000/api/deep-research/research/stream?query=quantum%20computing%20applications&processor=core'
);

eventSource.addEventListener('connected', (e) => {
  console.log('Connected:', JSON.parse(e.data));
});

eventSource.addEventListener('task_run.state', (e) => {
  console.log('State:', JSON.parse(e.data));
});

eventSource.addEventListener('task_run.progress_msg', (e) => {
  console.log('Progress:', JSON.parse(e.data));
});

eventSource.addEventListener('task_run.progress_stats', (e) => {
  console.log('Stats:', JSON.parse(e.data));
});

eventSource.addEventListener('complete', (e) => {
  console.log('Complete:', JSON.parse(e.data));
  eventSource.close();
});

eventSource.addEventListener('error', (e) => {
  console.error('Error:', JSON.parse(e.data));
  eventSource.close();
});
```

### Option 3: Using Postman/Insomnia

1. Create a GET request to: `http://localhost:3000/api/deep-research/research/stream`
2. Add query parameters:
   - `query`: Your research query
   - `processor`: `core` or `pro` (optional, defaults to `core`)
3. Send the request
4. You'll see events streaming in real-time in the response

## Event Types

The endpoint streams the following event types:

### `connected`
Sent immediately when client connects.
```json
{
  "message": "Connected, starting deep research...",
  "query": "your query",
  "processor": "core"
}
```

### `task_run.state`
Task state changes (running, completed, failed, etc.)
```json
{
  "run": {
    "status": "running",
    "run_id": "..."
  }
}
```

### `task_run.progress_msg`
Progress messages from the research task.
```json
{
  "message": "Starting research...",
  "exec_status": "..."
}
```

### `task_run.progress_stats`
Statistics about progress (pages read, sources, etc.).
```json
{
  "pagesRead": 5,
  "pagesConsidered": 10,
  "sourceLinks": ["url1", "url2"]
}
```

### `complete`
Research completed successfully.
```json
{
  "message": "Deep research completed successfully"
}
```

### `error`
An error occurred during research.
```json
{
  "error": "Error message here"
}
```

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | The research query or topic to investigate |
| `processor` | enum | No | Processor type: `core` (default) or `pro` |

## Example cURL Commands

### Basic research query
```bash
curl -N "http://localhost:3000/api/deep-research/research/stream?query=artificial%20intelligence%20trends"
```

### With pro processor
```bash
curl -N "http://localhost:3000/api/deep-research/research/stream?query=machine%20learning%20applications&processor=pro"
```

### Save output to file
```bash
curl -N "http://localhost:3000/api/deep-research/research/stream?query=your%20query" > research_output.txt
```

## Response Headers

The endpoint sets the following headers:
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`
- `X-Accel-Buffering: no`

## Keep-Alive

The server sends keep-alive pings every 30 seconds to keep the connection alive during long-running tasks.

## Error Handling

If an error occurs:
1. An `error` event is sent with error details
2. The connection is closed
3. Check the error message for details

## Integration Notes

- The endpoint works alongside the existing synchronous endpoints
- Use streaming for better user experience during long-running tasks
- The synchronous endpoint (`POST /api/deep-research/research`) still works for simple use cases
- Streaming provides real-time feedback about progress and sources being searched

