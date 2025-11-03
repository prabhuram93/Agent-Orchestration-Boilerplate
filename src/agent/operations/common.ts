export interface OperationOptions {
  env: unknown;
  logger: unknown;
  context: Record<string, unknown>;
  sandbox?: any;
}

export abstract class AgentOperation<InputType, OutputType> {
  abstract execute(inputs: InputType, options: OperationOptions): Promise<OutputType>;
}

