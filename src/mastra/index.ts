import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { weatherAgent } from "./agents/weather-agent";
import { webSearchAgent } from "./agents/web-search-agent";

export const mastra = new Mastra({
  agents: { weatherAgent, webSearchAgent },
  storage: new LibSQLStore({
    url: "file:./mastra.db", // Storage is required for tracing
  }),
  observability: {
    default: { enabled: true }, // Enables AI Tracing for all agents
  },
});