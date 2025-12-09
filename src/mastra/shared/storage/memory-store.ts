import { PostgresStore } from '@mastra/pg';

const connectionString = process.env.DATABASE_URL!;

// Determine if SSL should be enabled based on connection string
// Local connections (localhost, 127.0.0.1) typically don't need SSL
const isLocalConnection =
  connectionString.includes('localhost') ||
  connectionString.includes('127.0.0.1') ||
  connectionString.includes(':5433'); // Docker port

// SSL configuration - only enable for remote/production connections
const sslConfig = isLocalConnection
  ? false // Disable SSL for local development
  : {
      rejectUnauthorized: false, // Enable SSL for production (cloud databases)
    };

class SafePostgresStore extends PostgresStore {
  private initAttempts = 0;
  private maxInitAttempts = 3;

  async init(): Promise<void> {
    try {
      await super.init();
      console.log('[Mastra] Memory store initialized successfully');
    } catch (err: any) {
      if (
        err.code === '42P07' ||
        err.code === '42701' ||
        err.code === '42703'
      ) {
        // 42P07: relation already exists, others are column issues
        console.warn(
          '[Mastra] Handling schema differences - Mastra will manage table structure:',
          err.message,
        );
        return;
      } else if (
        this.initAttempts < this.maxInitAttempts &&
        (err.message?.includes('connection') || err.code === 'ECONNREFUSED')
      ) {
        this.initAttempts++;
        console.warn(
          `[Mastra] Retrying memory store init (attempt ${this.initAttempts}/${this.maxInitAttempts}):`,
          err.message,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, 2000 * this.initAttempts),
        );
        return this.init();
      } else {
        console.error(
          '[Mastra] Failed to initialize memory store:',
          err.message,
        );
        if (
          err.code &&
          ['42P07', '42701', '42703', '42P01'].includes(err.code)
        ) {
          console.warn(
            '[Mastra] Continuing despite schema error - Mastra will self-manage',
          );
          return;
        }
        throw err;
      }
    }
  }
}

export const memoryStore = new SafePostgresStore({
  connectionString,
  ...(sslConfig !== false ? { ssl: sslConfig } : {}), // Only add SSL config for production
});

export async function initializeStores() {
  try {
    await memoryStore.init();
    console.log('[Mastra] Memory stores initialized successfully');
  } catch (error) {
    console.error('[Mastra] Failed to initialize memory stores:', error);
    throw error;
  }
}

