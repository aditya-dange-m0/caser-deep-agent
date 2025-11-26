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
// Follows the same pattern as the Parallel AI documentation example
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

      console.log(`Calling client.taskRun.result() for attempt ${i + 1}...`);
      runResult = await client.taskRun.result(runId, { timeout });
      console.log(`Received response on attempt ${i + 1}`);

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
      // Log the error but continue retrying unless it's the last attempt
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

// Main web search tool
export const webSearchTool = createTool({
  id: 'webSearch',
  description:
    'Performs a comprehensive web search using the Parallel AI Task API with base or lite processors. Returns relevant, up-to-date information from the web with excerpts and source URLs.',
  inputSchema: z.object({
    query: z
      .string()
      .describe('The search query or question to search for on the web'),
    maxResults: z
      .number()
      .optional()
      .default(10)
      .describe('Maximum number of search results to return (default: 10)'),
    processor: z
      .enum(['lite', 'base'])
      .optional()
      .describe(
        'Processor to use: lite (faster, cost-effective) or base (more comprehensive). If not specified, uses searchDepth to determine.',
      ),
    searchDepth: z
      .enum(['basic', 'advanced'])
      .optional()
      .default('basic')
      .describe(
        'Search depth level - basic uses lite processor, advanced uses base processor. Ignored if processor is explicitly set.',
      ),
    includeExcerpts: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include detailed excerpts from search results'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    results: z.array(z.any()).optional(),
    summary: z.any().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context, mastra }) => {
    try {
      console.log('webSearch: Starting execution');

      // In Mastra, context directly contains the inputSchema properties
      const {
        query,
        maxResults = 10,
        processor: explicitProcessor,
        searchDepth = 'basic',
        includeExcerpts = true,
      } = context;

      // Choose processor: explicit processor takes precedence, otherwise use searchDepth
      const processor =
        explicitProcessor || (searchDepth === 'basic' ? 'lite' : 'base');

      console.log('webSearch: Final parameters', {
        query,
        maxResults,
        searchDepth,
        processor,
        includeExcerpts,
      });

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return {
          success: false,
          error: 'Search query is required and must be a non-empty string',
        };
      }

      // Initialize Parallel client
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

      console.log('webSearch: Creating task with processor', processor);
      console.log('webSearch: API key present', !!PARALLEL_API_KEY);

      // Create task run using Parallel SDK
      const taskInput = `Find relevant, accurate, and up-to-date information about: ${query}. Return up to ${maxResults} results with ${includeExcerpts ? 'detailed excerpts' : 'brief summaries'}. Include source URLs and titles for each result. Format the results as a structured list with the following information for each result:
1. Title
2. Content/Excerpt (${includeExcerpts ? 'detailed' : 'brief'})
3. Source URL
4. Relevance score (if available)
5. Published date (if available)

Provide ${maxResults} results total.`;

      let taskRun;
      try {
        taskRun = await client.taskRun.create({
          input: taskInput,
          processor: processor,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('webSearch: Failed to create task', errorMsg);
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

      console.log('webSearch: Task created with run ID', runId);
      console.log(
        'webSearch: Polling for results (this may take several minutes for base processor)...',
      );

      // Poll for results using Parallel SDK
      // Using 144 attempts (1 hour max) with 25-second timeout per attempt
      let result;
      try {
        console.log(
          'webSearch: Starting polling loop (144 attempts max, 25s timeout each)...',
        );
        result = await pollTaskResult(client, runId, 144, 25);
        console.log('webSearch: Polling completed successfully');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('webSearch: Failed to get task result', errorMsg);
        return {
          success: false,
          error: `Failed to get task result: ${errorMsg}`,
        };
      }

      console.log('webSearch: Task completed', {
        hasOutput: !!result?.output,
        outputLength: result?.output?.length || 0,
      });

      // Parse the output - Task API returns text output that we need to parse
      if (result?.output) {
        // Try to extract structured information from the output
        // The output is text, so we'll parse it to extract results
        const outputText =
          typeof result.output === 'string'
            ? result.output
            : JSON.stringify(result.output);

        // Extract URLs from the output
        const urlRegex = /https?:\/\/[^\s\)]+/g;
        const urls = outputText.match(urlRegex) || [];

        // Try to parse structured results if basis information is available
        let results: any[] = [];

        if (result.basis && Array.isArray(result.basis)) {
          // Use basis information if available
          results = result.basis.map((item: any, index: number) => ({
            rank: index + 1,
            title: item.title || item.excerpt?.substring(0, 100) || 'No title',
            content: item.excerpt || item.content || 'No content available',
            url: item.url || urls[index] || 'Unknown source',
            relevance: item.relevance || item.score || null,
            publishedDate: item.publishedDate || null,
            source: item.source || 'Unknown',
          }));
        } else {
          // Fallback: create a single result from the output text
          results = [
            {
              rank: 1,
              title: query,
              content: outputText.substring(0, 2000),
              url: urls[0] || 'Unknown source',
              relevance: null,
              publishedDate: null,
              source: 'Parallel AI Task API',
            },
          ];
        }

        const summary = {
          totalResults: results.length,
          query: query,
          searchDepth: searchDepth,
          processor: processor,
          hasExcerpts: includeExcerpts,
          sources: [
            ...new Set(results.map((r: any) => r.source).filter(Boolean)),
          ],
        };

        return {
          success: true,
          results: results,
          summary: summary,
        };
      }

      console.log('webSearch: No results found');
      return {
        success: true,
        results: [],
        summary: {
          totalResults: 0,
          query: query,
          message: 'No results found for the search query.',
        },
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      console.error('webSearch: Error occurred', {
        error: errorMessage,
        query: context.query,
      });

      mastra?.getLogger()?.error('Web search failed', {
        error: errorMessage,
        query: context.query,
      });

      return {
        success: false,
        error: `Web search failed: ${errorMessage}`,
      };
    }
  },
});

// Advanced search tool with multiple queries
export const advancedWebSearchTool = createTool({
  id: 'advancedWebSearch',
  description:
    'Performs an advanced web search with multiple related queries to get comprehensive information on a topic using the Parallel AI Task API with base processor',
  inputSchema: z.object({
    mainQuery: z.string().describe('The main search query'),
    relatedQueries: z
      .array(z.string())
      .optional()
      .describe('Additional related queries to search for'),
    maxResultsPerQuery: z
      .number()
      .optional()
      .default(5)
      .describe('Maximum results per query'),
    combineResults: z
      .boolean()
      .optional()
      .default(true)
      .describe('Combine results from all queries'),
    processor: z
      .enum(['lite', 'base'])
      .optional()
      .default('base')
      .describe(
        'Processor to use - lite for faster/basic, base for more comprehensive',
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    results: z.array(z.any()).optional(),
    queryResults: z.record(z.string(), z.array(z.any())).optional(),
    summary: z.any().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context, mastra }) => {
    try {
      console.log('advancedWebSearch: Starting execution');

      // In Mastra, context directly contains the inputSchema properties
      const {
        mainQuery,
        relatedQueries = [],
        maxResultsPerQuery = 5,
        combineResults = true,
        processor = 'base',
      } = context;

      if (
        !mainQuery ||
        typeof mainQuery !== 'string' ||
        mainQuery.trim().length === 0
      ) {
        return {
          success: false,
          error: 'Main search query is required and must be a non-empty string',
        };
      }

      // Initialize Parallel client
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

      const allQueries = [mainQuery, ...relatedQueries];
      const queryResults: Record<string, any[]> = {};

      // Execute searches for all queries using Task API
      for (const query of allQueries) {
        try {
          console.log(
            `advancedWebSearch: Creating task for query "${query}" with processor ${processor}`,
          );

          // Create task run using Parallel SDK
          const taskInput = `Find relevant information about: ${query}. Return up to ${maxResultsPerQuery} results with detailed excerpts. Include source URLs and titles for each result. Format the results as a structured list with the following information for each result:
1. Title
2. Content/Excerpt (detailed)
3. Source URL
4. Relevance score (if available)
5. Published date (if available)

Provide ${maxResultsPerQuery} results total.`;

          let taskRun;
          try {
            taskRun = await client.taskRun.create({
              input: taskInput,
              processor: processor,
            });
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : String(error);
            console.error(
              `advancedWebSearch: Failed to create task for query "${query}"`,
              errorMsg,
            );
            queryResults[query] = [];
            continue;
          }

          const runId = taskRun.run_id;
          if (!runId) {
            console.error(
              `advancedWebSearch: Failed to create task for query "${query}" - no run ID`,
            );
            queryResults[query] = [];
            continue;
          }

          // Poll for results using Parallel SDK
          let result;
          try {
            result = await pollTaskResult(client, runId, 144, 25);
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : String(error);
            console.error(
              `advancedWebSearch: Failed to get result for query "${query}"`,
              errorMsg,
            );
            queryResults[query] = [];
            continue;
          }

          if (result.output) {
            const outputText =
              typeof result.output === 'string'
                ? result.output
                : JSON.stringify(result.output);
            const urlRegex = /https?:\/\/[^\s\)]+/g;
            const urls = outputText.match(urlRegex) || [];

            let results: any[] = [];

            if (result.basis && Array.isArray(result.basis)) {
              results = result.basis.map((item: any, index: number) => ({
                rank: index + 1,
                title:
                  item.title || item.excerpt?.substring(0, 100) || 'No title',
                content: item.excerpt || item.content || 'No content',
                url: item.url || urls[index] || 'Unknown',
                source: item.source || 'Unknown',
              }));
            } else {
              // Fallback: parse text output
              results = [
                {
                  rank: 1,
                  title: query,
                  content: outputText.substring(0, 2000),
                  url: urls[0] || 'Unknown',
                  source: 'Parallel AI Task API',
                },
              ];
            }

            queryResults[query] = results.slice(0, maxResultsPerQuery);
          } else {
            queryResults[query] = [];
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error(
            `advancedWebSearch: Error for query "${query}":`,
            errorMsg,
          );
          queryResults[query] = [];
        }
      }

      const allResults = combineResults
        ? Object.values(queryResults).flat()
        : [];

      return {
        success: true,
        results: combineResults ? allResults : undefined,
        queryResults: combineResults ? undefined : queryResults,
        summary: {
          totalQueries: allQueries.length,
          totalResults: allResults.length,
          processor: processor,
          resultsPerQuery: Object.fromEntries(
            Object.entries(queryResults).map(([q, r]) => [q, r.length]),
          ),
        },
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('advancedWebSearch: Error', errorMessage);
      return {
        success: false,
        error: `Advanced web search failed: ${errorMessage}`,
      };
    }
  },
});

// Search result analysis tool
export const analyzeSearchResultsTool = createTool({
  id: 'analyzeSearchResults',
  description:
    'Analyzes and summarizes search results to provide key insights and patterns',
  inputSchema: z.object({
    results: z.array(z.any()).describe('Array of search results to analyze'),
    focusAreas: z
      .array(z.string())
      .optional()
      .describe('Specific areas to focus the analysis on'),
    includeTrends: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include trend analysis'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    analysis: z.any().optional(),
    keyInsights: z.array(z.string()).optional(),
    trends: z.any().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context, mastra }) => {
    try {
      console.log('analyzeSearchResults: Starting execution');

      // In Mastra, context directly contains the inputSchema properties
      const { results, focusAreas = [], includeTrends = true } = context;

      if (!results || !Array.isArray(results) || results.length === 0) {
        return {
          success: false,
          error: 'Results array is required and must not be empty',
        };
      }

      // Extract key information from results
      const sources = [
        ...new Set(results.map((r: any) => r.source).filter(Boolean)),
      ];
      const domains = [
        ...new Set(
          results
            .map((r: any) => {
              try {
                return new URL(r.url || '').hostname;
              } catch {
                return null;
              }
            })
            .filter(Boolean),
        ),
      ];

      const keyInsights = [
        `Found ${results.length} search results from ${sources.length} different sources`,
        `Results span across ${domains.length} different domains`,
        `Primary sources: ${sources.slice(0, 3).join(', ')}`,
      ];

      if (focusAreas.length > 0) {
        focusAreas.forEach((area) => {
          const relevantResults = results.filter(
            (r: any) =>
              r.title?.toLowerCase().includes(area.toLowerCase()) ||
              r.content?.toLowerCase().includes(area.toLowerCase()),
          );
          if (relevantResults.length > 0) {
            keyInsights.push(
              `${area}: ${relevantResults.length} relevant results found`,
            );
          }
        });
      }

      const analysis = {
        totalResults: results.length,
        uniqueSources: sources.length,
        uniqueDomains: domains.length,
        sourceBreakdown: sources.reduce(
          (acc, source) => {
            acc[source] = results.filter(
              (r: any) => r.source === source,
            ).length;
            return acc;
          },
          {} as Record<string, number>,
        ),
        keyInsights: keyInsights,
        topResults: results.slice(0, 3).map((r: any) => ({
          title: r.title,
          source: r.source,
          url: r.url,
        })),
      };

      const trends = includeTrends
        ? {
            mostCommonSources: Object.entries(analysis.sourceBreakdown)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .slice(0, 3)
              .map(([source, count]) => ({ source, count })),
            dateRange: results
              .filter((r: any) => r.publishedDate)
              .map((r: any) => r.publishedDate)
              .sort(),
          }
        : null;

      return {
        success: true,
        analysis: analysis,
        keyInsights: keyInsights,
        trends: trends,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('analyzeSearchResults: Error', errorMessage);
      return {
        success: false,
        error: `Search results analysis failed: ${errorMessage}`,
      };
    }
  },
});
