import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
  ApiProperty,
} from '@nestjs/swagger';
import { QuickDeepResearchAgentService } from './services/quick-deep-research-agent.service';
import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';

export enum ProcessorType {
  BASE = 'base',
  CORE = 'core',
}

export class QuickDeepResearchDto {
  @ApiProperty({
    description: 'The research query or topic to investigate deeply',
    example: 'impact of artificial intelligence on healthcare',
  })
  @IsString()
  query!: string;

  @ApiProperty({
    description: 'Processor to use: base (faster, cost-effective) or core (more comprehensive)',
    enum: ProcessorType,
    required: false,
    default: ProcessorType.BASE,
    example: ProcessorType.CORE,
  })
  @IsOptional()
  @IsEnum(ProcessorType)
  processor?: ProcessorType;

  @ApiProperty({
    description: 'Include detailed analysis and insights in the research output',
    default: true,
    required: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  includeAnalysis?: boolean;
}

export class QuickDeepResearchResponseDto {
  @ApiProperty({ description: 'Whether the research was successful' })
  success!: boolean;

  @ApiProperty({
    description: 'Research report content',
    required: false,
  })
  research?: any;

  @ApiProperty({ description: 'Summary of the research', required: false })
  summary?: any;

  @ApiProperty({ description: 'Error message if research failed', required: false })
  error?: string;
}

@ApiTags('quick-deep-research')
@Controller('api/quick-deep-research')
export class QuickDeepResearchAgentController {
  constructor(
    private readonly quickDeepResearchAgentService: QuickDeepResearchAgentService,
  ) {}

  @Post('research')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Perform quick deep research',
    description:
      'Performs quick deep research using the Parallel AI Task API with base or core processors. Ideal for faster research tasks with moderate depth.',
  })
  @ApiBody({ type: QuickDeepResearchDto })
  @ApiResponse({
    status: 200,
    description: 'Research completed successfully',
    type: QuickDeepResearchResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async research(@Body() researchDto: QuickDeepResearchDto): Promise<QuickDeepResearchResponseDto> {
    return await this.quickDeepResearchAgentService.research(
      researchDto.query,
      researchDto.processor,
      researchDto.includeAnalysis,
    );
  }

  @Get('research')
  @ApiOperation({
    summary: 'Perform quick deep research (GET)',
    description:
      'Performs quick deep research using query parameters. Same functionality as POST endpoint.',
  })
  @ApiQuery({ name: 'query', description: 'Research query', required: true })
  @ApiQuery({
    name: 'processor',
    enum: ProcessorType,
    required: false,
    description: 'Processor type: base or core',
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
    type: QuickDeepResearchResponseDto,
  })
  async researchGet(
    @Query('query') query: string,
    @Query('processor') processor?: ProcessorType,
    @Query('includeAnalysis') includeAnalysis?: string,
  ): Promise<QuickDeepResearchResponseDto> {
    return await this.quickDeepResearchAgentService.research(
      query,
      processor,
      includeAnalysis
        ? includeAnalysis === 'true' || includeAnalysis === '1'
        : undefined,
    );
  }

  @Get('processors')
  @ApiOperation({
    summary: 'Get available processors',
    description: 'Returns information about available processors (base and core)',
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
          name: 'base',
          description:
            'Faster and cost-effective processor. Suitable for quick research tasks with moderate depth.',
          latency: '15-100 seconds',
          cost: '$10 per 1,000 runs',
          useCase: 'Quick research, faster results',
        },
        {
          name: 'core',
          description:
            'More comprehensive processor. Provides deeper analysis and more thorough research.',
          latency: '30-120 seconds',
          cost: '$20 per 1,000 runs',
          useCase: 'Comprehensive research, deeper analysis',
        },
      ],
    };
  }
}

