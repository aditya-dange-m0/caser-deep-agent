# Production & Scalability Audit Report
## Web Search Feature Analysis

**Date:** December 9, 2025  
**Feature:** Web Search Agent  
**Files Audited:**
- `src/mastra/features/web-search/web-search-agent.controller.ts`
- `src/mastra/features/web-search/web-search-agent.module.ts`
- `src/mastra/features/web-search/services/web-search-agent.service.ts`
- `src/mastra/features/web-search/services/web-search-streaming.service.ts`

---

## Executive Summary

### Overall Assessment: 🟡 **MEDIUM RISK**

The Web Search feature is the **LEAST EXPENSIVE** endpoint in the system ($0.005-$0.01 per request), making it **lower financial risk** than other features. However, it still suffers from the **same critical security gaps** (no auth, no rate limiting) and has **unique validation issues** around the maxResults parameter that could lead to abuse.

### Risk Level by Category
- **Financial Risk:** 🟢 LOW RISK - $0.01 max per request
- **Security:** 🔴 HIGH RISK - No authentication
- **Rate Limiting:** 🔴 HIGH RISK - None implemented
- **Input Validation:** 🟡 MEDIUM RISK - Has validation but gaps remain
- **Resource Management:** 🟢 LOW RISK - Short execution times (5-100s)
- **Error Handling:** 🟡 MEDIUM RISK - Generic error exposure
- **Observability:** 🟡 MEDIUM RISK - Basic logging only

### Cost Comparison Across All Features:
| Feature | Max Cost per Request | Execution Time | Risk Level |
|---------|---------------------|----------------|------------|
| **Web Search** | **$0.01 (base)** | **5-100s** | **MEDIUM** |
| Quick Deep Research | $0.025 (core) | 30-120s | MEDIUM |
| Deep Research | $0.10 (pro) | 60-180s | MEDIUM |
| Ultra Deep Research | $2.40 (ultra8x) | 600-1200s | CRITICAL |

**Web Search is the most affordable and fastest endpoint.**

---

## 1. Critical Issues 🔴

### 1.1 No Authentication/Authorization

**Location:** All controller endpoints

**Issue:** Completely open API

```typescript
@Controller('api/web-search')
export class WebSearchAgentController {
  // No @UseGuards() decorators
  // No authentication

  @Post('search')
  async search(@Body() searchDto: WebSearchDto) {
    // Anyone can use this endpoint
    // Even though cost is low, still needs protection
  }
}
```

**Impact:**
- **Public abuse** - unlimited free searches
- **Resource exhaustion** - high volume of cheap requests
- **No user tracking** - can't analyze usage patterns
- **Competitor harvesting** - free access to your search API

**Attack Scenario:**
```bash
# Low-cost but high-volume abuse
for i in {1..10000}; do
  curl -X POST http://api/web-search/search \
    -H "Content-Type: application/json" \
    -d '{
      "query":"scrape data query '$i'",
      "processor":"base",
      "maxResults":50
    }' &
done

# Result:
# - 10,000 requests × $0.01 = $100
# - Lower cost than other endpoints but still significant at scale
# - Could be used to scrape/harvest data through your API
# - Server will struggle with 10k concurrent requests
```

**Recommendation:**
```typescript
import { AuthGuard } from '@nestjs/passport';
import { UseGuards, Request } from '@nestjs/common';

@Controller('api/web-search')
@UseGuards(AuthGuard('jwt'))
export class WebSearchAgentController {
  
  @Post('search')
  async search(
    @Body() searchDto: WebSearchDto,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    
    this.logger.log(
      `[Search] User ${userId} - Query: "${searchDto.query.substring(0, 50)}", ` +
      `Processor: ${searchDto.processor || 'lite'}, MaxResults: ${searchDto.maxResults || 10}`
    );
    
    // Track usage for rate limiting and analytics
    await this.usageTracker.recordSearch(userId, searchDto.processor || 'lite');
    
    return await this.webSearchAgentService.search(
      searchDto.query,
      searchDto.processor,
      searchDto.searchDepth,
      searchDto.maxResults,
      searchDto.includeExcerpts,
    );
  }

  @Get('search/stream')
  @Sse()
  async streamSearch(
    @Query('query') query: string,
    @Query('processor') processor?: ProcessorType,
    @Query('maxResults') maxResults?: string,
    @Query('includeExcerpts') includeExcerpts?: string,
    @Request() req?: any,
  ): Observable<MessageEvent> {
    const userId = req?.user?.id || 'anonymous';
    
    this.logger.log(
      `[Stream] User ${userId} - Query: "${query.substring(0, 50)}"`
    );
    
    // Implementation
  }
}
```

