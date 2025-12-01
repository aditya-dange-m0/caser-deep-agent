import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Sse,
  MessageEvent,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
  ApiProperty,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { WebSearchAgentService } from './services/web-search-agent.service';
import { WebSearchStreamingService } from './services/web-search-streaming.service';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ProcessorType {
  LITE = 'lite',
  BASE = 'base',
}

export enum SearchDepth {
  BASIC = 'basic',
  ADVANCED = 'advanced',
}

export class WebSearchDto {
  @ApiProperty({
    description: 'The search query or question to search for on the web',
    example: 'digital twins latest developments 2024',
  })
  @IsString()
  query!: string;

  @ApiProperty({
    description:
      'Processor to use: lite (faster, cost-effective) or base (more comprehensive)',
    enum: ProcessorType,
    required: false,
    example: ProcessorType.BASE,
  })
  @IsOptional()
  @IsEnum(ProcessorType)
  processor?: ProcessorType;

  @ApiProperty({
    description:
      'Search depth level - basic uses lite processor, advanced uses base processor. Ignored if processor is explicitly set.',
    enum: SearchDepth,
    required: false,
    default: SearchDepth.BASIC,
    example: SearchDepth.ADVANCED,
  })
  @IsOptional()
  @IsEnum(SearchDepth)
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
  @IsNumber()
  @Min(1)
  @Max(50)
  maxResults?: number;

  @ApiProperty({
    description: 'Include detailed excerpts from search results',
    default: true,
    required: false,
    example: true,
  })
  @IsOptional()
  includeExcerpts?: boolean;
}

export class WebSearchResponseDto {
  @ApiProperty({ description: 'Whether the search was successful' })
  success!: boolean;

  @ApiProperty({
    description: 'Array of search results',
    type: [Object],
    required: false,
  })
  results?: any[];

  @ApiProperty({ description: 'Summary of the search', required: false })
  summary?: any;

  @ApiProperty({
    description: 'Error message if search failed',
    required: false,
  })
  error?: string;
}

@ApiTags('web-search')
@Controller('api/web-search')
export class WebSearchAgentController {
  private readonly logger = new Logger(WebSearchAgentController.name);

