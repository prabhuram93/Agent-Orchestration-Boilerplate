import { IAnalysisAgent } from '../interfaces/IAnalysisAgent';

export class AnalysisAgentInterface implements IAnalysisAgent {
  constructor(private readonly agent: unknown) {}

  async getLogs(_reset?: boolean): Promise<string> {
    return '';
  }

  queueUserRequest(_request: string): void {}
}