---

### 1.2 No Rate Limiting

**Location:** All endpoints

**Issue:** No throttling despite being a search API (highly abuse-prone)

**Impact:**
- **Data scraping** - competitors can scrape unlimited data
- **DoS potential** - even cheap requests can overwhelm at scale
- **Cost accumulation** - $0.01 × 100,000 requests = $1,000
- **API reputation damage** - if used for spam/abuse

**Recommendation:**
```typescript
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UseGuards } from '@nestjs/common';

@Controller('api/web-search')
@UseGuards(AuthGuard('jwt'), ThrottlerGuard)
export class WebSearchAgentController {
  
  @Post('search')
  @Throttle(30, 60) // 30 searches per minute (reasonable for human use)
  async search(@Body() searchDto: WebSearchDto, @Request() req: any) {
    // Implementation
  }

  @Get('search/stream')
  @Sse()
  @Throttle(15, 60) // 15 SSE streams per minute (more restrictive)
  streamSearch(
    @Query('query') query: string,
    @Query('processor') processor?: ProcessorType,
    @Query('maxResults') maxResults?: string,
    @Query('includeExcerpts') includeExcerpts?: string,
    @Request() req?: any,
  ): Observable<MessageEvent> {
    // Implementation
  }

  @Get('processors')
  @Throttle(100, 60) // 100 requests per minute (metadata endpoint)
  getProcessors() {
    // Implementation
  }
}

// Advanced rate limiting with burst protection
@Injectable()
export class SearchRateLimitGuard implements CanActivate {
  private userRequests = new Map<string, number[]>();
  
  private readonly LIMITS = {
    perMinute: 30,
    perHour: 500,
    perDay: 5000,
  };

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id || request.ip;

    const now = Date.now();
    const userHistory = this.userRequests.get(userId) || [];
    
    // Remove old timestamps
    const recentRequests = userHistory.filter(timestamp => 
      now - timestamp < 86400000 // 24 hours
    );

    // Check limits
    const minuteAgo = now - 60000;
    const hourAgo = now - 3600000;
    const dayAgo = now - 86400000;

    const requestsLastMinute = recentRequests.filter(t => t > minuteAgo).length;
    const requestsLastHour = recentRequests.filter(t => t > hourAgo).length;
    const requestsLastDay = recentRequests.filter(t => t > dayAgo).length;

    if (requestsLastMinute >= this.LIMITS.perMinute) {
      throw new HttpException(
        `Rate limit exceeded: ${this.LIMITS.perMinute} searches per minute`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (requestsLastHour >= this.LIMITS.perHour) {
      throw new HttpException(
        `Rate limit exceeded: ${this.LIMITS.perHour} searches per hour`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (requestsLastDay >= this.LIMITS.perDay) {
      throw new HttpException(
        `Rate limit exceeded: ${this.LIMITS.perDay} searches per day`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Record this request
    recentRequests.push(now);
    this.userRequests.set(userId, recentRequests);

    return true;
  }
}

// Usage
@Post('search')
@UseGuards(SearchRateLimitGuard)
async search(/* ... */) {
  // Implementation
}
```

---

### 1.3 No Input Validation on Query Length

**Location:** `WebSearchDto`

**Issue:** Query has no length constraints

```typescript
export class WebSearchDto {
  @ApiProperty({
    description: 'The search query or question to search for on the web',
    example: 'digital twins latest developments 2024',
  })
  @IsString()
  query!: string; // No length limit!
}
```

**Impact:**
- **Memory issues** from huge query strings
- **API abuse** - using as text storage
- **Poor search quality** - overly long queries produce bad results

