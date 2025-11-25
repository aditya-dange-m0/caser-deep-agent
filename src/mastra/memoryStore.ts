import { config } from 'dotenv';
config();

import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

// Ensure data directory exists
let dbPath = process.env.LIBSQL_URL || "file:./data/web-search-agent-memory.db";
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

// Subclass LibSQLStore to safely handle schema initialization
class SafeLibSQLStore extends LibSQLStore {
  private initAttempts = 0;
  private maxInitAttempts = 3;

  async init(): Promise<void> {
    try {
      // Let Mastra handle its own table creation and management
      await super.init();
      console.log(
        '[Mastra] LibSQLStore initialized successfully - Mastra tables managed automatically',
      );
    } catch (err: any) {
      // Handle common database errors gracefully
      if (err.code === 'SQLITE_ERROR' && err.message?.includes('already exists')) {
        console.warn(
          '[Mastra] Handling schema differences - Mastra will manage table structure:',
          err.message,
        );
        // Continue without throwing error for schema mismatches
        return;
      } else if (this.initAttempts < this.maxInitAttempts && 
                (err.message?.includes('connection') || err.code === 'ECONNREFUSED')) {
        this.initAttempts++;
        console.warn(
          `[Mastra] Retrying LibSQLStore init (attempt ${this.initAttempts}/${this.maxInitAttempts}):`,
          err.message,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000 * this.initAttempts));
        return this.init();
      } else {
        console.error(
          '[Mastra] Failed to initialize LibSQLStore:',
          err.message,
        );
        // Don't throw for schema-related errors, let Mastra handle them
        if (err.code && ['SQLITE_ERROR'].includes(err.code)) {
          console.warn('[Mastra] Continuing despite schema error - Mastra will self-manage');
          return;
        }
        throw err;
      }
    }
  }
}

// Singleton instances to prevent duplicate database objects
export const libSQLStore = new SafeLibSQLStore({
  url: dbPath,
});

export const libSQLVector = new LibSQLVector({
  connectionUrl: dbPath,
});

// Initialize stores with error handling
export async function initializeStores() {
  try {
    await libSQLStore.init();
    console.log('[Mastra] Memory stores initialized successfully');
  } catch (error) {
    console.error('[Mastra] Failed to initialize memory stores:', error);
    throw error;
  }
}

