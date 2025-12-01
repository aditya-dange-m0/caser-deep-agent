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
import { UltraDeepResearchAgentService } from './services/ultra-deep-research-agent.service';
import { UltraDeepResearchStreamingService } from './services/ultra-deep-research-streaming.service';
import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';

export enum ProcessorType {
  PRO = 'pro',
  ULTRA = 'ultra',
  ULTRA2X = 'ultra2x',
  ULTRA4X = 'ultra4x',
  ULTRA8X = 'ultra8x',
}

export class UltraDeepResearchDto {
  @ApiProperty({
    description:
      'The research query or topic to investigate with maximum depth',
    example:
      'exhaustive analysis of global climate change mitigation strategies',
  })
  @IsString()
  query!: string;

  @ApiProperty({
    description:
      'Processor to use: pro, ultra, ultra2x, ultra4x, or ultra8x (increasing depth and quality)',
    enum: ProcessorType,
    required: false,
    default: ProcessorType.PRO,
    example: ProcessorType.ULTRA,
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

export class UltraDeepResearchResponseDto {
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

@ApiTags('ultra-deep-research')
@Controller('api/ultra-deep-research')
export class UltraDeepResearchAgentController {
  private readonly logger = new Logger(UltraDeepResearchAgentController.name);

  constructor(
    private readonly ultraDeepResearchAgentService: UltraDeepResearchAgentService,
    private readonly streamingService: UltraDeepResearchStreamingService,
  ) {}

  @Post('research')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Perform ultra deep research',
    description:
      'Performs ultra-comprehensive deep research using the Parallel AI Task API with pro, ultra, ultra2x, ultra4x, or ultra8x processors. Ideal for the most thorough research tasks requiring maximum depth and quality.',
  })
  @ApiBody({ type: UltraDeepResearchDto })
  @ApiResponse({
    status: 200,
    description: 'Research completed successfully',
    type: UltraDeepResearchResponseDto,
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
    @Body() researchDto: UltraDeepResearchDto,
  ): Promise<UltraDeepResearchResponseDto> {
    this.logger.log(
      `[Research] POST request received - Query: "${researchDto.query.substring(0, 100)}${researchDto.query.length > 100 ? '...' : ''}", Processor: ${researchDto.processor || 'pro'}`,
    );
    try {
      const result = await this.ultraDeepResearchAgentService.research(
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
    summary: 'Perform ultra deep research (GET)',
    description:
      'Performs ultra deep research using query parameters. Same functionality as POST endpoint.',
  })
  @ApiQuery({ name: 'query', description: 'Research query', required: true })
  @ApiQuery({
    name: 'processor',
    enum: ProcessorType,
    required: false,
    description: 'Processor type: pro, ultra, ultra2x, ultra4x, or ultra8x',
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
    type: UltraDeepResearchResponseDto,
  })
  async researchGet(
    @Query('query') query: string,
    @Query('processor') processor?: ProcessorType,
    @Query('includeAnalysis') includeAnalysis?: string,
  ): Promise<UltraDeepResearchResponseDto> {
    this.logger.log(
      `[Research] GET request received - Query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}", Processor: ${processor || 'pro'}`,
    );
    try {
      const result = await this.ultraDeepResearchAgentService.research(
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
    summary: 'Stream ultra deep research progress (Server-Sent Events)',
    description:
      'Performs ultra deep research and streams real-time progress updates via Server-Sent Events (SSE). ' +
      'Ideal for long-running research tasks where you want to show progress to users.',
  })
  @ApiQuery({
    name: 'query',
    description:
      'The research query or topic to investigate with maximum depth',
    required: true,
    example:
      'exhaustive analysis of global climate change mitigation strategies',
  })
  @ApiQuery({
    name: 'processor',
    enum: ProcessorType,
    required: false,
    description:
      'Processor type: pro, ultra, ultra2x, ultra4x, or ultra8x (increasing depth and quality)',
    example: ProcessorType.PRO,
  })
  @ApiResponse({
    status: 200,
    description: 'Server-Sent Events stream of ultra deep research progress',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example:
            'data: {"type":"connected","data":{"message":"Connected, starting ultra deep research...","query":"your query","processor":"pro"}}\n\ndata: {"type":"task_run.state","data":{"run":{"status":"running"}}}\n\n',
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
      `[Stream] SSE stream request received - Query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}", Processor: ${processor || ProcessorType.PRO}`,
    );
    if (!query) {
      this.logger.warn(
        '[Stream] SSE stream request rejected: Query parameter is missing',
      );
      throw new BadRequestException('Query parameter is required');
    }
    this.logger.debug(
      `[Stream] Returning SSE observable for ultra deep research`,
    );
    return this.streamingService.streamResearchObservable(
      query,
      processor || ProcessorType.PRO,
    );
  }

  @Get('processors')
  @ApiOperation({
    summary: 'Get available processors',
    description:
      'Returns information about available processors (pro, ultra, ultra2x, ultra4x, ultra8x)',
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
          name: 'pro',
          description:
            'High-quality processor. Provides thorough research with maximum analysis and depth.',
          latency: '60-180 seconds',
          cost: '$50 per 1,000 runs',
          useCase: 'Thorough research, high-quality analysis',
        },
        {
          name: 'ultra',
          description:
            'Ultra processor. Provides maximum depth and quality for exhaustive research.',
          latency: '120-300 seconds',
          cost: '$100 per 1,000 runs',
          useCase: 'Ultra-comprehensive research, maximum depth',
        },
        {
          name: 'ultra2x',
          description:
            'Ultra 2x processor. Provides even greater depth and analytical sophistication.',
          latency: '180-450 seconds',
          cost: '$200 per 1,000 runs',
          useCase: 'Exhaustive research, maximum analytical depth',
        },
        {
          name: 'ultra4x',
          description:
            'Ultra 4x processor. Provides the highest level of research depth and quality.',
          latency: '300-600 seconds',
          cost: '$400 per 1,000 runs',
          useCase: 'Most exhaustive research, highest quality',
        },
        {
          name: 'ultra8x',
          description:
            'Ultra 8x processor. Provides the absolute maximum research depth and analytical sophistication.',
          latency: '600-1200 seconds',
          cost: '$800 per 1,000 runs',
          useCase: 'Absolute maximum research depth, ultimate quality',
        },
      ],
    };
  }
}
