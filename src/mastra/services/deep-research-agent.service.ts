import { Injectable } from '@nestjs/common';
import { deepResearchTool } from '../tools/deep-research-tools';
import { ProcessorType } from '../deep-research-agent.controller';
import { BaseResearchAgentService } from './base-research-agent.service';

@Injectable()
export class DeepResearchAgentService extends BaseResearchAgentService {
  async research(
    query: string,
    processor?: ProcessorType,
    outputFormat?: 'auto' | 'text',
  ): Promise<any> {
    const toolInput: any = {
      query,
      outputFormat: outputFormat || 'auto',
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

