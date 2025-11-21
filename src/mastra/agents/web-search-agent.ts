import { Agent } from "@mastra/core/agent";
import { webSearchTool } from "../tools/web-search-tool";
import { memory } from "../memory";

export const webSearchAgent = new Agent({
  name: "Web Search Agent",
  instructions: `
    You are a web search assistant. Use the webSearchTool to fetch up-to-date results for user queries.
    If the user's prompt is unclear, ask a clarifying question.
    Always return concise and accurate information from real-time search.
  `,
  model: "google/gemini-2.0-flash",
  tools: { webSearchTool },
  memory: memory,
});
