import { IStateManager } from '../interfaces/IStateManager';
import { BoilerplateState } from '../../core/state';

export class StateManager implements IStateManager {
  private getStateFn: () => BoilerplateState;
  private setStateFn: (s: BoilerplateState) => void;

  constructor(getState: () => BoilerplateState, setState: (s: BoilerplateState) => void) {
    this.getStateFn = getState;
    this.setStateFn = setState;
  }

  getState(): BoilerplateState {
    return this.getStateFn();
  }

  setState(state: BoilerplateState): void {
    this.setStateFn(state);
  }

  batchUpdate(updates: Partial<BoilerplateState>): void {
    const current = this.getStateFn();
    this.setStateFn({ ...current, ...updates });
  }
}

