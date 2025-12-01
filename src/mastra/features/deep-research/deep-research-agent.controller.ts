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
import { Observable } from 'rxjs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
  ApiProperty,
} from '@nestjs/swagger';
import { DeepResearchAgentService } from './services/deep-research-agent.service';
import { DeepResearchStreamingService } from './services/deep-research-streaming.service';
import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';

export enum ProcessorType {
  CORE = 'core',
  PRO = 'pro',
}

export class DeepResearchDto {
  @ApiProperty({
    description: 'The research query or topic to investigate deeply',
    example: 'comprehensive analysis of quantum computing applications',
  })
  @IsString()
  query!: string;

  @ApiProperty({
    description:
      'Processor to use: core (balanced) or pro (high-quality analysis)',
    enum: ProcessorType,
    required: false,
    default: ProcessorType.CORE,
    example: ProcessorType.PRO,
  })
  @IsOptional()
  @IsEnum(ProcessorType)
  processor?: ProcessorType;

  @ApiProperty({
    description:
      'Include detailed analysis and insights in the research output',
    default: true,
    required: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  includeAnalysis?: boolean;
}

export class DeepResearchResponseDto {
  @ApiProperty({ description: 'Whether the research was successful' })
  success!: boolean;

  @ApiProperty({
    description: 'Research report content',
    required: false,
  })
  research?: any;

  @ApiProperty({ description: 'Summary of the research', required: false })
  summary?: any;

  @ApiProperty({
    description: 'Error message if research failed',
    required: false,
  })
  error?: string;
}

@ApiTags('deep-research')
@Controller('api/deep-research')
export class DeepResearchAgentController {
  private readonly logger = new Logger(DeepResearchAgentController.name);

  constructor(
    private readonly deepResearchAgentService: DeepResearchAgentService,
    private readonly streamingService: DeepResearchStreamingService,
  ) {}

  @Post('research')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Perform deep research',
    description:
      'Performs comprehensive deep research using the Parallel AI Task API with core or pro processors. Ideal for thorough research tasks requiring high-quality analysis.',
  })
  @ApiBody({ type: DeepResearchDto })
  @ApiResponse({
    status: 200,
    description: 'Research completed successfully',
    type: DeepResearchResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async research(
    @Body() researchDto: DeepResearchDto,
  ): Promise<DeepResearchResponseDto> {
    this.logger.log(
      `[Research] POST request received - Query: "${researchDto.query.substring(0, 100)}${researchDto.query.length > 100 ? '...' : ''}", Processor: ${researchDto.processor || 'core'}`,
    );

    try {
      const result = await this.deepResearchAgentService.research(
        researchDto.query,
        researchDto.processor,
        researchDto.includeAnalysis,
      );

      this.logger.log(`[Research] POST request completed successfully`);
      return result;
    } catch (error) {
      this.logger.error(`[Research] POST request failed:`, error);
      throw error;
    }
  }

  @Get('research')
  @ApiOperation({
    summary: 'Perform deep research (GET)',
    description:
      'Performs deep research using query parameters. Same functionality as POST endpoint.',
  })
  @ApiQuery({ name: 'query', description: 'Research query', required: true })
  @ApiQuery({
    name: 'processor',
    enum: ProcessorType,
    required: false,
    description: 'Processor type: core or pro',
  })
  @ApiQuery({
    name: 'includeAnalysis',
    required: false,
    type: Boolean,
    description: 'Include detailed analysis',
  })
  @ApiResponse({
    status: 200,
    description: 'Research completed successfully',
    type: DeepResearchResponseDto,
  })
  async researchGet(
    @Query('query') query: string,
    @Query('processor') processor?: ProcessorType,
    @Query('includeAnalysis') includeAnalysis?: string,
  ): Promise<DeepResearchResponseDto> {
    this.logger.log(
      `[Research] GET request received - Query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}", Processor: ${processor || 'core'}`,
    );

    try {
      const result = await this.deepResearchAgentService.research(
        query,
        processor,
        includeAnalysis
          ? includeAnalysis === 'true' || includeAnalysis === '1'
          : undefined,
      );

      this.logger.log(`[Research] GET request completed successfully`);
      return result;
    } catch (error) {
      this.logger.error(`[Research] GET request failed:`, error);
      throw error;
    }
  }

  @Get('research/stream')
  @Sse()
  @ApiOperation({
    summary: 'Stream deep research progress (Server-Sent Events)',
    description:
      'Performs deep research and streams real-time progress updates via Server-Sent Events (SSE). ' +
      'Ideal for long-running research tasks where you want to show progress to users.',
  })
  @ApiQuery({
    name: 'query',
    description: 'The research query or topic to investigate deeply',
    required: true,
    example: 'comprehensive analysis of quantum computing applications',
  })
  @ApiQuery({
    name: 'processor',
    enum: ProcessorType,
    required: false,
    description:
      'Processor type: core (balanced) or pro (high-quality analysis)',
    example: ProcessorType.CORE,
  })
  @ApiResponse({
    status: 200,
    description: 'Server-Sent Events stream of deep research progress',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example:
            'data: {"type":"connected","data":{"message":"Connected, starting deep research...","query":"your query","processor":"core"}}\n\ndata: {"type":"task_run.state","data":{"run":{"status":"running"}}}\n\n',
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
  streamResearch(
    @Query('query') query: string,
    @Query('processor') processor?: ProcessorType,
  ): Observable<MessageEvent> {
    this.logger.log(
      `[Stream] SSE stream request received - Query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}", Processor: ${processor || ProcessorType.CORE}`,
    );

    if (!query) {
      this.logger.warn(
        '[Stream] SSE stream request rejected: Query parameter is missing',
      );
      throw new BadRequestException('Query parameter is required');
    }

    this.logger.debug(`[Stream] Returning SSE observable for deep research`);

    return this.streamingService.streamResearchObservable(
      query,
      processor || ProcessorType.CORE,
    );
  }

  @Get('processors')
  @ApiOperation({
    summary: 'Get available processors',
    description:
      'Returns information about available processors (core and pro)',
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
          name: 'core',
          description:
            'Balanced processor. Provides comprehensive research with good depth and quality.',
          latency: '30-120 seconds',
          cost: '$20 per 1,000 runs',
          useCase: 'Comprehensive research, balanced depth',
        },
        {
          name: 'pro',
          description:
            'High-quality processor. Provides thorough research with maximum analysis and depth.',
          latency: '60-180 seconds',
          cost: '$50 per 1,000 runs',
          useCase: 'Thorough research, high-quality analysis',
        },
      ],
    };
  }
}
