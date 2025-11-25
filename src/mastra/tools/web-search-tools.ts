import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import axios from 'axios';
import { config } from 'dotenv';

config();

const PARALLEL_API_KEY = process.env.PARALLEL_API_KEY;
const PARALLEL_API_ENDPOINT = process.env.PARALLEL_API_ENDPOINT || "https://api.parallel.ai/v1beta/search";

// Helper function to extract userId from context
const extractUserId = (context: any): string | undefined => {
  console.log('extractUserId: Full context for userId extraction:', {
    contextUserId: context.context?.userId,
    directUserId: context.userId,
    runtimeUserId: context.runtimeContext?.userId,
    resourceId: context.resourceId,
    threadId: context.threadId,
    resourceIdParts: context.resourceId?.split('-'),
    threadIdParts: context.threadId?.split('-')
  });
  
  // Try to get userId from runtime context first (this should be the most reliable)
  let userId = context.runtimeContext?.userId;
  
  if (!userId) {
    // Fallback to other methods
    userId = context.context?.userId || 
    context.userId ||
    (context.resourceId?.split('-')?.pop()) || // Get the last part of resourceId
    (context.threadId?.split('-')?.[0]); // Get the first part of threadId
  }
         
  console.log('extractUserId: Final extracted userId:', userId);
  return userId;
};

// Note: In Mastra, the context object directly contains the input parameters
// based on the inputSchema. No need for a helper function - just destructure from context.

