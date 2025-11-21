import { Memory } from "@mastra/memory";
import { LibSQLStore, LibSQLVector } from "@mastra/libsql";
import { mkdirSync } from "fs";
import { dirname, resolve } from "path";

// Ensure data directory exists
let dbPath = process.env.LIBSQL_URL || "file:./data/agents-memory.db";
if (dbPath.startsWith("file:")) {
  const dbFilePath = dbPath.replace("file:", "");
  // Resolve to absolute path to ensure it works from any working directory
  const absolutePath = resolve(process.cwd(), dbFilePath);
  const dbDir = dirname(absolutePath);
  try {
    mkdirSync(dbDir, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore error
  }
  // Use absolute path for LibSQL
  dbPath = `file:${absolutePath}`;
}

// Check if we have API keys for embeddings
const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
const hasGoogleKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

// Determine embedding model and whether to enable semantic recall
type EmbeddingModelId =
  | "openai/text-embedding-3-small"
  | "openai/text-embedding-3-large"
  | "openai/text-embedding-ada-002"
  | "google/gemini-embedding-001"
  | "google/text-embedding-004";

let embedder: EmbeddingModelId | undefined;
let enableSemanticRecall = false;

if (hasOpenAIKey || hasGoogleKey) {
  // Use OpenAI by default if available, otherwise Google
  const embeddingModel = (process.env.EMBEDDING_MODEL || 
    (hasOpenAIKey ? "openai/text-embedding-3-small" : "google/text-embedding-004")) as EmbeddingModelId;
  
  embedder = embeddingModel;
  enableSemanticRecall = true;
}

// Create memory instance with LibSQL storage and vector database
// Semantic recall is only enabled if an embedding API key is available
const memoryConfig: {
  storage: LibSQLStore;
  vector?: LibSQLVector;
  embedder?: EmbeddingModelId;
  options: {
    lastMessages: number;
    semanticRecall: boolean | { topK: number; messageRange: number };
    threads: { generateTitle: boolean };
  };
} = {
  storage: new LibSQLStore({
    url: dbPath,
  }),
  options: {
    lastMessages: 10, // Keep last 10 messages in context
    semanticRecall: enableSemanticRecall
      ? {
          topK: 5, // Retrieve top 5 most relevant messages
          messageRange: 2, // Include 2 messages before and after each match for context
        }
      : false, // Disable semantic recall if no API key
    threads: {
      generateTitle: true, // Automatically generate thread titles
    },
  },
};

// Only add vector and embedder if semantic recall is enabled
if (enableSemanticRecall && embedder) {
  memoryConfig.vector = new LibSQLVector({
    connectionUrl: dbPath,
  });
  memoryConfig.embedder = embedder;
}

export const memory = new Memory(memoryConfig);

