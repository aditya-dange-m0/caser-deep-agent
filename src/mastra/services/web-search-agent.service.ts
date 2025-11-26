import { Injectable } from '@nestjs/common';
import { webSearchTool } from '../tools/web-search-tools';
import { ProcessorType } from '../web-search-agent.controller';
import { SearchDepth } from '../web-search-agent.controller';
import { mastra } from '../index';
// Fix: Import RuntimeContext from the correct submodule
import { RuntimeContext } from '@mastra/core/runtime-context';

@Injectable()
export class WebSearchAgentService {
  async search(
    query: string,
    processor?: ProcessorType,
    searchDepth?: SearchDepth,
    maxResults?: number,
    includeExcerpts?: boolean,
  ): Promise<any> {
    // Prepare the tool input
    const toolInput: any = {
      query,
      maxResults: maxResults || 10,
      includeExcerpts: includeExcerpts !== undefined ? includeExcerpts : true,
    };

    // If processor is explicitly set, use it; otherwise use searchDepth
    if (processor) {
      toolInput.processor = processor;
    } else {
      toolInput.searchDepth = searchDepth || 'basic';
    }

    // Generate unique IDs for this request
    const userId = 'api-user';
    const threadId = `thread-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const resourceId = `resource-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Create RuntimeContext with initial values
    // RuntimeContext accepts an iterable of [key, value] tuples
    const runtimeContext = new RuntimeContext([
      ['userId', userId],
      ['threadId', threadId],
      ['resourceId', resourceId],
    ]);

    const result = await webSearchTool.execute({
      context: toolInput,
      mastra: mastra,
      runtimeContext,
    });

    return result;
  }
}
