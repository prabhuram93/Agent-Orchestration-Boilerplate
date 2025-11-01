import { AgentOperation, OperationOptions } from './common';

export interface PhasePlanningInputs {
  rootPath: string;
}

export interface PhasePlan {
  modules: string[];
  priorities: string[];
}

export class PhasePlanningOperation extends AgentOperation<PhasePlanningInputs, PhasePlan> {
  async execute(inputs: PhasePlanningInputs, _options: OperationOptions): Promise<PhasePlan> {
    // In boilerplate, leave empty; FileManager can perform discovery
    return { modules: [], priorities: [] };
  }
}

