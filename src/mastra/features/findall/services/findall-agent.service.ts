import { Injectable } from '@nestjs/common';
import {
  findAllIngestTool,
  findAllRunTool,
  findAllStatusTool,
  findAllResultsTool,
  findAllCompleteTool,
} from '../../../tools/findall-tools';
import { BaseResearchAgentService } from '../../../shared/services/base-research-agent.service';

export enum GeneratorType {
  BASE = 'base',
  CORE = 'core',
  PRO = 'pro',
}

@Injectable()
export class FindAllAgentService extends BaseResearchAgentService {
  async ingest(objective: string): Promise<any> {
    const runtimeContext = this.createRuntimeContext();

    if (!findAllIngestTool) {
      throw new Error('findAllIngestTool is not available');
    }

    return await findAllIngestTool.execute(
      { objective },
      {
        mastra: this.getMastra(),
        runtimeContext,
      },
    );
  }

  async createRun(
    objective: string,
    generator?: GeneratorType,
    matchLimit?: number,
    entityType?: string,
    matchConditions?: Array<{ name: string; description: string }>,
    enrichments?: string[],
  ): Promise<any> {
    const runtimeContext = this.createRuntimeContext();

    const toolInput: any = {
      objective,
      generator: generator || 'core',
      match_limit: matchLimit || 10,
    };

    if (entityType) {
      toolInput.entity_type = entityType;
    }

    if (matchConditions && matchConditions.length > 0) {
      toolInput.match_conditions = matchConditions;
    }

    if (enrichments && enrichments.length > 0) {
      toolInput.enrichments = enrichments;
    }

    if (!findAllRunTool) {
      throw new Error('findAllRunTool is not available');
    }

    return await findAllRunTool.execute(toolInput, {
      mastra: this.getMastra(),
      runtimeContext,
    });
  }

  async getStatus(findallId: string): Promise<any> {
    const runtimeContext = this.createRuntimeContext();

    if (!findAllStatusTool) {
      throw new Error('findAllStatusTool is not available');
    }

    return await findAllStatusTool.execute(
      { findall_id: findallId },
      {
        mastra: this.getMastra(),
        runtimeContext,
      },
    );
  }

  async getResults(
    findallId: string,
    waitForCompletion?: boolean,
    maxWaitSeconds?: number,
  ): Promise<any> {
    const runtimeContext = this.createRuntimeContext();

    if (!findAllResultsTool) {
      throw new Error('findAllResultsTool is not available');
    }

    return await findAllResultsTool.execute(
      {
        findall_id: findallId,
        wait_for_completion:
          waitForCompletion !== undefined ? waitForCompletion : true,
        max_wait_seconds: maxWaitSeconds || 900,
      },
      {
        mastra: this.getMastra(),
        runtimeContext,
      },
    );
  }

  async complete(
    objective: string,
    generator?: GeneratorType,
    matchLimit?: number,
    enrichments?: string[],
    maxWaitSeconds?: number,
  ): Promise<any> {
    const runtimeContext = this.createRuntimeContext();

    if (!findAllCompleteTool) {
      throw new Error('findAllCompleteTool is not available');
    }

    return await findAllCompleteTool.execute(
      {
        objective,
        generator: generator || 'core',
        match_limit: matchLimit || 10,
        enrichments: enrichments || [],
        max_wait_seconds: maxWaitSeconds || 900,
      },
      {
        mastra: this.getMastra(),
        runtimeContext,
      },
    );
  }
}
