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
import { DeepResearchAgentService } from './services/deep-research-agent.service';
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
    description: 'Processor to use: core (balanced) or pro (high-quality analysis)',
    enum: ProcessorType,
    required: false,
    default: ProcessorType.CORE,
    example: ProcessorType.PRO,
  })
  @IsOptional()
  @IsEnum(ProcessorType)
  processor?: ProcessorType;

  @ApiProperty({
    description: 'Output format: auto (structured JSON) or text (markdown report)',
    enum: ['auto', 'text'],
    required: false,
    default: 'auto',
    example: 'auto',
  })
  @IsOptional()
  @IsEnum(['auto', 'text'])
  outputFormat?: 'auto' | 'text';
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

  @ApiProperty({ description: 'Error message if research failed', required: false })
  error?: string;
}

@ApiTags('deep-research')
@Controller('api/deep-research')
export class DeepResearchAgentController {
  constructor(
    private readonly deepResearchAgentService: DeepResearchAgentService,
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
  async research(@Body() researchDto: DeepResearchDto): Promise<DeepResearchResponseDto> {
    return await this.deepResearchAgentService.research(
      researchDto.query,
      researchDto.processor,
      researchDto.outputFormat,
    );
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
    name: 'outputFormat',
    enum: ['auto', 'text'],
    required: false,
    description: 'Output format: auto (structured JSON) or text (markdown)',
  })
  @ApiResponse({
    status: 200,
    description: 'Research completed successfully',
    type: DeepResearchResponseDto,
  })
  async researchGet(
    @Query('query') query: string,
    @Query('processor') processor?: ProcessorType,
    @Query('outputFormat') outputFormat?: 'auto' | 'text',
  ): Promise<DeepResearchResponseDto> {
    return await this.deepResearchAgentService.research(
      query,
      processor,
      outputFormat,
    );
  }

  @Get('processors')
  @ApiOperation({
    summary: 'Get available processors',
    description: 'Returns information about available processors (core and pro)',
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

