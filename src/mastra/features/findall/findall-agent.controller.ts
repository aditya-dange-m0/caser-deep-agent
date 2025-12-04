import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
  ApiParam,
  ApiProperty,
} from '@nestjs/swagger';
import { FindAllAgentService, GeneratorType } from './services/findall-agent.service';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  Min,
  Max,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MatchConditionDto {
  @ApiProperty({
    description: 'Name of the match condition',
    example: 'khosla_ventures_portfolio_check',
  })
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'Description of what the condition checks',
    example: 'Company must be a portfolio company of Khosla Ventures.',
  })
  @IsString()
  description!: string;
}

export class FindAllIngestDto {
  @ApiProperty({
    description:
      'Natural language query describing what entities to find (e.g., "FindAll portfolio companies of Khosla Ventures founded after 2020")',
    example: 'FindAll portfolio companies of Khosla Ventures founded after 2020',
  })
  @IsString()
  objective!: string;
}

export class FindAllRunDto {
  @ApiProperty({
    description:
      'Natural language query describing what entities to find (e.g., "FindAll portfolio companies of Khosla Ventures founded after 2020")',
    example: 'FindAll portfolio companies of Khosla Ventures founded after 2020',
  })
  @IsString()
  objective!: string;

  @ApiProperty({
    description:
      'Generator to use: base (faster, cost-effective), core (balanced), or pro (high-quality)',
    enum: GeneratorType,
    required: false,
    default: GeneratorType.CORE,
    example: GeneratorType.CORE,
  })
  @IsOptional()
  @IsEnum(GeneratorType)
  generator?: GeneratorType;

