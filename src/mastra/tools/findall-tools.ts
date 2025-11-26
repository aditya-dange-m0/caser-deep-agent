import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { config } from 'dotenv';

config();

const PARALLEL_API_KEY = process.env.PARALLEL_API_KEY;
const PARALLEL_BETA_HEADER = 'findall-2025-09-15';
const PARALLEL_API_BASE = 'https://api.parallel.ai/v1beta/findall';

// Helper function to make API requests
const makeRequest = async (
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: any,
): Promise<any> => {
  if (!PARALLEL_API_KEY) {
    throw new Error(
      'PARALLEL_API_KEY environment variable is not set. Please configure it in your .env file.',
    );
  }

  const url = `${PARALLEL_API_BASE}${endpoint}`;
  const headers: Record<string, string> = {
    'x-api-key': PARALLEL_API_KEY,
    'parallel-beta': PARALLEL_BETA_HEADER,
    'Content-Type': 'application/json',
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && method === 'POST') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `FindAll API request failed: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  return await response.json();
};

// Helper function to poll for FindAll run status
const pollFindAllStatus = async (
  findallId: string,
  maxAttempts: number = 900, // 15 minutes max (900 * 1 second)
  interval: number = 1000, // 1 second
): Promise<any> => {
  let lastStatus: any = null;
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const status = await makeRequest(`/runs/${findallId}`);
      lastStatus = status;

      // Check if run is completed - check both status and is_active flag
      const isCompleted =
        status.status?.status === 'completed' ||
        status.status?.status === 'failed' ||
        status.status?.is_active === false;

      if (isCompleted) {
        console.log(`FindAll run completed on attempt ${i + 1}/${maxAttempts}`);
        return status;
      }

      // Log progress every 10 attempts
      if (i === 0 || (i % 10 === 0 && i > 0)) {
        console.log(
          `Polling attempt ${i + 1}/${maxAttempts} for FindAll ID: ${findallId}`,
        );
        console.log(`Status: ${status.status?.status || 'unknown'}`);
        console.log(`Is Active: ${status.status?.is_active ?? 'unknown'}`);
        if (status.status?.metrics) {
          console.log(`Metrics:`, status.status.metrics);
        }
      }

      // Wait before next attempt
      if (i < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Polling attempt ${i + 1} failed:`, errorMsg);

      // If it's the last attempt, return the last known status instead of throwing
      // This allows us to still try fetching results
      if (i === maxAttempts - 1) {
        console.warn(
          `Polling timeout reached, but will attempt to fetch results anyway. Last status:`,
          lastStatus?.status?.status || 'unknown',
        );
        return lastStatus;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  // If we get here, we've exhausted all attempts
  // Return the last status so caller can still try to fetch results
  console.warn(
    `FindAll run polling timeout: Maximum attempts (${maxAttempts}) exceeded for FindAll ID: ${findallId}. Will attempt to fetch results anyway.`,
  );
  return lastStatus;
};