**Recommendation:**
```typescript
import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class WebSearchDto {
  @ApiProperty({
    description: 'The search query or question to search for on the web',
    example: 'digital twins latest developments 2024',
    minLength: 3,
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty({ message: 'Query cannot be empty' })
  @Length(3, 500, {
    message: 'Query must be between 3 and 500 characters',
  })
  @Transform(({ value }) => value?.trim())
  @Matches(/^[a-zA-Z0-9\s.,?!;:()\-'"]+$/, {
    message: 'Query contains invalid characters. Only alphanumeric, spaces, and basic punctuation allowed.',
  })
  query!: string;

  @ApiProperty({
    description: 'Processor to use: lite (faster, cost-effective) or base (more comprehensive)',
    enum: ProcessorType,
    required: false,
    example: ProcessorType.BASE,
  })
  @IsOptional()
  @IsEnum(ProcessorType, {
    message: 'Processor must be either "lite" or "base"',
  })
  processor?: ProcessorType;

  @ApiProperty({
    description: 'Search depth level - basic uses lite processor, advanced uses base processor',
    enum: SearchDepth,
    required: false,
    default: SearchDepth.BASIC,
    example: SearchDepth.ADVANCED,
  })
  @IsOptional()
  @IsEnum(SearchDepth, {
    message: 'Search depth must be either "basic" or "advanced"',
  })
  searchDepth?: SearchDepth;

  @ApiProperty({
    description: 'Maximum number of search results to return',
    minimum: 1,
    maximum: 50,
    default: 10,
    required: false,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1, { message: 'maxResults must be at least 1' })
  @Max(50, { message: 'maxResults cannot exceed 50' })
  maxResults?: number;

  @ApiProperty({
    description: 'Include detailed excerpts from search results',
    default: true,
    required: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'includeExcerpts must be a boolean' })
  includeExcerpts?: boolean;
}
```

---

### 1.4 SSE Stream Query Parameters Not Validated

**Location:** `streamSearch()` method

**Issue:** Manual type coercion instead of proper validation

```typescript
streamSearch(
  @Query('query') query: string,
  @Query('processor') processor?: ProcessorType,
  @Query('maxResults') maxResults?: string,
  @Query('includeExcerpts') includeExcerpts?: string,
): Observable<MessageEvent> {
  if (!query) {
    throw new BadRequestException('Query parameter is required');
  }
  
  const maxResultsNum = maxResults ? Number(maxResults) : 10;
  const includeExcerptsBool = includeExcerpts
    ? includeExcerpts === 'true' || includeExcerpts === '1'  // Fragile!
    : true;
  
  // No validation on maxResultsNum range!
  // What if maxResults = "999999"?
  // What if maxResults = "abc"? (NaN)
}
```

**Impact:**
- **Type coercion bugs** - NaN values passed through
- **Resource abuse** - no range validation on maxResults
- **Inconsistent behavior** - edge cases not handled

**Recommendation:**
```typescript
import { ParseBoolPipe, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';

// Create a query DTO
export class StreamSearchQueryDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 500)
  @Transform(({ value }) => value?.trim())
  @Matches(/^[a-zA-Z0-9\s.,?!;:()\-'"]+$/)
  query!: string;

  @IsOptional()
  @IsEnum(ProcessorType)
  processor?: ProcessorType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  maxResults?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean()
  includeExcerpts?: boolean;
}

// Use in controller
@Get('search/stream')
@Sse()
streamSearch(
  @Query(new ValidationPipe({ transform: true })) queryDto: StreamSearchQueryDto,
): Observable<MessageEvent> {
  this.logger.log(
    `[Stream] SSE stream request - Query: "${queryDto.query.substring(0, 50)}"`
  );

  // All parameters now properly validated
  return this.streamingService.streamSearchObservable(
    queryDto.query,
    queryDto.processor || ProcessorType.LITE,
    queryDto.maxResults || 10,
    queryDto.includeExcerpts !== undefined ? queryDto.includeExcerpts : true,
  );
}
```

---

### 1.5 Potential MaxResults Abuse

**Location:** `maxResults` parameter handling

**Issue:** While validated in DTO (1-50), this still allows significant resource consumption

**Current Implementation:**
```typescript
@Max(50)
maxResults?: number;
```

