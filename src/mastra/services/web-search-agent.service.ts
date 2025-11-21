import { Injectable } from "@nestjs/common";
import { webSearchAgent } from "../agents/web-search-agent";

@Injectable()
export class WebSearchAgentService {
  async search(query: string): Promise<string> {
    const result = await webSearchAgent.generate(query);
    return result.text ?? result;
  }
}
