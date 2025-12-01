import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { libSQLStore } from './shared/storage/memory-store';
import { webSearchAgent } from './agents/web-search-agent';
import { quickDeepResearchAgent } from './agents/quick-deep-research-agent';
import { deepResearchAgent } from './agents/deep-research-agent';
import { ultraDeepResearchAgent } from './agents/ultra-deep-research-agent';
import { findAllAgent } from './agents/findall-agent';

export const mastra = new Mastra({
  agents: {
    webSearchAgent, // Web search agent with comprehensive tools and memory
    quickDeepResearchAgent, // Quick deep research agent with base and core processors
    deepResearchAgent, // Deep research agent with core and pro processors
    ultraDeepResearchAgent, // Ultra deep research agent with pro, ultra, ultra2x, ultra4x, ultra8x processors
    findAllAgent, // FindAll agent for entity discovery using Parallel AI FindAll API
  },
  storage: libSQLStore,
  logger: new PinoLogger({
    name: 'MastraAgents',
    level: 'info',
  }),
  observability: {
    default: { enabled: true }, // Enables AI Tracing for all agents
  },
});