**Impact:**
- **50 results per request** could be expensive at scale
- **No tiered limits** - free users get same limits as premium
- **Cost multiplication** - 50 results × high volume = significant costs

**Recommendation:**
```typescript
@Injectable()
export class MaxResultsGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const maxResults = request.body?.maxResults || request.query?.maxResults || 10;

    // Tier-based limits
    const limits = {
      free: 10,
      basic: 20,
      premium: 50,
      enterprise: 100,
    };

    const userLimit = limits[user?.tier] || limits.free;

    if (maxResults > userLimit) {
      throw new HttpException(
        `maxResults=${maxResults} exceeds your tier limit of ${userLimit}. ` +
        `Your tier: ${user?.tier || 'free'}. Please upgrade for higher limits.`,
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}

// Also update DTO validation based on tier
export class WebSearchDto {
  @ApiProperty({
    description: 'Maximum number of search results to return (tier-dependent: free=10, basic=20, premium=50, enterprise=100)',
    minimum: 1,
    maximum: 100, // Updated max
    default: 10,
    required: false,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100) // Validated in guard based on tier
  maxResults?: number;
}

// Usage
@Post('search')
@UseGuards(AuthGuard('jwt'), MaxResultsGuard, ThrottlerGuard)
async search(/* ... */) {
  // Implementation
}
```

---

## 2. High Priority Issues 🟡

### 2.1 SearchDepth and Processor Logic Confusion

**Location:** `WebSearchDto` and service layer

**Issue:** Two overlapping ways to control processor selection

```typescript
export class WebSearchDto {
  @IsOptional()
  @IsEnum(ProcessorType)
  processor?: ProcessorType; // Explicit processor

  @IsOptional()
  @IsEnum(SearchDepth)
  searchDepth?: SearchDepth; // Maps to processor
}

// In service
if (processor) {
  toolInput.processor = processor; // Processor takes priority
} else {
  toolInput.searchDepth = searchDepth || 'basic'; // Fallback to depth
}
```

**Impact:**
- **Confusing API** - two ways to do the same thing
- **Documentation burden** - need to explain both
- **Potential bugs** - users set both and get unexpected behavior

**Recommendation - Simplify:**
```typescript
export class WebSearchDto {
  @ApiProperty({
    description: 'Search quality level',
    enum: SearchQuality,
    required: false,
    default: SearchQuality.STANDARD,
    example: SearchQuality.PREMIUM,
  })
  @IsOptional()
  @IsEnum(SearchQuality)
  quality?: SearchQuality;
  
  // Remove processor and searchDepth - simplify to single param
}

export enum SearchQuality {
  FAST = 'fast',      // Maps to lite processor
  STANDARD = 'standard', // Maps to lite processor with more results
  PREMIUM = 'premium',   // Maps to base processor
}

// In service - clearer mapping
async search(
  query: string,
  quality?: SearchQuality,
  maxResults?: number,
  includeExcerpts?: boolean,
): Promise<any> {
  const processorMapping = {
    fast: 'lite',
    standard: 'lite',
    premium: 'base',
  };

  const toolInput: any = {
    query,
    processor: processorMapping[quality || 'standard'],
    maxResults: maxResults || 10,
    includeExcerpts: includeExcerpts !== undefined ? includeExcerpts : true,
  };

  // ...
}
```

---

### 2.2 Error Handling Too Generic

**Location:** All controller methods

**Issue:** Raw errors exposed to client

```typescript
try {
  const result = await this.webSearchAgentService.search(/* ... */);
  return result;
} catch (error) {
  this.logger.error(`[Search] POST request failed:`, error);
  throw error; // Raw error!
}
```

