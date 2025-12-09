# TODO List

## Core Issues

1. Rate limiting
2. Input Validation
3. Add proper dtos
4. Proper error handling
5. Request Timeout (Optional - not for long running tasks)
6. Caching wherever required
7. Synchronous Long-Running Operations Block Server - so add Job Queue Pattern / If required add webhook for long running operations
8. Error Handling Exposes Internal Details so mask them

9. Synchronous Long-Running Operations Block Server
10. Hardcoded Timeout Values
11. Input Validation Gaps
12. Rate Limiting Missing
13. Request Timeout Configuration
14. Caching Implementation
15. Async Processing & Polling
16. Singleton Parallel Client per User

## Common Issues Across All Features

1. Tools return only formatted substring not complex json in every case only in needed case such as successful output return json - To remove context pollution due to Json result of tools

2. Hardcoded Timeout Values -> try to add wait until completion with config class
3. Add async processing whereever possible add apolling async if possible
4. get singoleton parallel client per user if improves efficiency in tools
5. In streamaing try to correctly close stream reader, SSE Buffer Can Grow Unbounded so add max size to it, Reconnection variables isolation, Add config class for hard coded constants in sse streaming, in case of error add Error Recovery, Add catching wherever required
6. SSE Stream No Client Disconnect Handling
7. look into AUDIT_ULTRA_DEEP_RESEARCH_FEATURE.md for better understanding - This feature alone could bankrupt a startup.($2.40/request)
8. SearchDepth and Processor Logic Confusion - in features/websearch

9. SSE streaming issues (stream readers not properly closed, SSE buffers can grow unbounded, no client disconnect handling, reconnection variables not isolated, missing error recovery mechanisms)
10. Error handling exposes internal details (raw errors leak API keys, stack traces, internal URLs)
11. Tools return complex JSON (tool responses include full JSON, polluting context)
12. SearchDepth and Processor Logic Confusion (two overlapping ways to control processor selection)
