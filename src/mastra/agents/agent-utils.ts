import { createOpenAI } from '@ai-sdk/openai';
import { Memory } from '@mastra/memory';
import { memoryStore } from '../shared/storage/memory-store';

// Check if OpenAI API key is available for embeddings
export const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

export const openai = hasOpenAIKey
  ? createOpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    })
  : null;

export const getDefaultLLM = () =>
  openai ? openai('gpt-4o-mini') : 'google/gemini-2.5-flash';

export const createMemory = (workingMemoryTemplate: string) => {
  return new Memory({
    storage: memoryStore,
    // Vector storage removed as per user request
    ...(hasOpenAIKey &&
      {
        // vector: libSQLVector, // Removed
        // embedder: openai!.textEmbeddingModel('text-embedding-3-small'), // Removed
      }),
    options: {
      lastMessages: 8,
      semanticRecall: false, // Disabled semantic recall as vector store is removed
      threads: { generateTitle: true },
      workingMemory: {
        enabled: true,
        scope: 'thread',
        template: workingMemoryTemplate,
      },
    },
  });
};