**Recommendation:**
```typescript
import {
  BadRequestException,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';

@Post('search')
async search(@Body() searchDto: WebSearchDto, @Request() req: any) {
  try {
    const result = await this.webSearchAgentService.search(
      searchDto.query,
      searchDto.processor,
      searchDto.searchDepth,
      searchDto.maxResults,
      searchDto.includeExcerpts,
    );
    
    this.logger.log('[Search] Request completed successfully');
    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    this.logger.error('[Search] Request failed:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.user?.id,
      query: searchDto.query.substring(0, 100),
      processor: searchDto.processor,
    });

    // Map internal errors to safe user-facing errors
    if (errorMessage.includes('PARALLEL_API_KEY')) {
      throw new InternalServerErrorException(
        'Search service configuration error. Please contact support.'
      );
    }

    if (errorMessage.includes('timeout')) {
      throw new HttpException(
        'Search request timed out. Try a simpler query or use "lite" processor.',
        HttpStatus.REQUEST_TIMEOUT,
      );
    }

    if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      throw new HttpException(
        'Search API rate limit exceeded. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (errorMessage.includes('no results') || errorMessage.includes('404')) {
      return {
        success: true,
        results: [],
        summary: 'No results found for your query.',
      };
    }

    if (error instanceof HttpException) {
      throw error;
    }

    // Generic fallback
    throw new InternalServerErrorException(
      'An error occurred during search. Please try again.'
    );
  }
}
```

---

### 2.3 No Timeout Configuration

**Location:** All endpoints

**Issue:** No server-side timeout enforcement

**Recommendation:**
```typescript
import { SetMetadata } from '@nestjs/common';
import { timeout as rxjsTimeout, catchError } from 'rxjs/operators';

export const ENDPOINT_TIMEOUT = 'endpoint_timeout';
export const EndpointTimeout = (ms: number) => SetMetadata(ENDPOINT_TIMEOUT, ms);

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const timeout = this.reflector.get<number>(
      ENDPOINT_TIMEOUT,
      context.getHandler(),
    ) || 30000; // 30s default

    return next.handle().pipe(
      rxjsTimeout(timeout),
      catchError(err => {
        if (err instanceof TimeoutError) {
          throw new HttpException(
            'Request timeout',
            HttpStatus.REQUEST_TIMEOUT,
          );
        }
        return throwError(() => err);
      }),
    );
  }
}

// Usage
@Post('search')
@EndpointTimeout(120000) // 2 minutes (max for base processor)
@UseInterceptors(TimeoutInterceptor)
async search(@Body() searchDto: WebSearchDto) {
  // Implementation
}

@Get('search/stream')
@Sse()
@EndpointTimeout(150000) // 2.5 minutes for SSE
@UseInterceptors(TimeoutInterceptor)
streamSearch(/* ... */) {
  // Implementation
}
```

---

### 2.4 No Result Caching

**Location:** `search()` endpoint

**Issue:** Identical searches re-execute

**Recommendation:**
```typescript
import { CacheModule, CacheInterceptor, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class WebSearchAgentService extends BaseResearchAgentService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    super();
  }

  async search(
    query: string,
    processor?: ProcessorType,
    searchDepth?: SearchDepth,
    maxResults?: number,
    includeExcerpts?: boolean,
  ): Promise<any> {
    // Generate cache key
    const cacheKey = this.generateCacheKey(
      query,
      processor,
      searchDepth,
      maxResults,
      includeExcerpts,
    );
    
    // Check cache first
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      console.log(`[Cache] Hit for query: ${query.substring(0, 50)}`);
      return cached;
    }

    // Execute search
    const toolInput: any = {
      query,
      maxResults: maxResults || 10,
      includeExcerpts: includeExcerpts !== undefined ? includeExcerpts : true,
    };

    if (processor) {
      toolInput.processor = processor;
    } else {
      toolInput.searchDepth = searchDepth || 'basic';
    }

    const runtimeContext = this.createRuntimeContext();

    const result = await webSearchTool.execute({
      context: toolInput,
      mastra: this.getMastra(),
      runtimeContext,
    });

    // Cache successful results for shorter duration (web content changes)
    if (result.success) {
      const ttl = this.getCacheTTL(query);
      await this.cacheManager.set(cacheKey, result, ttl);
    }

    return result;
  }

  private generateCacheKey(
    query: string,
    processor?: ProcessorType,
    searchDepth?: SearchDepth,
    maxResults?: number,
    includeExcerpts?: boolean,
  ): string {
    const normalized = query.toLowerCase().trim();
    const proc = processor || (searchDepth === 'advanced' ? 'base' : 'lite');
    const max = maxResults || 10;
    const excerpts = includeExcerpts !== undefined ? includeExcerpts : true;
    
    const hash = createHash('sha256')
      .update(`${normalized}:${proc}:${max}:${excerpts}`)
      .digest('hex');
    
    return `web-search:${hash}`;
  }

  private getCacheTTL(query: string): number {
    // News-related queries: 5 minutes (frequent updates)
    if (/news|latest|recent|today|2025/i.test(query)) {
      return 300;
    }
    
    // General queries: 30 minutes
    if (/how|what|why|guide|tutorial/i.test(query)) {
      return 1800;
    }
    
    // Historical/reference queries: 2 hours
    return 7200;
  }
}

// In module
@Module({
  imports: [
    CacheModule.register({
      ttl: 1800, // 30 min default
      max: 1000, // Cache up to 1000 searches
    }),
  ],
  // ...
})
export class WebSearchAgentModule {}
```

