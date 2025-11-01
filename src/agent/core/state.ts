import { AnalysisState } from './simpleAnalysisAgent';

export type BoilerplateState = AnalysisState;

export function getInitialState(): BoilerplateState {
  return { initialized: false };
}

