import { Injectable } from '@nestjs/common';
import { webSearchTool } from '../tools/web-search-tools';
import { ProcessorType, SearchDepth } from '../web-search-agent.controller';
import { BaseResearchAgentService } from './base-research-agent.service';

@Injectable()
export class WebSearchAgentService extends BaseResearchAgentService {
  async search(
    query: string,
    processor?: ProcessorType,
    searchDepth?: SearchDepth,
    maxResults?: number,
    includeExcerpts?: boolean,
  ): Promise<any> {
    const toolInput: any = {
      query,
      maxResults: maxResults || 10,
      includeExcerpts: includeExcerpts !== undefined ? includeExcerpts : true,
    };

    if (processor) {
      toolInput.processor = processor;
    } else {
      toolInput.searchDepth = searchDepth || 'basic';
    }

    const runtimeContext = this.createRuntimeContext();

    return await webSearchTool.execute({
      context: toolInput,
      mastra: this.getMastra(),
      runtimeContext,
    });
  }
}