---

### 2.5 No Metrics Collection

**Location:** All endpoints

**Issue:** No tracking of search patterns, popular queries, etc.

**Recommendation:**
```typescript
@Injectable()
export class WebSearchMetricsService {
  private metrics = {
    totalSearches: 0,
    successfulSearches: 0,
    failedSearches: 0,
    processorUsage: { lite: 0, base: 0 },
    averageLatency: 0,
    totalCost: 0,
    popularQueries: new Map<string, number>(),
    resultDistribution: { '0-10': 0, '11-25': 0, '26-50': 0 },
  };

  recordSearch(
    query: string,
    processor: string,
    maxResults: number,
    success: boolean,
    latency: number,
    resultCount: number,
  ): void {
    this.metrics.totalSearches++;
    
    if (success) {
      this.metrics.successfulSearches++;
    } else {
      this.metrics.failedSearches++;
    }

    this.metrics.processorUsage[processor] = 
      (this.metrics.processorUsage[processor] || 0) + 1;

    // Track popular queries (normalized)
    const normalizedQuery = query.toLowerCase().trim().substring(0, 100);
    const currentCount = this.metrics.popularQueries.get(normalizedQuery) || 0;
    this.metrics.popularQueries.set(normalizedQuery, currentCount + 1);

    // Keep only top 100 popular queries
    if (this.metrics.popularQueries.size > 100) {
      const sorted = Array.from(this.metrics.popularQueries.entries())
        .sort((a, b) => b[1] - a[1]);
      this.metrics.popularQueries = new Map(sorted.slice(0, 100));
    }

    // Track result distribution
    if (resultCount <= 10) {
      this.metrics.resultDistribution['0-10']++;
    } else if (resultCount <= 25) {
      this.metrics.resultDistribution['11-25']++;
    } else {
      this.metrics.resultDistribution['26-50']++;
    }

    // Update average latency
    const total = this.metrics.totalSearches;
    this.metrics.averageLatency = 
      (this.metrics.averageLatency * (total - 1) + latency) / total;

    // Estimate cost
    const costPerSearch = processor === 'base' ? 0.01 : 0.005;
    this.metrics.totalCost += costPerSearch;
  }

  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalSearches > 0
        ? (this.metrics.successfulSearches / this.metrics.totalSearches) * 100
        : 0,
      topQueries: Array.from(this.metrics.popularQueries.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([query, count]) => ({ query, count })),
    };
  }
}

// Use in controller
@Post('search')
async search(@Body() searchDto: WebSearchDto, @Request() req: any) {
  const start = performance.now();
  let success = false;
  let resultCount = 0;

  try {
    const result = await this.webSearchAgentService.search(/* ... */);
    success = result.success;
    resultCount = result.results?.length || 0;
    return result;
  } finally {
    const latency = performance.now() - start;
    this.metricsService.recordSearch(
      searchDto.query,
      searchDto.processor || 'lite',
      searchDto.maxResults || 10,
      success,
      latency,
      resultCount,
    );
  }
}

// Add metrics endpoint
@Get('metrics')
@UseGuards(AuthGuard('jwt'), AdminGuard)
getMetrics() {
  return this.metricsService.getMetrics();
}
```

---

## 3. Medium Priority Issues 🟠

### 3.1 Service Layer Too Thin

**Location:** `WebSearchAgentService`

**Issue:** Just a wrapper with no business logic

