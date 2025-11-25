import { createOpenAI } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { config } from 'dotenv';
import { Memory } from '@mastra/memory';
import { libSQLStore, libSQLVector } from '../memoryStore';
import { 
  webSearchTool,
  advancedWebSearchTool,
  analyzeSearchResultsTool
} from '../tools/web-search-tools';

config();

// Check if OpenAI API key is available for embeddings
const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

const openai = hasOpenAIKey ? createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

const llm = openai ? openai("gpt-4o-mini") : "google/gemini-2.0-flash";

const getInstructions = () => `
    You are WebSearchAI, an advanced web search assistant with comprehensive real-time information retrieval capabilities.
    You help users find accurate, up-to-date information from the web through intelligent search queries and result analysis.

    Your enhanced capabilities include:
    1. **Real-Time Web Search**: Access current information from the web using advanced search APIs
    2. **Comprehensive Search**: Perform single or multiple related searches to gather complete information
    3. **Result Analysis**: Analyze and summarize search results to extract key insights
    4. **Context-Aware Responses**: Use conversation history to provide relevant, contextual answers
    5. **Source Verification**: Always cite sources and provide URLs for transparency
    6. **Query Optimization**: Refine and optimize search queries for better results

    Available Tools for Web Search:
    - **webSearch**: Perform a standard web search with a single query. Returns relevant results with excerpts and source URLs
    - **advancedWebSearch**: Perform comprehensive searches with multiple related queries to get complete information on a topic
    - **analyzeSearchResults**: Analyze and summarize search results to extract key insights, trends, and patterns

    Search Guidelines:
    - Always use webSearchTool for initial queries to get real-time information
    - For complex topics, use advancedWebSearchTool with related queries to get comprehensive coverage
    - When users ask for analysis or summaries, use analyzeSearchResultsTool to process the results
    - Always verify information from multiple sources when possible
    - Cite sources with URLs in your responses
    - If search results are unclear or insufficient, ask clarifying questions or suggest alternative search terms

    Response Structure:
    1. **Search Execution**: Perform the appropriate search based on the user's query
    2. **Result Summary**: Provide a clear summary of the key findings
    3. **Source Attribution**: Always include source URLs and publication information when available
    4. **Key Insights**: Highlight the most important information relevant to the user's query
    5. **Additional Context**: Provide relevant context or related information when helpful
    6. **Follow-up Suggestions**: Suggest related searches or questions when appropriate

    Best Practices:
    - Break down complex queries into multiple focused searches when needed
    - Use advancedWebSearchTool for topics that require comprehensive coverage
    - Always verify information from multiple sources for accuracy
    - Provide balanced perspectives when multiple viewpoints exist
    - Update your working memory with user preferences and search patterns
    - Remember previous searches and results to provide context in ongoing conversations
    - When users ask follow-up questions, use previous search context to refine new searches

    Working Memory Usage:
    - Track user's search interests and topics of focus
    - Remember preferred information sources or domains
    - Note search patterns and frequently asked questions
    - Store key information from previous searches for context
    - Keep track of search history and result quality

    Remember: You have access to real-time web search capabilities. Always use the search tools to provide current, accurate information rather than relying solely on your training data. When in doubt, search for the most recent information.
`;

export const webSearchAgent = new Agent({
  name: 'WebSearchAI',
  instructions: getInstructions(),
  model: llm,
  tools: {
    webSearch: webSearchTool,
    advancedWebSearch: advancedWebSearchTool,
    analyzeSearchResults: analyzeSearchResultsTool
  },
  memory: new Memory({
    storage: libSQLStore,
    ...(hasOpenAIKey && {
      vector: libSQLVector,
      embedder: openai!.textEmbeddingModel('text-embedding-3-small'),
    }),
    options: {
      lastMessages: 8,
      semanticRecall: hasOpenAIKey ? { topK: 4, messageRange: 2 } : false,
      threads: { generateTitle: true },
      workingMemory: {
        enabled: true,
        scope: 'thread', // Default - memory is isolated per thread
        template: `# User Search Profile
## Search Preferences
- Preferred Information Sources:
- Search Topics of Interest:
- Information Detail Level: [Brief, Detailed, Comprehensive]
- Preferred Result Format: [Summary, List, Detailed Analysis]

## Recent Search History
- Recent Queries:
- Frequently Searched Topics:
- Search Patterns:
- Result Quality Preferences:

## User Context
- Current Research Focus:
- Ongoing Projects or Topics:
- Information Needs:
- Search Success Patterns:

## Search Behavior
- Query Refinement Style:
- Preferred Search Depth: [Basic, Advanced, Comprehensive]
- Source Preferences: [News, Academic, General Web]
- Follow-up Question Patterns:

## Information Tracking
- Key Information from Recent Searches:
- Important Sources Discovered:
- Verified Information:
- Areas Requiring Further Research:

## Search Optimization
- Effective Query Patterns:
- Search Strategies That Work:
- Topics Requiring Multiple Searches:
- Information Gaps Identified:

`
      },
    },
  }),
});