// Main web search tool
export const webSearchTool = createTool({
  id: 'webSearch',
  description: 'Performs a comprehensive web search using the Parallel AI Search API. Returns relevant, up-to-date information from the web with excerpts and source URLs.',
  inputSchema: z.object({
    query: z.string().describe('The search query or question to search for on the web'),
    maxResults: z.number().optional().default(10).describe('Maximum number of search results to return (default: 10)'),
    searchDepth: z.enum(['basic', 'advanced']).optional().default('basic').describe('Search depth level'),
    includeExcerpts: z.boolean().optional().default(true).describe('Include detailed excerpts from search results')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    results: z.array(z.any()).optional(),
    summary: z.any().optional(),
    error: z.string().optional()
  }),
  execute: async ({ context, mastra }) => {
    try {
      console.log('webSearch: Starting execution');
      
      // In Mastra, context directly contains the inputSchema properties
      const { query, maxResults = 10, searchDepth = 'basic', includeExcerpts = true } = context;
      
      console.log('webSearch: Final parameters', { 
        query,
        maxResults,
        searchDepth,
        includeExcerpts
      });

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return { 
          success: false, 
          error: 'Search query is required and must be a non-empty string' 
        };
      }

      // Check if API key is configured
      if (!PARALLEL_API_KEY) {
        const errorMsg = "PARALLEL_API_KEY environment variable is not set. Please configure it in your .env file.";
        mastra?.getLogger()?.error(errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }

      console.log('webSearch: Making API request to', PARALLEL_API_ENDPOINT);

      const response = await axios.post(
        PARALLEL_API_ENDPOINT,
        {
          objective: `Find relevant, accurate, and up-to-date information about: ${query}`,
          search_queries: [query],
          max_results: maxResults,
          excerpts: includeExcerpts ? {
            max_chars_per_result: 1000
          } : undefined
        },
        {
          headers: {
            "x-api-key": PARALLEL_API_KEY,
            "Content-Type": "application/json",
            "parallel-beta": "search-extract-2025-10-10"
          },
          timeout: 30000, // 30 second timeout for search
        }
      );

      console.log('webSearch: API response received', {
        hasResults: !!response.data?.results,
        resultsCount: response.data?.results?.length || 0
      });

      // Parse the response from Parallel AI
      if (response.data?.results && Array.isArray(response.data.results) && response.data.results.length > 0) {
        const results = response.data.results.map((result: any, index: number) => ({
          rank: index + 1,
          title: result.title || "No title",
          content: result.excerpt || result.content || "No content available",
          url: result.url || "Unknown source",
          relevance: result.relevance || result.score || null,
          publishedDate: result.publishedDate || null,
          source: result.source || "Unknown"
        }));

        const summary = {
          totalResults: results.length,
          query: query,
          searchDepth: searchDepth,
          hasExcerpts: includeExcerpts,
          sources: [...new Set(results.map((r: any) => r.source).filter(Boolean))],
          dateRange: {
            earliest: results.find((r: any) => r.publishedDate)?.publishedDate || null,
            latest: results.find((r: any) => r.publishedDate)?.publishedDate || null
          }
        };

        return {
          success: true,
          results: results,
          summary: summary
        };
      }

      console.log('webSearch: No results found');
      return {
        success: true,
        results: [],
        summary: {
          totalResults: 0,
          query: query,
          message: "No results found for the search query."
        }
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const statusCode = axios.isAxiosError(err) ? err.response?.status : undefined;
      
      console.error('webSearch: Error occurred', {
        error: errorMessage,
        statusCode,
        query: context.query
      });

      mastra?.getLogger()?.error("Web search failed", {
        error: errorMessage,
        statusCode,
        query: context.query,
      });

      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          return {
            success: false,
            error: "Web search failed: Invalid API key. Please check your PARALLEL_API_KEY.",
          };
        }
        if (err.response?.status === 429) {
          return {
            success: false,
            error: "Web search failed: Rate limit exceeded. Please try again later.",
          };
        }
        if (err.response?.status) {
          return {
            success: false,
            error: `Web search failed: API returned status ${err.response.status}. ${err.response.data?.message || errorMessage}`,
          };
        }
        if (err.request) {
          return {
            success: false,
            error: `Web search failed: Unable to reach the API at ${PARALLEL_API_ENDPOINT}. Please check your internet connection and verify the endpoint URL.`,
          };
        }
      }

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
  description: 'Performs an advanced web search with multiple related queries to get comprehensive information on a topic',
  inputSchema: z.object({
    mainQuery: z.string().describe('The main search query'),
    relatedQueries: z.array(z.string()).optional().describe('Additional related queries to search for'),
    maxResultsPerQuery: z.number().optional().default(5).describe('Maximum results per query'),
    combineResults: z.boolean().optional().default(true).describe('Combine results from all queries')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    results: z.array(z.any()).optional(),
    queryResults: z.record(z.string(), z.array(z.any())).optional(),
    summary: z.any().optional(),
    error: z.string().optional()
  }),
  execute: async ({ context, mastra }) => {
    try {
      console.log('advancedWebSearch: Starting execution');
      
      // In Mastra, context directly contains the inputSchema properties
      const { mainQuery, relatedQueries = [], maxResultsPerQuery = 5, combineResults = true } = context;
      
      if (!mainQuery || typeof mainQuery !== 'string' || mainQuery.trim().length === 0) {
        return { 
          success: false, 
          error: 'Main search query is required and must be a non-empty string' 
        };
      }

      if (!PARALLEL_API_KEY) {
        const errorMsg = "PARALLEL_API_KEY environment variable is not set.";
        mastra?.getLogger()?.error(errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }

      const allQueries = [mainQuery, ...relatedQueries];
      const queryResults: Record<string, any[]> = {};

      // Execute searches for all queries
      for (const query of allQueries) {
        try {
          const response = await axios.post(
            PARALLEL_API_ENDPOINT,
            {
              objective: `Find relevant information about: ${query}`,
              search_queries: [query],
              max_results: maxResultsPerQuery,
              excerpts: {
                max_chars_per_result: 800
              }
            },
            {
              headers: {
                "x-api-key": PARALLEL_API_KEY,
                "Content-Type": "application/json",
                "parallel-beta": "search-extract-2025-10-10"
              },
              timeout: 30000,
            }
          );

          if (response.data?.results && Array.isArray(response.data.results)) {
            queryResults[query] = response.data.results.map((result: any, index: number) => ({
              rank: index + 1,
              title: result.title || "No title",
              content: result.excerpt || result.content || "No content",
              url: result.url || "Unknown",
              source: result.source || "Unknown"
            }));
          }
        } catch (err) {
          console.error(`advancedWebSearch: Error for query "${query}":`, err);
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
          resultsPerQuery: Object.fromEntries(
            Object.entries(queryResults).map(([q, r]) => [q, r.length])
          )
        }
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
  description: 'Analyzes and summarizes search results to provide key insights and patterns',
  inputSchema: z.object({
    results: z.array(z.any()).describe('Array of search results to analyze'),
    focusAreas: z.array(z.string()).optional().describe('Specific areas to focus the analysis on'),
    includeTrends: z.boolean().optional().default(true).describe('Include trend analysis')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    analysis: z.any().optional(),
    keyInsights: z.array(z.string()).optional(),
    trends: z.any().optional(),
    error: z.string().optional()
  }),
  execute: async ({ context, mastra }) => {
    try {
      console.log('analyzeSearchResults: Starting execution');
      
      // In Mastra, context directly contains the inputSchema properties
      const { results, focusAreas = [], includeTrends = true } = context;
      
      if (!results || !Array.isArray(results) || results.length === 0) {
        return {
          success: false,
          error: 'Results array is required and must not be empty'
        };
      }

      // Extract key information from results
      const sources = [...new Set(results.map((r: any) => r.source).filter(Boolean))];
      const domains = [...new Set(results.map((r: any) => {
        try {
          return new URL(r.url || '').hostname;
        } catch {
          return null;
        }
      }).filter(Boolean))];

      const keyInsights = [
        `Found ${results.length} search results from ${sources.length} different sources`,
        `Results span across ${domains.length} different domains`,
        `Primary sources: ${sources.slice(0, 3).join(', ')}`
      ];

      if (focusAreas.length > 0) {
        focusAreas.forEach(area => {
          const relevantResults = results.filter((r: any) => 
            (r.title?.toLowerCase().includes(area.toLowerCase()) ||
             r.content?.toLowerCase().includes(area.toLowerCase()))
          );
          if (relevantResults.length > 0) {
            keyInsights.push(`${area}: ${relevantResults.length} relevant results found`);
          }
        });
      }

      const analysis = {
        totalResults: results.length,
        uniqueSources: sources.length,
        uniqueDomains: domains.length,
        sourceBreakdown: sources.reduce((acc, source) => {
          acc[source] = results.filter((r: any) => r.source === source).length;
          return acc;
        }, {} as Record<string, number>),
        keyInsights: keyInsights,
        topResults: results.slice(0, 3).map((r: any) => ({
          title: r.title,
          source: r.source,
          url: r.url
        }))
      };

      const trends = includeTrends ? {
        mostCommonSources: Object.entries(analysis.sourceBreakdown)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 3)
          .map(([source, count]) => ({ source, count })),
        dateRange: results
          .filter((r: any) => r.publishedDate)
          .map((r: any) => r.publishedDate)
          .sort()
      } : null;

      return {
        success: true,
        analysis: analysis,
        keyInsights: keyInsights,
        trends: trends
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