**Recommendation:**
```typescript
async search(
  query: string,
  processor?: ProcessorType,
  searchDepth?: SearchDepth,
  maxResults?: number,
  includeExcerpts?: boolean,
): Promise<any> {
  // Additional validation
  if (!query || query.trim().length < 3) {
    throw new BadRequestException('Query too short (minimum 3 characters)');
  }

  if (maxResults && (maxResults < 1 || maxResults > 50)) {
    throw new BadRequestException('maxResults must be between 1 and 50');
  }

  // Check cache
  const cacheKey = this.generateCacheKey(query, processor, searchDepth, maxResults, includeExcerpts);
  const cached = await this.cacheManager.get(cacheKey);
  if (cached) return cached;

  // Retry logic
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await this.executeSearch(query, processor, searchDepth, maxResults, includeExcerpts);
      
      // Cache on success
      if (result.success) {
        const ttl = this.getCacheTTL(query);
        await this.cacheManager.set(cacheKey, result, ttl);
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      this.logger.warn(`Search attempt ${attempt} failed:`, error);
      
      if (attempt < 2) {
        await this.sleep(500); // Brief retry delay
      }
    }
  }

  throw lastError || new Error('Search failed');
}

private async executeSearch(/* ... */) {
  // Actual tool execution
}

private sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

### 3.2 Hardcoded Processor Metadata

**Location:** `getProcessors()` endpoint

**Issue:** Costs and latencies hardcoded

**Recommendation:**
```typescript
// config/web-search-processors.config.ts
export const WEB_SEARCH_PROCESSOR_CONFIG = {
  lite: {
    name: 'lite',
    description: process.env.WS_LITE_DESCRIPTION || 
      'Fast and cost-effective processor. Low latency (5-60 seconds).',
    latency: {
      min: parseInt(process.env.WS_LITE_LATENCY_MIN || '5'),
      max: parseInt(process.env.WS_LITE_LATENCY_MAX || '60'),
    },
    cost: {
      perThousand: parseFloat(process.env.WS_LITE_COST || '5'),
      perRequest: parseFloat(process.env.WS_LITE_COST || '5') / 1000,
      currency: 'USD',
    },
    useCase: 'Basic searches, quick information retrieval',
  },
  base: {
    name: 'base',
    description: process.env.WS_BASE_DESCRIPTION || 
      'Reliable standard enrichments processor. More comprehensive results.',
    latency: {
      min: parseInt(process.env.WS_BASE_LATENCY_MIN || '15'),
      max: parseInt(process.env.WS_BASE_LATENCY_MAX || '100'),
    },
    cost: {
      perThousand: parseFloat(process.env.WS_BASE_COST || '10'),
      perRequest: parseFloat(process.env.WS_BASE_COST || '10') / 1000,
      currency: 'USD',
    },
    useCase: 'Comprehensive searches, detailed analysis',
  },
};

// In controller
@Get('processors')
getProcessors() {
  return {
    processors: Object.values(WEB_SEARCH_PROCESSOR_CONFIG).map(proc => ({
      name: proc.name,
      description: proc.description,
      latency: `${proc.latency.min}-${proc.latency.max} seconds`,
      cost: `$${proc.cost.perThousand} per 1,000 runs ($${proc.cost.perRequest.toFixed(3)} per request)`,
      useCase: proc.useCase,
    })),
  };
}
```

---

### 3.3 No Request Size Limits

**Location:** Controller endpoints

**Issue:** No global request body size limit

**Recommendation:**
```typescript
// In main.ts
app.use(json({ limit: '50kb' })); // Web search needs smaller limit

