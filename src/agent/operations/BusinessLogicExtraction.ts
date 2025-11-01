import { AgentOperation, OperationOptions } from './common';

export interface ExtractionInputs {
  modulePath: string;
}

export interface ExtractedBusinessLogic {
  module: string;
  entities: string[];
  services: string[];
  controllers: string[];
  workflows: string[];
}

export class BusinessLogicExtractionOperation extends AgentOperation<ExtractionInputs, ExtractedBusinessLogic> {
  async execute(inputs: ExtractionInputs, _options: OperationOptions): Promise<ExtractedBusinessLogic> {
    return {
      module: inputs.modulePath,
      entities: [],
      services: [],
      controllers: [],
      workflows: []
    };
  }
}