// Ingest tool - converts natural language to structured schema
export const findAllIngestTool = createTool({
  id: 'findAllIngest',
  description:
    'Converts a natural language query into a structured schema with entity_type and match_conditions for FindAll API. This is the first step before creating a FindAll run.',
  inputSchema: z.object({
    objective: z
      .string()
      .describe(
        'Natural language query describing what entities to find (e.g., "FindAll portfolio companies of Khosla Ventures founded after 2020")',
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    objective: z.string().optional(),
    entity_type: z.string().optional(),
    match_conditions: z.array(z.any()).optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context, mastra }) => {
    try {
      console.log('findAllIngest: Starting execution');

      const { objective } = context;

      if (!objective || typeof objective !== 'string' || objective.trim().length === 0) {
        return {
          success: false,
          error: 'Objective is required and must be a non-empty string',
        };
      }

      console.log('findAllIngest: Making ingest request', { objective });

      const result = await makeRequest('/ingest', 'POST', { objective });

      console.log('findAllIngest: Ingest completed', {
        entity_type: result.entity_type,
        match_conditions_count: result.match_conditions?.length || 0,
      });

      return {
        success: true,
        objective: result.objective,
        entity_type: result.entity_type,
        match_conditions: result.match_conditions || [],
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('findAllIngest: Error occurred', { error: errorMessage });

      mastra?.getLogger()?.error('FindAll ingest failed', {
        error: errorMessage,
        objective: context.objective,
      });

      return {
        success: false,
        error: `FindAll ingest failed: ${errorMessage}`,
      };
    }
  },
});

// Create FindAll run tool
export const findAllRunTool = createTool({
  id: 'findAllRun',
  description:
    'Creates a new FindAll run to discover and match entities based on the provided criteria. This starts the asynchronous FindAll process.',
  inputSchema: z.object({
    objective: z
      .string()
      .describe(
        'Natural language query describing what entities to find (e.g., "FindAll portfolio companies of Khosla Ventures founded after 2020")',
      ),
    entity_type: z
      .string()
      .optional()
      .describe(
        'Type of entities to search for (e.g., "companies", "people", "products"). If not provided, will be extracted from objective.',
      ),
    match_conditions: z
      .array(
        z.object({
          name: z.string().describe('Name of the match condition'),
          description: z
            .string()
            .describe('Description of what the condition checks'),
        }),
      )
      .optional()
      .describe(
        'Array of match conditions that must be satisfied. If not provided, will be extracted from objective via ingest.',
      ),
    generator: z
      .enum(['base', 'core', 'pro'])
      .optional()
      .default('core')
      .describe(
        'Generator to use: base (faster, cost-effective), core (balanced), or pro (high-quality)',
      ),
    match_limit: z
      .number()
      .optional()
      .default(10)
      .describe('Maximum number of matched candidates to return'),
    enrichments: z
      .array(z.string())
      .optional()
      .describe(
        'Optional array of enrichment fields to extract for matched candidates',
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    findall_id: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context, mastra }) => {
    try {
      console.log('findAllRun: Starting execution');

      const {
        objective,
        entity_type,
        match_conditions,
        generator = 'core',
        match_limit = 10,
        enrichments,
      } = context;

      if (!objective || typeof objective !== 'string' || objective.trim().length === 0) {
        return {
          success: false,
          error: 'Objective is required and must be a non-empty string',
        };
      }

      // If entity_type or match_conditions are not provided, use ingest to get them
      let finalEntityType = entity_type;
      let finalMatchConditions = match_conditions;

      if (!finalEntityType || !finalMatchConditions || finalMatchConditions.length === 0) {
        console.log(
          'findAllRun: Entity type or match conditions missing, calling ingest first',
        );
        try {
          const ingestResult = await makeRequest('/ingest', 'POST', { objective });
          finalEntityType = finalEntityType || ingestResult.entity_type;
          finalMatchConditions =
            finalMatchConditions || ingestResult.match_conditions || [];
        } catch (ingestError) {
          console.warn(
            'findAllRun: Ingest failed, proceeding with provided values',
            ingestError,
          );
        }
      }

      const requestBody: any = {
        objective,
        generator,
        match_limit,
      };

      if (finalEntityType) {
        requestBody.entity_type = finalEntityType;
      }

      if (finalMatchConditions && finalMatchConditions.length > 0) {
        requestBody.match_conditions = finalMatchConditions;
      }

      if (enrichments && enrichments.length > 0) {
        requestBody.enrichments = enrichments;
      }

      console.log('findAllRun: Creating FindAll run', {
        objective,
        entity_type: finalEntityType,
        generator,
        match_limit,
        match_conditions_count: finalMatchConditions?.length || 0,
      });

      const result = await makeRequest('/runs', 'POST', requestBody);

      if (!result.findall_id) {
        throw new Error('Failed to create FindAll run: No findall_id returned');
      }

      console.log('findAllRun: FindAll run created', { findall_id: result.findall_id });

      return {
        success: true,
        findall_id: result.findall_id,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('findAllRun: Error occurred', { error: errorMessage });

      mastra?.getLogger()?.error('FindAll run creation failed', {
        error: errorMessage,
        objective: context.objective,
      });

      return {
        success: false,
        error: `FindAll run creation failed: ${errorMessage}`,
      };
    }
  },
});

// Get FindAll status tool
export const findAllStatusTool = createTool({
  id: 'findAllStatus',
  description:
    'Gets the current status of a FindAll run, including progress metrics and completion status.',
  inputSchema: z.object({
    findall_id: z.string().describe('The FindAll run ID to check status for'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    findall_id: z.string().optional(),
    status: z.any().optional(),
    metrics: z.any().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context, mastra }) => {
    try {
      console.log('findAllStatus: Starting execution');

      const { findall_id } = context;

      if (!findall_id || typeof findall_id !== 'string' || findall_id.trim().length === 0) {
        return {
          success: false,
          error: 'findall_id is required and must be a non-empty string',
        };
      }

      console.log('findAllStatus: Checking status', { findall_id });

      const result = await makeRequest(`/runs/${findall_id}`);

      console.log('findAllStatus: Status retrieved', {
        status: result.status?.status,
        metrics: result.status?.metrics,
      });

      return {
        success: true,
        findall_id: result.findall_id || findall_id,
        status: result.status,
        metrics: result.status?.metrics,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('findAllStatus: Error occurred', { error: errorMessage });

      mastra?.getLogger()?.error('FindAll status check failed', {
        error: errorMessage,
        findall_id: context.findall_id,
      });

      return {
        success: false,
        error: `FindAll status check failed: ${errorMessage}`,
      };
    }
  },
});

// Get FindAll results tool
export const findAllResultsTool = createTool({
  id: 'findAllResults',
  description:
    'Retrieves the final results from a completed FindAll run, including matched candidates with reasoning and citations. Automatically polls for completion if the run is still in progress.',
  inputSchema: z.object({
    findall_id: z.string().describe('The FindAll run ID to get results for'),
    wait_for_completion: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        'Whether to wait for the run to complete if it is still in progress',
      ),
    max_wait_seconds: z
      .number()
      .optional()
      .default(900)
      .describe('Maximum time to wait for completion in seconds (default: 900 = 15 minutes)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    findall_id: z.string().optional(),
    status: z.any().optional(),
    candidates: z.array(z.any()).optional(),
    metrics: z.any().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context, mastra }) => {
    try {
      console.log('findAllResults: Starting execution');

      const {
        findall_id,
        wait_for_completion = true,
        max_wait_seconds = 300,
      } = context;

      if (!findall_id || typeof findall_id !== 'string' || findall_id.trim().length === 0) {
        return {
          success: false,
          error: 'findall_id is required and must be a non-empty string',
        };
      }

      // If waiting for completion, poll for status first
      if (wait_for_completion) {
        console.log(
          `findAllResults: Waiting for completion (max ${max_wait_seconds}s)`,
        );
        const maxAttempts = Math.floor(max_wait_seconds);
        try {
          await pollFindAllStatus(findall_id, maxAttempts, 1000);
        } catch (pollError) {
          // Even if polling times out, try to fetch results anyway
          // The results endpoint may return partial results
          console.warn(
            'Polling timeout, but attempting to fetch results anyway:',
            pollError instanceof Error ? pollError.message : String(pollError),
          );
        }
      }

      console.log('findAllResults: Fetching results', { findall_id });

      const result = await makeRequest(`/runs/${findall_id}/result`);

      console.log('findAllResults: Results retrieved', {
        status: result.status?.status,
        candidates_count: result.candidates?.length || 0,
        metrics: result.status?.metrics,
      });

      return {
        success: true,
        findall_id: result.findall_id || findall_id,
        status: result.status,
        candidates: result.candidates || [],
        metrics: result.status?.metrics,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('findAllResults: Error occurred', { error: errorMessage });

      mastra?.getLogger()?.error('FindAll results retrieval failed', {
        error: errorMessage,
        findall_id: context.findall_id,
      });

      return {
        success: false,
        error: `FindAll results retrieval failed: ${errorMessage}`,
      };
    }
  },
});

// Complete FindAll workflow tool (ingest + run + wait + results)
export const findAllCompleteTool = createTool({
  id: 'findAllComplete',
  description:
    'Complete FindAll workflow: converts natural language query to schema, creates run, waits for completion, and returns results. This is a convenience tool that combines all FindAll steps.',
  inputSchema: z.object({
    objective: z
      .string()
      .describe(
        'Natural language query describing what entities to find (e.g., "FindAll portfolio companies of Khosla Ventures founded after 2020")',
      ),
    generator: z
      .enum(['base', 'core', 'pro'])
      .optional()
      .default('core')
      .describe(
        'Generator to use: base (faster, cost-effective), core (balanced), or pro (high-quality)',
      ),
    match_limit: z
      .number()
      .optional()
      .default(10)
      .describe('Maximum number of matched candidates to return'),
    enrichments: z
      .array(z.string())
      .optional()
      .describe(
        'Optional array of enrichment fields to extract for matched candidates',
      ),
    max_wait_seconds: z
      .number()
      .optional()
      .default(900)
      .describe('Maximum time to wait for completion in seconds (default: 900 = 15 minutes)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    findall_id: z.string().optional(),
    status: z.any().optional(),
    candidates: z.array(z.any()).optional(),
    metrics: z.any().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context, mastra }) => {
    try {
      console.log('findAllComplete: Starting complete workflow');

      const {
        objective,
        generator = 'core',
        match_limit = 10,
        enrichments,
        max_wait_seconds = 300,
      } = context;

      if (!objective || typeof objective !== 'string' || objective.trim().length === 0) {
        return {
          success: false,
          error: 'Objective is required and must be a non-empty string',
        };
      }

      // Step 1: Ingest to get schema
      console.log('findAllComplete: Step 1 - Ingesting query');
      let ingestResult;
      try {
        ingestResult = await makeRequest('/ingest', 'POST', { objective });
      } catch (ingestError) {
        const errorMsg =
          ingestError instanceof Error ? ingestError.message : String(ingestError);
        return {
          success: false,
          error: `Ingest failed: ${errorMsg}`,
        };
      }

      // Step 2: Create run
      console.log('findAllComplete: Step 2 - Creating FindAll run');
      const runRequestBody: any = {
        objective,
        generator,
        match_limit,
      };

      if (ingestResult.entity_type) {
        runRequestBody.entity_type = ingestResult.entity_type;
      }

      if (ingestResult.match_conditions && ingestResult.match_conditions.length > 0) {
        runRequestBody.match_conditions = ingestResult.match_conditions;
      }

      if (enrichments && enrichments.length > 0) {
        runRequestBody.enrichments = enrichments;
      }

      let runResult;
      
      try {
        runResult = await makeRequest('/runs', 'POST', runRequestBody);
      } catch (runError) {
        const errorMsg =
          runError instanceof Error ? runError.message : String(runError);
        return {
          success: false,
          error: `Run creation failed: ${errorMsg}`,
        };
      }

      if (!runResult.findall_id) {
        return {
          success: false,
          error: 'Failed to create FindAll run: No findall_id returned',
        };
      }

      const findallId: string = runResult.findall_id;
      console.log('findAllComplete: Step 3 - Waiting for completion', {
        findall_id: findallId,
      });

      // Step 3: Wait for completion
      const maxAttempts = Math.floor(max_wait_seconds);
      try {
        await pollFindAllStatus(findallId, maxAttempts, 1000);
      } catch (pollError) {
        // Even if polling times out, try to fetch results anyway
        // The results endpoint may return partial results
        console.warn(
          'Polling timeout, but attempting to fetch results anyway:',
          pollError instanceof Error ? pollError.message : String(pollError),
        );
      }

      // Step 4: Get results
      console.log('findAllComplete: Step 4 - Fetching results');
      const result = await makeRequest(`/runs/${findallId}/result`);

      console.log('findAllComplete: Workflow completed', {
        findall_id: findallId,
        candidates_count: result.candidates?.length || 0,
      });

      return {
        success: true,
        findall_id: result.findall_id || findallId,
        status: result.status,
        candidates: result.candidates || [],
        metrics: result.status?.metrics,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      // If the error is about timeout but we have a findall_id, try to fetch results anyway
      // Extract findall_id from error message as fallback
      let findallIdToTry: string | null = null;
      
      // Try to extract findall_id from error message
      const findallIdMatch = errorMessage.match(/findall_[a-f0-9]+/i);
      if (findallIdMatch) {
        findallIdToTry = findallIdMatch[0];
      }
      
      if ((errorMessage.includes('timeout') || errorMessage.includes('Maximum attempts')) && findallIdToTry) {
        console.warn(
          `Timeout occurred, but attempting to fetch partial results for ${findallIdToTry}`,
        );
        try {
          const result = await makeRequest(`/runs/${findallIdToTry}/result`);
          if (result.candidates && result.candidates.length > 0) {
            console.log(
              `Successfully retrieved ${result.candidates.length} candidates despite timeout`,
            );
            return {
              success: true,
              findall_id: result.findall_id || findallIdToTry,
              status: result.status,
              candidates: result.candidates || [],
              metrics: result.status?.metrics,
            };
          }
        } catch (fetchError) {
          // If fetching results also fails, fall through to error return
          console.error('Failed to fetch results after timeout:', fetchError);
        }
      }

      console.error('findAllComplete: Error occurred', { error: errorMessage });

      mastra?.getLogger()?.error('FindAll complete workflow failed', {
        error: errorMessage,
        objective: context.objective,
      });

      return {
        success: false,
        error: `FindAll complete workflow failed: ${errorMessage}`,
      };
    }
  },
});