// Or in module
@Module({
  imports: [
    // ...
  ],
})
export class WebSearchAgentModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(json({ limit: '50kb' }))
      .forRoutes(WebSearchAgentController);
  }
}
```

---

## 4. Production Deployment Checklist ✅

### Pre-Deployment (Critical)
- [ ] **Add authentication** - JWT-based user authentication
- [ ] **Implement rate limiting** - 30/min, 500/hour, 5000/day
- [ ] **Add input validation** - Query length limits (3-500 chars)
- [ ] **Add tier-based maxResults limits** - Free: 10, Premium: 50
- [ ] **Implement proper error handling** - Don't leak internals
- [ ] **Add request size limits** - 50KB max
- [ ] **Configure timeouts** - 2 min for POST, 2.5 min for SSE
- [ ] **Simplify API** - Remove processor/searchDepth confusion

### Configuration
- [ ] Environment variables for all settings
- [ ] Redis for caching (short TTL for fresh results)
- [ ] Redis for rate limiting
- [ ] Processor configs (pricing, latency)
- [ ] Cache TTL based on query type
- [ ] Timeout configurations

### Monitoring
- [ ] Request rate metrics
- [ ] Success/failure rates
- [ ] Processor usage distribution
- [ ] Average latency tracking
- [ ] Cost estimation per request
- [ ] Popular queries tracking
- [ ] Result distribution (how many results returned)
- [ ] Cache hit/miss rates

### Documentation
- [ ] API documentation with examples
- [ ] Authentication setup guide
- [ ] Rate limit policies
- [ ] Error code reference
- [ ] Processor selection guide
- [ ] Best practices (query optimization)
- [ ] Tier comparison (free vs premium)

---

## 5. Summary & Priority Actions

### Immediate Actions (Week 1) 🔴
1. **Add authentication** - Secure all endpoints
2. **Implement rate limiting** - Prevent scraping/abuse
3. **Add query validation** - 3-500 character limits
4. **Fix SSE parameter validation** - Use proper pipes/DTOs
5. **Add tier-based maxResults limits** - Control resource usage

### Short-term Actions (Week 2-4) 🟡
1. **Implement caching** - TTL based on query type
2. **Add timeouts** - Server-side timeout enforcement
3. **Enhance service layer** - Add retry logic, validation
4. **Add metrics collection** - Track usage, popular queries
5. **Simplify API** - Remove processor/searchDepth confusion
6. **Fix error handling** - Safe error messages

### Medium-term Actions (Month 2-3) 🟢
1. **Add request size limits** - Prevent large payloads
2. **Configure processors** - Environment-based config
3. **Performance monitoring** - Latency, cache effectiveness
4. **Query analytics** - Track popular searches, optimize
5. **Documentation** - Comprehensive API guides

---

## 6. Estimated Impact

### Before Improvements:
- **Security:** Open to public abuse
- **Scalability:** Vulnerable to scraping
- **Reliability:** No retries, caching
- **Cost Control:** None (but low per-request cost)
- **Observability:** Basic logging only

### After Improvements:
- **Security:** Authenticated, rate-limited
- **Scalability:** 1000+ concurrent users
- **Reliability:** Retry logic, caching, graceful failures
- **Cost Control:** Tier-based limits, usage tracking
- **Observability:** Full metrics, popular query tracking

---

## Conclusion

The Web Search feature is **LOWER FINANCIAL RISK** than other endpoints due to low per-request costs ($0.005-$0.01), but still **REQUIRES PRODUCTION HARDENING** to prevent abuse and ensure reliability.

**Key Advantages:**
- ✅ **Lowest cost** - $0.01 max per request
- ✅ **Fastest execution** - 5-100 seconds
- ✅ **Good validation** - maxResults has Min/Max decorators
- ✅ **Reasonable defaults** - maxResults defaults to 10

**Critical Gaps:**
1. **No authentication** - completely open
2. **No rate limiting** - vulnerable to scraping
3. **No query length limits** - memory/abuse risk
4. **Manual type coercion** - SSE params not validated
5. **API confusion** - processor vs searchDepth overlap

**Recommended Approach:**
1. **Immediately** add auth + rate limiting (prevent scraping)
2. **Immediately** add query validation (3-500 chars)
3. Then add caching (with smart TTL based on query type)
4. Add metrics to track popular queries
5. Simplify API (remove processor/searchDepth confusion)

**Estimated Effort:**
- Critical security fixes: 1 week (1 senior developer)
- Full production-ready: 2-3 weeks (1-2 developers)
- With analytics and optimization: 4 weeks

**Risk Assessment:**
While financially less risky than ultra-deep-research, web search is **highly abuse-prone** due to its nature as a search API. Without rate limiting and auth, it could be used as a free proxy for web scraping at scale.

---

**Report Generated:** December 9, 2025  
**Feature:** Web Search Agent  
**Next Steps:** Implement authentication and rate limiting across all features
