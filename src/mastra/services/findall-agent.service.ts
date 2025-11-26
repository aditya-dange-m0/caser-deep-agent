import { Injectable } from '@nestjs/common';
import {
  findAllIngestTool,
  findAllRunTool,
  findAllStatusTool,
  findAllResultsTool,
  findAllCompleteTool,
} from '../tools/findall-tools';
import { BaseResearchAgentService } from './base-research-agent.service';

export enum GeneratorType {
  BASE = 'base',
  CORE = 'core',
  PRO = 'pro',
}

@Injectable()
export class FindAllAgentService extends BaseResearchAgentService {
  async ingest(objective: string): Promise<any> {
    const runtimeContext = this.createRuntimeContext();

    return await findAllIngestTool.execute({
      context: { objective },
      mastra: this.getMastra(),
      runtimeContext,
    });
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

    return await findAllRunTool.execute({
      context: toolInput,
      mastra: this.getMastra(),
      runtimeContext,
    });
  }

  async getStatus(findallId: string): Promise<any> {
    const runtimeContext = this.createRuntimeContext();

    return await findAllStatusTool.execute({
      context: { findall_id: findallId },
      mastra: this.getMastra(),
      runtimeContext,
    });
  }

  async getResults(
    findallId: string,
    waitForCompletion?: boolean,
    maxWaitSeconds?: number,
  ): Promise<any> {
    const runtimeContext = this.createRuntimeContext();

    return await findAllResultsTool.execute({
      context: {
        findall_id: findallId,
        wait_for_completion: waitForCompletion !== undefined ? waitForCompletion : true,
        max_wait_seconds: maxWaitSeconds || 900,
      },
      mastra: this.getMastra(),
      runtimeContext,
    });
  }

  async complete(
    objective: string,
    generator?: GeneratorType,
    matchLimit?: number,
    enrichments?: string[],
    maxWaitSeconds?: number,
  ): Promise<any> {
    const runtimeContext = this.createRuntimeContext();

    return await findAllCompleteTool.execute({
      context: {
        objective,
        generator: generator || 'core',
        match_limit: matchLimit || 10,
        enrichments: enrichments || [],
        max_wait_seconds: maxWaitSeconds || 900,
      },
      mastra: this.getMastra(),
      runtimeContext,
    });
  }
}

