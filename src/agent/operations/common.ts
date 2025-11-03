export interface OperationOptions {
  env: unknown;
  logger: unknown;
  context: Record<string, unknown>;
  sandbox?: any;
  progress?: (message: string) => void;
}

export abstract class AgentOperation<InputType, OutputType> {
  abstract execute(inputs: InputType, options: OperationOptions): Promise<OutputType>;
}

