import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const PARALLEL_API_KEY = process.env.PARALLEL_API_KEY;

export const webSearchTool = createTool({
  id: "web-search",
  description: "Performs a web search using the Parallel AI Search API",
  inputSchema: z.object({
    query: z.string().describe("Search query"),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    // Check if API key is configured
    if (!PARALLEL_API_KEY) {
      const errorMsg = "PARALLEL_API_KEY environment variable is not set. Please configure it in your .env file.";
      mastra?.getLogger()?.error(errorMsg);
      return {
        output: errorMsg,
      };
    }

    try {
      const response = await axios.post(
        "https://api.parallel.ai/v1beta/search",
        {
          objective: `Find relevant information about: ${context.query}`,
          search_queries: [context.query],
          max_results: 10,
          excerpts: {
            max_chars_per_result: 1000
          }
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

      // Parse the response from Parallel AI
      if (response.data?.results && response.data.results.length > 0) {
        // Combine results into a readable format
        const results = response.data.results
          .map((result: any, index: number) => {
            return `${index + 1}. ${result.title || "No title"}\n${result.excerpt || result.content || "No content"}\nSource: ${result.url || "Unknown"}`;
          })
          .join("\n\n");
        
        return {
          output: results,
        };
      }

      return {
        output: "No results found for the search query.",
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const statusCode = axios.isAxiosError(err) ? err.response?.status : undefined;
      
      mastra?.getLogger()?.error("Web search failed", {
        error: errorMessage,
        statusCode,
        query: context.query,
      });

      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          return {
            output: "Web search failed: Invalid API key. Please check your PARALLEL_API_KEY.",
          };
        }
        if (err.response?.status === 429) {
          return {
            output: "Web search failed: Rate limit exceeded. Please try again later.",
          };
        }
        if (err.response?.status) {
          return {
            output: `Web search failed: API returned status ${err.response.status}. ${err.response.data?.message || errorMessage}`,
          };
        }
      }

      return {
        output: `Web search failed: ${errorMessage}`,
      };
    }
  },
});
