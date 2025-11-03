export class Agent<TEnv = unknown, TState = Record<string, unknown>> {
  protected _state: TState = {} as TState;

  get state(): TState {
    return this._state;
  }

  protected setState(state: TState): void {
    this._state = state;
  }
}

