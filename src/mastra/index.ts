import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { libSQLStore } from './memoryStore';
import { weatherAgent } from './agents/weather-agent';
import { webSearchAgent } from './agents/web-search-agent';

export const mastra = new Mastra({
  agents: {
    weatherAgent,
    webSearchAgent, // Web search agent with comprehensive tools and memory
  },
  storage: libSQLStore,
  logger: new PinoLogger({
    name: 'WebSearchAgent',
    level: 'info',
  }),
  observability: {
    default: { enabled: true }, // Enables AI Tracing for all agents
  },
});