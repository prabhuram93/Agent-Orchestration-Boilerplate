export abstract class IAnalysisAgent {
  abstract getLogs(reset?: boolean): Promise<string>;
  abstract queueUserRequest(request: string): void;
}

