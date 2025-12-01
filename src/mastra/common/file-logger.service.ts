/**
 * File logging service for Parallel AI agent runs
 * Creates separate log files for each agent run with all events
 */
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

@Injectable()
export class FileLoggerService {
  private readonly logger = new Logger(FileLoggerService.name);
  private readonly logsDirectory: string;
  private readonly logFileMap = new Map<string, string>(); // runId -> logFilePath

  constructor() {
    // Create logs directory in project root
    this.logsDirectory = path.join(process.cwd(), 'logs', 'parallel-ai-runs');
    this.ensureLogsDirectory();
  }

  /**
   * Ensure logs directory exists
   */
  private async ensureLogsDirectory(): Promise<void> {
    try {
      if (!existsSync(this.logsDirectory)) {
        await fs.mkdir(this.logsDirectory, { recursive: true });
        this.logger.log(`[FileLogger] Created logs directory: ${this.logsDirectory}`);
      }
    } catch (error) {
      this.logger.error(`[FileLogger] Failed to create logs directory:`, error);
    }
  }

  /**
   * Create a new log file for a run
   *
   * @param runId - The Parallel AI run ID
   * @param metadata - Additional metadata about the run
   * @returns The path to the log file
   */
  async createRunLog(
    runId: string,
    metadata?: {
      query?: string;
      processor?: string;
      serviceName?: string;
      [key: string]: unknown;
    },
  ): Promise<string> {
    try {
      await this.ensureLogsDirectory();

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sanitizedRunId = runId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${timestamp}_${sanitizedRunId}.log`;
      const filePath = path.join(this.logsDirectory, filename);

      // Create log file with initial metadata
      const initialContent = this.formatLogEntry('RUN_START', {
        runId,
        timestamp: new Date().toISOString(),
        metadata,
      });

      await fs.writeFile(filePath, initialContent, 'utf-8');
      this.logFileMap.set(runId, filePath);

      this.logger.log(
        `[FileLogger] Created log file for run_id: ${runId} -> ${filePath}`,
      );

      return filePath;
    } catch (error) {
      this.logger.error(
        `[FileLogger] Failed to create log file for run_id ${runId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Write an event to the log file
   *
   * @param runId - The Parallel AI run ID
   * @param eventType - Type of event
   * @param data - Event data
   */
  async logEvent(
    runId: string,
    eventType: string,
    data: unknown,
  ): Promise<void> {
    try {
      let filePath = this.logFileMap.get(runId);

      // Create log file if it doesn't exist
      if (!filePath) {
        filePath = await this.createRunLog(runId, {
          serviceName: 'Unknown',
        });
      }

      const logEntry = this.formatLogEntry(eventType, data);
      await fs.appendFile(filePath, logEntry, 'utf-8');
    } catch (error) {
      // Don't throw - logging failures shouldn't break the application
      this.logger.warn(
        `[FileLogger] Failed to write event to log for run_id ${runId}:`,
        error,
      );
    }
  }

  /**
   * Log task creation
   *
   * @param runId - The run ID
   * @param taskInfo - Task creation information
   */
  async logTaskCreation(
    runId: string,
    taskInfo: {
      query?: string;
      processor?: string;
      taskInputLength?: number;
      serviceName?: string;
    },
  ): Promise<void> {
    await this.logEvent(runId, 'TASK_CREATED', {
      ...taskInfo,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log SSE event
   *
   * @param runId - The run ID
   * @param eventType - SSE event type
   * @param data - Event data
   */
  async logSseEvent(
    runId: string,
    eventType: string,
    data: unknown,
  ): Promise<void> {
    await this.logEvent(runId, `SSE_${eventType}`, {
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log stream completion
   *
   * @param runId - The run ID
   * @param result - Completion result
   */
  async logStreamCompletion(
    runId: string,
    result: {
      status: string;
      eventCount?: number;
      outputLength?: number;
      error?: string;
    },
  ): Promise<void> {
    await this.logEvent(runId, 'RUN_COMPLETE', {
      ...result,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log error
   *
   * @param runId - The run ID
   * @param error - Error information
   */
  async logError(
    runId: string,
    error: {
      message: string;
      type?: string;
      stack?: string;
      [key: string]: unknown;
    },
  ): Promise<void> {
    await this.logEvent(runId, 'ERROR', {
      ...error,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Format a log entry
   *
   * @param eventType - Type of event
   * @param data - Event data
   * @returns Formatted log entry string
   */
  private formatLogEntry(eventType: string, data: unknown): string {
    const timestamp = new Date().toISOString();
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

    return `[${timestamp}] [${eventType}]\n${dataStr}\n${'='.repeat(80)}\n\n`;
  }

  /**
   * Get log file path for a run
   *
   * @param runId - The run ID
   * @returns The log file path or null if not found
   */
  getLogFilePath(runId: string): string | null {
    return this.logFileMap.get(runId) || null;
  }

  /**
   * Clean up old log files (older than specified days)
   *
   * @param daysToKeep - Number of days to keep logs (default: 30)
   */
  async cleanOldLogs(daysToKeep: number = 30): Promise<void> {
    try {
      await this.ensureLogsDirectory();
      const files = await fs.readdir(this.logsDirectory);
      const now = Date.now();
      const maxAge = daysToKeep * 24 * 60 * 60 * 1000; // Convert to milliseconds

      for (const file of files) {
        if (!file.endsWith('.log')) continue;

        const filePath = path.join(this.logsDirectory, file);
        const stats = await fs.stat(filePath);
        const age = now - stats.mtime.getTime();

        if (age > maxAge) {
          await fs.unlink(filePath);
          this.logger.log(`[FileLogger] Deleted old log file: ${file}`);
        }
      }
    } catch (error) {
      this.logger.warn(`[FileLogger] Failed to clean old logs:`, error);
    }
  }
}

