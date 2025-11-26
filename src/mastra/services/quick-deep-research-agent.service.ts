import { Injectable } from '@nestjs/common';
import { quickDeepResearchTool } from '../tools/deep-research-tools';
import { ProcessorType } from '../quick-deep-research-agent.controller';
import { BaseResearchAgentService } from './base-research-agent.service';

@Injectable()
export class QuickDeepResearchAgentService extends BaseResearchAgentService {
  async research(
    query: string,
    processor?: ProcessorType,
    includeAnalysis?: boolean,
  ): Promise<any> {
    const toolInput: any = {
      query,
      includeAnalysis: includeAnalysis !== undefined ? includeAnalysis : true,
    };

    if (processor) {
      toolInput.processor = processor;
    }

    const runtimeContext = this.createRuntimeContext();

    return await quickDeepResearchTool.execute({
      context: toolInput,
      mastra: this.getMastra(),
      runtimeContext,
    });
  }
}

