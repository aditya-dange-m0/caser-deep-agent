import { createOpenAI } from '@ai-sdk/openai';
import { Memory } from '@mastra/memory';
import { libSQLStore, libSQLVector } from '../shared/storage/memory-store';

// Check if OpenAI API key is available for embeddings
export const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

export const openai = hasOpenAIKey
  ? createOpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    })
  : null;

export const getDefaultLLM = () =>
  openai ? openai('gpt-4o-mini') : 'google/gemini-2.0-flash';

export const createMemory = (workingMemoryTemplate: string) => {
  return new Memory({
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
        scope: 'thread',
        template: workingMemoryTemplate,
      },
    },
  });
};
