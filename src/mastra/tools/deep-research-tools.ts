import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import Parallel from 'parallel-web';
import { config } from 'dotenv';

config();

const PARALLEL_API_KEY = process.env.PARALLEL_API_KEY;

// Initialize Parallel AI client
const getParallelClient = () => {
  if (!PARALLEL_API_KEY) {
    throw new Error(
      'PARALLEL_API_KEY environment variable is not set. Please configure it in your .env file.',
    );
  }
  return new Parallel({
    apiKey: PARALLEL_API_KEY,
  });
};

// Helper function to poll for task results using Parallel SDK
const pollTaskResult = async (
  client: Parallel,
  runId: string,
  maxAttempts: number = 144, // 144 attempts * 1 second = ~1 hour max
  timeout: number = 25, // 25 second timeout per attempt
): Promise<any> => {
  let runResult;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      // Log progress every 10 attempts, and always log the first attempt
      if (i === 0 || (i % 10 === 0 && i > 0)) {
        console.log(
          `Polling attempt ${i + 1}/${maxAttempts} for run ID: ${runId} (timeout: ${timeout}s)`,
        );
      }

      runResult = await client.taskRun.result(runId, { timeout });

      // If we get a result with output, the task is complete
      if (runResult && runResult.output !== undefined) {
        console.log(`Task completed on attempt ${i + 1}`);
        break;
      }

      // If result exists but no output yet, task is still processing
      if (runResult && runResult.output === undefined) {
        console.log(`Task still processing, attempt ${i + 1}/${maxAttempts}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Check if error indicates task is still processing (not a fatal error)
      if (
        errorMsg.includes('timeout') ||
        errorMsg.includes('not ready') ||
        errorMsg.includes('still processing') ||
        errorMsg.includes('404') ||
        errorMsg.includes('not found')
      ) {
        // Task is still processing, wait and retry
        if (i < maxAttempts - 1) {
          console.log(
            `Task not ready yet (attempt ${i + 1}/${maxAttempts}), retrying...`,
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
      }

      // If it's the last attempt or a fatal error, throw
      if (i === maxAttempts - 1) {
        console.error(`Final polling attempt failed: ${errorMsg}`);
        throw error;
      }

      // Wait 1 second before retrying for other errors
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  if (!runResult) {
    throw new Error(
      `Task timeout: Maximum attempts (${maxAttempts}) exceeded for run ID: ${runId}`,
    );
  }

  return runResult;
};

// Quick Deep Research Tool - uses base and core processors
export const quickDeepResearchTool = createTool({
  id: 'quickDeepResearch',
  description:
    'Performs quick deep research using Parallel AI Task API with base or core processors. Ideal for faster research tasks with moderate depth.',
  inputSchema: z.object({
    query: z
      .string()
      .describe('The research query or topic to investigate deeply'),
    processor: z
      .enum(['base', 'core'])
      .optional()
      .default('base')
      .describe(
        'Processor to use: base (faster, cost-effective) or core (more comprehensive). Default: base.',
      ),
    includeAnalysis: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        'Include detailed analysis and insights in the research output',
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    research: z.any().optional(),
    summary: z.any().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context, mastra }) => {
    try {
      console.log('quickDeepResearch: Starting execution');

      const { query, processor = 'base', includeAnalysis = true } = context;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return {
          success: false,
          error: 'Research query is required and must be a non-empty string',
        };
      }

      let client: Parallel;
      try {
        client = getParallelClient();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        mastra?.getLogger()?.error(errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }

      const taskInput = `Perform a comprehensive deep research on: ${query}. 

Requirements:
- Conduct thorough investigation and analysis
- Gather information from multiple credible sources
- Provide detailed insights and findings
- Include relevant data, statistics, and evidence
- ${includeAnalysis ? 'Include in-depth analysis, trends, and implications' : 'Provide factual information'}
- Structure the research with clear sections and conclusions
- Cite sources and provide references where applicable

Deliver a well-structured research report that covers all aspects of the topic.`;

      let taskRun;
      try {
        taskRun = await client.taskRun.create({
          input: taskInput,
          processor: processor,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('quickDeepResearch: Failed to create task', errorMsg);
        mastra
          ?.getLogger()
          ?.error('Failed to create task', { error: errorMsg });
        return {
          success: false,
          error: `Failed to create task: ${errorMsg}`,
        };
      }

      const runId = taskRun.run_id;
      if (!runId) {
        throw new Error('Failed to create task: No run ID returned');
      }

      console.log('quickDeepResearch: Task created with run ID', runId);
      console.log('quickDeepResearch: Polling for results...');

      let result;
      try {
        result = await pollTaskResult(client, runId, 144, 25);
        console.log('quickDeepResearch: Polling completed successfully');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('quickDeepResearch: Failed to get task result', errorMsg);
        return {
          success: false,
          error: `Failed to get task result: ${errorMsg}`,
        };
      }

      if (result?.output) {
        const outputText =
          typeof result.output === 'string'
            ? result.output
            : JSON.stringify(result.output);

        const summary = {
          query: query,
          processor: processor,
          hasAnalysis: includeAnalysis,
          outputLength: outputText.length,
          sources:
            result.basis && Array.isArray(result.basis)
              ? result.basis
                  .map((item: any) => item.url || item.source)
                  .filter(Boolean)
              : [],
        };

        return {
          success: true,
          research: outputText,
          summary: summary,
        };
      }

      return {
        success: true,
        research: 'No research results found.',
        summary: {
          query: query,
          message: 'Research completed but no results were returned.',
        },
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('quickDeepResearch: Error occurred', {
        error: errorMessage,
        query: context.query,
      });
      mastra?.getLogger()?.error('Quick deep research failed', {
        error: errorMessage,
        query: context.query,
      });
      return {
        success: false,
        error: `Quick deep research failed: ${errorMessage}`,
      };
    }
  },
});

// Deep Research Tool - uses core and pro processors
export const deepResearchTool = createTool({
  id: 'deepResearch',
  description:
    'Performs comprehensive deep research using Parallel AI Task API with core or pro processors. Ideal for thorough research tasks requiring high-quality analysis. Returns structured intelligence reports with citations and verification.',
  inputSchema: z.object({
    query: z
      .string()
      .max(15000, 'Input must be under 15,000 characters for optimal performance')
      .describe('The research query or topic to investigate deeply'),
    processor: z
      .enum(['core', 'pro'])
      .optional()
      .default('core')
      .describe(
        'Processor to use: core (balanced) or pro (high-quality analysis). Default: core.',
      ),
    outputFormat: z
      .enum(['auto', 'text'])
      .optional()
      .default('auto')
      .describe(
        'Output format: auto (structured JSON) or text (markdown report). Default: auto.',
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    research: z.any().optional(),
    summary: z.any().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context, mastra }) => {
    try {
      console.log('deepResearch: Starting execution');

      const { query, processor = 'core', outputFormat = 'auto' } = context;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return {
          success: false,
          error: 'Research query is required and must be a non-empty string',
        };
      }

      if (query.length > 15000) {
        return {
          success: false,
          error: 'Research query must be under 15,000 characters for optimal performance',
        };
      }

      let client: Parallel;
      try {
        client = getParallelClient();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        mastra?.getLogger()?.error(errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }

      // For Deep Research, use the query directly - no need to wrap in instructions
      // The processor will handle the research orchestration
      const taskInput = query;

      let taskRun;
      try {
        // Configure task spec with output schema
        const taskSpec: any = {
          output_schema: outputFormat === 'text' 
            ? { type: 'text' }
            : { type: 'auto' }, // auto is default, but explicit is better
        };

        taskRun = await client.taskRun.create({
          input: taskInput,
          processor: processor,
          task_spec: taskSpec,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('deepResearch: Failed to create task', errorMsg);
        mastra
          ?.getLogger()
          ?.error('Failed to create task', { error: errorMsg });
        return {
          success: false,
          error: `Failed to create task: ${errorMsg}`,
        };
      }

      const runId = taskRun.run_id;
      if (!runId) {
        throw new Error('Failed to create task: No run ID returned');
      }

      console.log('deepResearch: Task created with run ID', runId);
      console.log(
        `deepResearch: Polling for results (this may take longer for ${processor} processor)...`,
      );

      // Deep Research can take longer, especially for pro processor
      const maxAttempts = processor === 'pro' ? 216 : 144; // 216 * 25s = 1.5 hours for pro
      
      let result;
      try {
        result = await pollTaskResult(client, runId, maxAttempts, 25);
        console.log('deepResearch: Polling completed successfully');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('deepResearch: Failed to get task result', errorMsg);
        return {
          success: false,
          error: `Failed to get task result: ${errorMsg}`,
        };
      }

      if (result?.output) {
        // Handle structured output from Deep Research
        let researchOutput: any;
        let sources: any[] = [];

        if (outputFormat === 'text') {
          // Text mode: output is markdown string
          researchOutput = typeof result.output === 'string' 
            ? result.output 
            : JSON.stringify(result.output);
          
          // In text mode, basis is a flat list of citations
          if (result.basis && Array.isArray(result.basis)) {
            sources = result.basis
              .map((item: any) => ({
                url: item.url || item.source,
                title: item.title,
                excerpt: item.excerpt,
              }))
              .filter((item: any) => item.url);
          }
        } else {
          // Auto mode: output is structured JSON with nested content
          researchOutput = result.output;
          
          // In auto mode, basis is nested FieldBasis array
          if (result.basis && Array.isArray(result.basis)) {
            sources = result.basis.flatMap((fieldBasis: any) => {
              if (fieldBasis.citations && Array.isArray(fieldBasis.citations)) {
                return fieldBasis.citations.map((citation: any) => ({
                  field: fieldBasis.field,
                  url: citation.url,
                  title: citation.title,
                  excerpt: citation.excerpts?.[0] || citation.excerpt,
                  confidence: fieldBasis.confidence,
                  reasoning: fieldBasis.reasoning,
                }));
              }
              return [];
            });
          }
        }

        const summary = {
          query: query,
          processor: processor,
          outputFormat: outputFormat,
          outputLength: typeof researchOutput === 'string' 
            ? researchOutput.length 
            : JSON.stringify(researchOutput).length,
          totalSources: sources.length,
          uniqueSources: [...new Set(sources.map(s => s.url))].length,
          fields: outputFormat === 'auto' && result.basis 
            ? result.basis.map((fb: any) => fb.field).filter(Boolean)
            : undefined,
        };

        return {
          success: true,
          research: researchOutput,
          summary: summary,
          sources: sources.slice(0, 50), // Limit to first 50 sources
        };
      }

      return {
        success: true,
        research: 'No research results found.',
        summary: {
          query: query,
          message: 'Research completed but no results were returned.',
        },
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('deepResearch: Error occurred', {
        error: errorMessage,
        query: context.query,
      });
      mastra?.getLogger()?.error('Deep research failed', {
        error: errorMessage,
        query: context.query,
      });
      return {
        success: false,
        error: `Deep research failed: ${errorMessage}`,
      };
    }
  },
});

// Ultra Deep Research Tool - uses pro, ultra, ultra2x, ultra4x, ultra8x processors
export const ultraDeepResearchTool = createTool({
  id: 'ultraDeepResearch',
  description:
    'Performs ultra-comprehensive deep research using Parallel AI Task API with pro, ultra, ultra2x, ultra4x, or ultra8x processors. Ideal for the most thorough research tasks requiring maximum depth and quality.',
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        'The research query or topic to investigate with maximum depth',
      ),
    processor: z
      .enum(['pro', 'ultra', 'ultra2x', 'ultra4x', 'ultra8x'])
      .optional()
      .default('pro')
      .describe(
        'Processor to use: pro, ultra, ultra2x, ultra4x, or ultra8x (increasing depth and quality). Default: pro.',
      ),
    includeAnalysis: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        'Include detailed analysis and insights in the research output',
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    research: z.any().optional(),
    summary: z.any().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context, mastra }) => {
    try {
      console.log('ultraDeepResearch: Starting execution');

      const { query, processor = 'pro', includeAnalysis = true } = context;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return {
          success: false,
          error: 'Research query is required and must be a non-empty string',
        };
      }

      let client: Parallel;
      try {
        client = getParallelClient();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        mastra?.getLogger()?.error(errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }

      const taskInput = `Perform an ultra-comprehensive, exhaustive deep research on: ${query}. 

Requirements:
- Conduct the most thorough, multi-dimensional investigation and analysis possible
- Gather information from the widest range of credible, authoritative, and expert sources
- Provide extremely detailed insights, findings, and comprehensive analysis
- Include extensive relevant data, statistics, evidence, expert opinions, and case studies
- ${includeAnalysis ? 'Include exhaustive in-depth analysis, trends, implications, future outlook, and strategic recommendations' : 'Provide the most comprehensive factual information available'}
- Structure the research with clear sections, subsections, detailed analysis, and well-reasoned conclusions
- Cite all sources and provide comprehensive references
- Identify all key stakeholders, trends, patterns, and relationships
- Address all potential counterarguments, alternative perspectives, and edge cases
- Include comparative analysis, historical context, and forward-looking projections
- Provide actionable insights and recommendations where applicable

Deliver an ultra-comprehensive, meticulously structured research report that exhaustively covers all aspects of the topic with maximum depth, rigor, and analytical sophistication. This should be the most thorough research possible on the subject.`;

      let taskRun;
      try {
        taskRun = await client.taskRun.create({
          input: taskInput,
          processor: processor,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('ultraDeepResearch: Failed to create task', errorMsg);
        mastra
          ?.getLogger()
          ?.error('Failed to create task', { error: errorMsg });
        return {
          success: false,
          error: `Failed to create task: ${errorMsg}`,
        };
      }

      const runId = taskRun.run_id;
      if (!runId) {
        throw new Error('Failed to create task: No run ID returned');
      }

      console.log('ultraDeepResearch: Task created with run ID', runId);
      console.log(
        `ultraDeepResearch: Polling for results (this may take significantly longer for ${processor} processor)...`,
      );

      // Increase max attempts for ultra processors as they take longer
      const maxAttempts = ['ultra2x', 'ultra4x', 'ultra8x'].includes(processor)
        ? 288
        : 144;

      let result;
      try {
        result = await pollTaskResult(client, runId, maxAttempts, 25);
        console.log('ultraDeepResearch: Polling completed successfully');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('ultraDeepResearch: Failed to get task result', errorMsg);
        return {
          success: false,
          error: `Failed to get task result: ${errorMsg}`,
        };
      }

      if (result?.output) {
        const outputText =
          typeof result.output === 'string'
            ? result.output
            : JSON.stringify(result.output);

        const summary = {
          query: query,
          processor: processor,
          hasAnalysis: includeAnalysis,
          outputLength: outputText.length,
          sources:
            result.basis && Array.isArray(result.basis)
              ? result.basis
                  .map((item: any) => item.url || item.source)
                  .filter(Boolean)
              : [],
        };

        return {
          success: true,
          research: outputText,
          summary: summary,
        };
      }

      return {
        success: true,
        research: 'No research results found.',
        summary: {
          query: query,
          message: 'Research completed but no results were returned.',
        },
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('ultraDeepResearch: Error occurred', {
        error: errorMessage,
        query: context.query,
      });
      mastra?.getLogger()?.error('Ultra deep research failed', {
        error: errorMessage,
        query: context.query,
      });
      return {
        success: false,
        error: `Ultra deep research failed: ${errorMessage}`,
      };
    }
  },
});