  @ApiProperty({
    description: 'Maximum number of matched candidates to return',
    minimum: 1,
    maximum: 100,
    default: 10,
    required: false,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  match_limit?: number;

  @ApiProperty({
    description:
      'Type of entities to search for (e.g., "companies", "people", "products"). If not provided, will be extracted from objective.',
    required: false,
    example: 'companies',
  })
  @IsOptional()
  @IsString()
  entity_type?: string;

  @ApiProperty({
    description:
      'Array of match conditions that must be satisfied. If not provided, will be extracted from objective via ingest.',
    type: [MatchConditionDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MatchConditionDto)
  match_conditions?: MatchConditionDto[];

  @ApiProperty({
    description:
      'Optional array of enrichment fields to extract for matched candidates',
    type: [String],
    required: false,
    example: ['founding_date', 'funding_amount'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enrichments?: string[];
}

export class FindAllCompleteDto {
  @ApiProperty({
    description:
      'Natural language query describing what entities to find (e.g., "FindAll portfolio companies of Khosla Ventures founded after 2020")',
    example: 'FindAll portfolio companies of Khosla Ventures founded after 2020',
  })
  @IsString()
  objective!: string;

  @ApiProperty({
    description:
      'Generator to use: base (faster, cost-effective), core (balanced), or pro (high-quality)',
    enum: GeneratorType,
    required: false,
    default: GeneratorType.CORE,
    example: GeneratorType.CORE,
  })
  @IsOptional()
  @IsEnum(GeneratorType)
  generator?: GeneratorType;

  @ApiProperty({
    description: 'Maximum number of matched candidates to return',
    minimum: 1,
    maximum: 100,
    default: 10,
    required: false,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  match_limit?: number;

  @ApiProperty({
    description:
      'Optional array of enrichment fields to extract for matched candidates',
    type: [String],
    required: false,
    example: ['founding_date', 'funding_amount'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enrichments?: string[];

  @ApiProperty({
    description: 'Maximum time to wait for completion in seconds',
    minimum: 10,
    maximum: 1800,
    default: 900,
    required: false,
    example: 900,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(10)
  @Max(1800)
  max_wait_seconds?: number;
}

export class FindAllResultsDto {
  @ApiProperty({
    description: 'Whether to wait for the run to complete if it is still in progress',
    default: true,
    required: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  wait_for_completion?: boolean;

  @ApiProperty({
    description: 'Maximum time to wait for completion in seconds',
    minimum: 10,
    maximum: 1800,
    default: 900,
    required: false,
    example: 900,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(10)
  @Max(1800)
  max_wait_seconds?: number;
}

export class FindAllResponseDto {
  @ApiProperty({ description: 'Whether the operation was successful' })
  success!: boolean;

  @ApiProperty({
    description: 'FindAll run ID',
    required: false,
    example: 'findall_40e0ab8c10754be0b7a16477abb38a2f',
  })
  findall_id?: string;

  @ApiProperty({
    description: 'Structured schema from ingest',
    required: false,
  })
  objective?: string;

  @ApiProperty({
    description: 'Entity type',
    required: false,
  })
  entity_type?: string;

  @ApiProperty({
    description: 'Match conditions',
    required: false,
  })
  match_conditions?: any[];

  @ApiProperty({
    description: 'Run status',
    required: false,
  })
  status?: any;

  @ApiProperty({
    description: 'Matched candidates',
    required: false,
  })
  candidates?: any[];

  @ApiProperty({
    description: 'Progress metrics',
    required: false,
  })
  metrics?: any;

  @ApiProperty({ description: 'Error message if operation failed', required: false })
  error?: string;
}

@ApiTags('findall')
@Controller('api/findall')
export class FindAllAgentController {
  private readonly logger = new Logger(FindAllAgentController.name);

  constructor(
    private readonly findAllAgentService: FindAllAgentService,
  ) {}

  @Post('ingest')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Convert natural language query to structured schema',
    description:
      'Converts a natural language query into a structured schema with entity_type and match_conditions. This is the first step before creating a FindAll run.',
  })
  @ApiBody({ type: FindAllIngestDto })
  @ApiResponse({
    status: 200,
    description: 'Ingest completed successfully',
    type: FindAllResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async ingest(@Body() ingestDto: FindAllIngestDto): Promise<FindAllResponseDto> {
    this.logger.log(
      `[Ingest] POST request received - Objective: "${ingestDto.objective.substring(0, 100)}${ingestDto.objective.length > 100 ? '...' : ''}"`,
    );
    try {
      const result = await this.findAllAgentService.ingest(ingestDto.objective);
      this.logger.log(`[Ingest] POST request completed successfully`);
      return result;
    } catch (error) {
      this.logger.error(`[Ingest] POST request failed:`, error);
      throw error;
    }
  }

  @Post('runs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create a new FindAll run',
    description:
      'Creates a new FindAll run to discover and match entities based on the provided criteria. This starts the asynchronous FindAll process.',
  })
  @ApiBody({ type: FindAllRunDto })
  @ApiResponse({
    status: 200,
    description: 'FindAll run created successfully',
    type: FindAllResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async createRun(@Body() runDto: FindAllRunDto): Promise<FindAllResponseDto> {
    return await this.findAllAgentService.createRun(
      runDto.objective,
      runDto.generator,
      runDto.match_limit,
      runDto.entity_type,
      runDto.match_conditions,
      runDto.enrichments,
    );
  }

  @Get('runs/:findallId')
  @ApiOperation({
    summary: 'Get FindAll run status',
    description:
      'Gets the current status of a FindAll run, including progress metrics and completion status.',
  })
  @ApiParam({
    name: 'findallId',
    description: 'The FindAll run ID',
    example: 'findall_40e0ab8c10754be0b7a16477abb38a2f',
  })
  @ApiResponse({
    status: 200,
    description: 'Status retrieved successfully',
    type: FindAllResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'FindAll run not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getStatus(
    @Param('findallId') findallId: string,
  ): Promise<FindAllResponseDto> {
    return await this.findAllAgentService.getStatus(findallId);
  }

  @Get('runs/:findallId/result')
  @ApiOperation({
    summary: 'Get FindAll run results',
    description:
      'Retrieves the final results from a completed FindAll run, including matched candidates with reasoning and citations. Automatically polls for completion if the run is still in progress.',
  })
  @ApiParam({
    name: 'findallId',
    description: 'The FindAll run ID',
    example: 'findall_40e0ab8c10754be0b7a16477abb38a2f',
  })
  @ApiQuery({
    name: 'wait_for_completion',
    required: false,
    type: Boolean,
    description: 'Whether to wait for completion if run is still in progress',
  })
  @ApiQuery({
    name: 'max_wait_seconds',
    required: false,
    type: Number,
    description: 'Maximum time to wait for completion in seconds',
  })
  @ApiResponse({
    status: 200,
    description: 'Results retrieved successfully',
    type: FindAllResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'FindAll run not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getResults(
    @Param('findallId') findallId: string,
    @Query('wait_for_completion') waitForCompletion?: string,
    @Query('max_wait_seconds') maxWaitSeconds?: string,
  ): Promise<FindAllResponseDto> {
    return await this.findAllAgentService.getResults(
      findallId,
      waitForCompletion
        ? waitForCompletion === 'true' || waitForCompletion === '1'
        : true,
      maxWaitSeconds ? Number(maxWaitSeconds) : undefined,
    );
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete FindAll workflow',
    description:
      'Complete FindAll workflow: converts natural language query to schema, creates run, waits for completion, and returns results. This is a convenience endpoint that combines all FindAll steps.',
  })
  @ApiBody({ type: FindAllCompleteDto })
  @ApiResponse({
    status: 200,
    description: 'FindAll workflow completed successfully',
    type: FindAllResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async complete(@Body() completeDto: FindAllCompleteDto): Promise<FindAllResponseDto> {
    this.logger.log(
      `[Complete] POST request received - Objective: "${completeDto.objective.substring(0, 100)}${completeDto.objective.length > 100 ? '...' : ''}", Generator: ${completeDto.generator || 'core'}`,
    );
    try {
      const result = await this.findAllAgentService.complete(
        completeDto.objective,
        completeDto.generator,
        completeDto.match_limit,
        completeDto.enrichments,
        completeDto.max_wait_seconds,
      );
      this.logger.log(`[Complete] POST request completed successfully`);
      return result;
    } catch (error) {
      this.logger.error(`[Complete] POST request failed:`, error);
      throw error;
    }
  }

  @Get('generators')
  @ApiOperation({
    summary: 'Get available generators',
    description:
      'Returns information about available generators (base, core, pro)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of available generators',
    schema: {
      type: 'object',
      properties: {
        generators: {
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
  getGenerators() {
    return {
      generators: [
        {
          name: 'base',
          description:
            'Faster and cost-effective generator. Suitable for simpler queries with basic entity discovery needs.',
          latency: '5-60 seconds',
          cost: 'Lower cost per run',
          useCase: 'Simple entity discovery, basic queries',
        },
        {
          name: 'core',
          description:
            'Balanced generator providing good quality and speed. Good for most use cases with moderate complexity.',
          latency: '15-100 seconds',
          cost: 'Moderate cost per run',
          useCase: 'Most entity discovery tasks, balanced quality',
        },
        {
          name: 'pro',
          description:
            'High-quality generator providing maximum accuracy and comprehensive results. Best for complex queries requiring maximum quality.',
          latency: '30-180 seconds',
          cost: 'Higher cost per run',
          useCase: 'Complex entity discovery, maximum quality',
        },
      ],
    };
  }
}