  constructor(
    private readonly webSearchAgentService: WebSearchAgentService,
    private readonly streamingService: WebSearchStreamingService,
  ) {}

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Perform a web search',
    description:
      'Performs a comprehensive web search using the Parallel AI Task API with lite or base processors. Returns relevant, up-to-date information from the web with excerpts and source URLs.',
  })
  @ApiBody({ type: WebSearchDto })
  @ApiResponse({
    status: 200,
    description: 'Search completed successfully',
    type: WebSearchResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async search(@Body() searchDto: WebSearchDto): Promise<WebSearchResponseDto> {
    this.logger.log(
      `[Search] POST request received - Query: "${searchDto.query.substring(0, 100)}${searchDto.query.length > 100 ? '...' : ''}", Processor: ${searchDto.processor || 'lite'}`,
    );
    try {
      const result = await this.webSearchAgentService.search(
        searchDto.query,
        searchDto.processor,
        searchDto.searchDepth,
        searchDto.maxResults,
        searchDto.includeExcerpts,
      );
      this.logger.log(`[Search] POST request completed successfully`);
      return result;
    } catch (error) {
      this.logger.error(`[Search] POST request failed:`, error);
      throw error;
    }
  }

  @Get('search')
  @ApiOperation({
    summary: 'Perform a web search (GET)',
    description:
      'Performs a web search using query parameters. Same functionality as POST endpoint.',
  })
  @ApiQuery({ name: 'query', description: 'Search query', required: true })
  @ApiQuery({
    name: 'processor',
    enum: ProcessorType,
    required: false,
    description: 'Processor type: lite or base',
  })
  @ApiQuery({
    name: 'searchDepth',
    enum: SearchDepth,
    required: false,
    description: 'Search depth: basic or advanced',
  })
  @ApiQuery({
    name: 'maxResults',
    required: false,
    type: Number,
    description: 'Maximum number of results (1-50)',
  })
  @ApiQuery({
    name: 'includeExcerpts',
    required: false,
    type: Boolean,
    description: 'Include detailed excerpts',
  })
  @ApiResponse({
    status: 200,
    description: 'Search completed successfully',
    type: WebSearchResponseDto,
  })
  async searchGet(
    @Query('query') query: string,
    @Query('processor') processor?: ProcessorType,
    @Query('searchDepth') searchDepth?: SearchDepth,
    @Query('maxResults') maxResults?: string,
    @Query('includeExcerpts') includeExcerpts?: string,
  ): Promise<WebSearchResponseDto> {
    this.logger.log(
      `[Search] GET request received - Query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}", Processor: ${processor || 'lite'}`,
    );
    try {
      const result = await this.webSearchAgentService.search(
        query,
        processor,
        searchDepth,
        maxResults ? Number(maxResults) : undefined,
        includeExcerpts
          ? includeExcerpts === 'true' || includeExcerpts === '1'
          : undefined,
      );
      this.logger.log(`[Search] GET request completed successfully`);
      return result;
    } catch (error) {
      this.logger.error(`[Search] GET request failed:`, error);
      throw error;
    }
  }

  @Get('search/stream')
  @Sse()
  @ApiOperation({
    summary: 'Stream web search progress (Server-Sent Events)',
    description:
      'Performs a web search and streams real-time progress updates via Server-Sent Events (SSE). ' +
      'Ideal for search tasks where you want to show progress to users.',
  })
  @ApiQuery({
    name: 'query',
    description: 'The search query or question to search for on the web',
    required: true,
    example: 'digital twins latest developments 2024',
  })
  @ApiQuery({
    name: 'processor',
    enum: ProcessorType,
    required: false,
    description:
      'Processor type: lite (faster, cost-effective) or base (more comprehensive)',
    example: ProcessorType.BASE,
  })
  @ApiQuery({
    name: 'maxResults',
    required: false,
    type: Number,
    description: 'Maximum number of results (1-50)',
    example: 10,
  })
  @ApiQuery({
    name: 'includeExcerpts',
    required: false,
    type: Boolean,
    description: 'Include detailed excerpts from search results',
    example: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Server-Sent Events stream of web search progress',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example:
            'data: {"type":"connected","data":{"message":"Connected, starting web search...","query":"your query","processor":"lite","maxResults":10}}\n\ndata: {"type":"task_run.state","data":{"run":{"status":"running"}}}\n\n',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters (missing query)',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error during streaming',
  })
  streamSearch(
    @Query('query') query: string,
    @Query('processor') processor?: ProcessorType,
    @Query('maxResults') maxResults?: string,
    @Query('includeExcerpts') includeExcerpts?: string,
  ): Observable<MessageEvent> {
    this.logger.log(
      `[Stream] SSE stream request received - Query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}", Processor: ${processor || ProcessorType.LITE}`,
    );
    if (!query) {
      this.logger.warn(
        '[Stream] SSE stream request rejected: Query parameter is missing',
      );
      throw new BadRequestException('Query parameter is required');
    }
    const maxResultsNum = maxResults ? Number(maxResults) : 10;
    const includeExcerptsBool = includeExcerpts
      ? includeExcerpts === 'true' || includeExcerpts === '1'
      : true;

    // Determine processor based on query param or default to lite
    const finalProcessor = processor || ProcessorType.LITE;

    this.logger.debug(`[Stream] Returning SSE observable for web search`);
    return this.streamingService.streamSearchObservable(
      query,
      finalProcessor,
      maxResultsNum,
      includeExcerptsBool,
    );
  }

  @Get('processors')
  @ApiOperation({
    summary: 'Get available processors',
    description:
      'Returns information about available processors (lite and base)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of available processors',
    schema: {
      type: 'object',
      properties: {
        processors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              latency: { type: 'string' },
              cost: { type: 'string' },
              useCase: { type: 'string' },
            },
          },
        },
      },
    },
  })
  getProcessors() {
    return {
      processors: [
        {
          name: 'lite',
          description:
            'Fast and cost-effective processor. Low latency (5-60 seconds), suitable for simple tasks with approximately two output fields.',
          latency: '5-60 seconds',
          cost: '$5 per 1,000 runs',
          useCase: 'Basic searches, quick information retrieval',
        },
        {
          name: 'base',
          description:
            'Reliable standard enrichments processor. Provides more comprehensive results with around five output fields.',
          latency: '15-100 seconds',
          cost: '$10 per 1,000 runs',
          useCase: 'Comprehensive searches, detailed analysis',
        },
      ],
    };
  }
}
