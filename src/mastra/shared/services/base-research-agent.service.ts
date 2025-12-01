import { Injectable } from '@nestjs/common';
import { mastra } from '../../index';
import { RuntimeContext } from '@mastra/core/runtime-context';

@Injectable()
export abstract class BaseResearchAgentService {
  protected createRuntimeContext(): RuntimeContext {
    const userId = 'api-user';
    const threadId = `thread-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const resourceId = `resource-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    return new RuntimeContext([
      ['userId', userId],
      ['threadId', threadId],
      ['resourceId', resourceId],
    ]);
  }

  protected getMastra() {
    return mastra;
  }
}
