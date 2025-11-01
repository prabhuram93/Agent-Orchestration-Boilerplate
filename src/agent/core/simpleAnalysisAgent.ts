import { Agent } from '../../agents-shim';
import { StateManager } from '../services/implementations/StateManager';
import { FileManager } from '../services/implementations/FileManager';
import { AnalysisAgentInterface } from '../services/implementations/AnalysisAgent';
import { PhasePlanningOperation } from '../operations/PhasePlanning';
import { BusinessLogicExtractionOperation } from '../operations/BusinessLogicExtraction';
import { ComplexityAnalysisOperation } from '../operations/ComplexityAnalysis';
import { ReportingOperation } from '../operations/Reporting';
import type { OperationOptions } from '../operations/common';

export interface AnalysisState {
  initialized: boolean;
  currentStep?: string;
  results?: Record<string, unknown>;
}

export interface AgentInitArgs {
  repositoryUrl?: string;
  rootPath?: string;
  inferenceContext?: unknown;
  onProgress?: (message: string) => void;
}

export class SimpleAnalysisAgent extends Agent<unknown, AnalysisState> {
  private initArgs?: AgentInitArgs;

  protected stateManager: StateManager = new StateManager(() => this.state, (s) => this.setState(s));
  protected fileManager: FileManager = new FileManager();
  protected analysisAgent: AnalysisAgentInterface = new AnalysisAgentInterface(this);

  protected operations = {
    planning: new PhasePlanningOperation(),
    extract: new BusinessLogicExtractionOperation(),
    complexity: new ComplexityAnalysisOperation(),
    reporting: new ReportingOperation()
  };

  async initialize(args: AgentInitArgs): Promise<AnalysisState> {
    this.initArgs = args;
    this.setState({ initialized: true, currentStep: 'initialized' });
    args.onProgress?.('Agent initialized');
    return this.state;
  }

  async runEndToEnd(): Promise<void> {
    const rootPath = this.initArgs?.rootPath || '';
    const onProgress = this.initArgs?.onProgress;

    const options: OperationOptions = {
      env: undefined,
      logger: undefined,
      context: { rootPath }
    };

    onProgress?.('Planning modules...');
    this.stateManager.batchUpdate({ currentStep: 'planning' });

    const plan = await this.operations.planning.execute({ rootPath }, options);
    const discoveredModules = await this.fileManager.listPhpModules(rootPath);
    const modules = plan.modules.length > 0 ? plan.modules : discoveredModules;

    onProgress?.(`Found ${modules.length} modules. Extracting business logic and computing complexity...`);
    this.stateManager.batchUpdate({ currentStep: 'analyzing' });

    const results: Record<string, unknown>[] = [];
    for (const modulePath of modules) {
      const logic = await this.operations.extract.execute({ modulePath }, options);
      const complexity = await this.operations.complexity.execute({ modulePath }, options);
      results.push({ modulePath, logic, complexity });
      onProgress?.(`Analyzed: ${modulePath}`);
    }

    onProgress?.('Building report...');
    this.stateManager.batchUpdate({ currentStep: 'reporting' });

    const summary = await this.operations.reporting.execute({ results }, options);
    this.stateManager.batchUpdate({ currentStep: 'complete', results: { summary, results } });
    onProgress?.('Analysis complete');
  }
}

