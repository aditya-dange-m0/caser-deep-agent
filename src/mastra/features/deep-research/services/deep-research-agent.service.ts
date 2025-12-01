import { Injectable } from '@nestjs/common';
import { deepResearchTool } from '../../../tools/deep-research-tools';
import { ProcessorType } from '../deep-research-agent.controller';
import { BaseResearchAgentService } from '../../../shared/services/base-research-agent.service';

@Injectable()
export class DeepResearchAgentService extends BaseResearchAgentService {
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

    return await deepResearchTool.execute({
      context: toolInput,
      mastra: this.getMastra(),
      runtimeContext,
    });
  }
}
