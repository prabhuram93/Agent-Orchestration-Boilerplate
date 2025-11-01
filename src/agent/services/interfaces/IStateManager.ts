import { BoilerplateState } from '../../core/state';

export interface IStateManager {
  getState(): BoilerplateState;
  setState(state: BoilerplateState): void;
  batchUpdate(updates: Partial<BoilerplateState>): void;
}

