import { Injectable } from '@nestjs/common';
import { quickDeepResearchTool } from '../tools/deep-research-tools';
import { ProcessorType } from '../quick-deep-research-agent.controller';
import { mastra } from '../index';
import { RuntimeContext } from '@mastra/core/runtime-context';

@Injectable()
export class QuickDeepResearchAgentService {
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

    const userId = 'api-user';
    const threadId = `thread-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const resourceId = `resource-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const runtimeContext = new RuntimeContext([
      ['userId', userId],
      ['threadId', threadId],
      ['resourceId', resourceId],
    ]);

    const result = await quickDeepResearchTool.execute({
      context: toolInput,
      mastra: mastra,
      runtimeContext,
    });

    return result;
  }
}

