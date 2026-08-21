/** The run of play, as an explicit machine. Every visual beat in the game
 *  hangs off one of these states - none of them are decorative. */
export enum GameState {
  BOOT = 'BOOT',
  OBSERVE_VALLEY = 'OBSERVE_VALLEY',
  RELEASE_TEST_RAFT = 'RELEASE_TEST_RAFT',
  RAFT_COASTS = 'RAFT_COASTS',
  RAFT_RESTS_BEFORE_HILL = 'RAFT_RESTS_BEFORE_HILL',
  DISCOVER_NOZZLES = 'DISCOVER_NOZZLES',
  PRESS_BLAST_CONTROL = 'PRESS_BLAST_CONTROL',
  JETS_FILL = 'JETS_FILL',
  RAFT_ACCELERATES = 'RAFT_ACCELERATES',
  CREST = 'CREST',
  SPLASH_FINISH = 'SPLASH_FINISH',
  CHANGE_ONE_VARIABLE = 'CHANGE_ONE_VARIABLE',
  REPLAY = 'REPLAY',
}

/**
 * Legal transitions. The blast half of the machine is deliberately
 * re-enterable: a raft that slides back down goes round again, and there is
 * no terminal failure state anywhere in this table.
 */
const TRANSITIONS: Record<GameState, GameState[]> = {
  [GameState.BOOT]: [GameState.OBSERVE_VALLEY],
  [GameState.OBSERVE_VALLEY]: [GameState.RELEASE_TEST_RAFT],
  [GameState.RELEASE_TEST_RAFT]: [GameState.RAFT_COASTS],
  [GameState.RAFT_COASTS]: [
    GameState.RAFT_RESTS_BEFORE_HILL,
    GameState.PRESS_BLAST_CONTROL,
    GameState.CREST,
  ],
  [GameState.RAFT_RESTS_BEFORE_HILL]: [GameState.DISCOVER_NOZZLES],
  [GameState.DISCOVER_NOZZLES]: [GameState.PRESS_BLAST_CONTROL, GameState.RAFT_COASTS],
  [GameState.PRESS_BLAST_CONTROL]: [GameState.JETS_FILL, GameState.RAFT_COASTS],
  [GameState.JETS_FILL]: [
    GameState.RAFT_ACCELERATES,
    GameState.RAFT_COASTS,
    GameState.RAFT_RESTS_BEFORE_HILL,
  ],
  [GameState.RAFT_ACCELERATES]: [
    GameState.CREST,
    GameState.RAFT_COASTS,
    GameState.RAFT_RESTS_BEFORE_HILL,
  ],
  [GameState.CREST]: [GameState.SPLASH_FINISH, GameState.RAFT_ACCELERATES],
  [GameState.SPLASH_FINISH]: [GameState.CHANGE_ONE_VARIABLE],
  [GameState.CHANGE_ONE_VARIABLE]: [GameState.REPLAY],
  [GameState.REPLAY]: [GameState.RELEASE_TEST_RAFT, GameState.OBSERVE_VALLEY],
};

export interface StateHooks {
  onEnter?: (from: GameState) => void;
  onExit?: (to: GameState) => void;
}

export class StateMachine {
  private current: GameState = GameState.BOOT;
  private hooks = new Map<GameState, StateHooks>();
  private listeners: ((to: GameState, from: GameState) => void)[] = [];
  /** Seconds spent in the current state. */
  elapsed = 0;
  /** Every transition of the session, useful for the smoke test. */
  readonly history: GameState[] = [GameState.BOOT];

  get state(): GameState {
    return this.current;
  }

  on(state: GameState, hooks: StateHooks): void {
    this.hooks.set(state, hooks);
  }

  onChange(fn: (to: GameState, from: GameState) => void): void {
    this.listeners.push(fn);
  }

  can(next: GameState): boolean {
    return TRANSITIONS[this.current].includes(next);
  }

  /** Returns true when the transition was legal and taken. */
  go(next: GameState): boolean {
    if (next === this.current) return false;
    if (!this.can(next)) return false;
    const from = this.current;
    this.hooks.get(from)?.onExit?.(next);
    this.current = next;
    this.elapsed = 0;
    this.history.push(next);
    if (this.history.length > 200) this.history.shift();
    this.hooks.get(next)?.onEnter?.(from);
    for (const l of this.listeners) l(next, from);
    return true;
  }

  update(dt: number): void {
    this.elapsed += dt;
  }
}

/** Coarse grouping the camera and audio use so they do not need to know
 *  about every single state. */
export function isBlasting(state: GameState): boolean {
  return (
    state === GameState.PRESS_BLAST_CONTROL ||
    state === GameState.JETS_FILL ||
    state === GameState.RAFT_ACCELERATES
  );
}

export function isRunning(state: GameState): boolean {
  return (
    state === GameState.RAFT_COASTS ||
    state === GameState.RAFT_RESTS_BEFORE_HILL ||
    state === GameState.DISCOVER_NOZZLES ||
    isBlasting(state) ||
    state === GameState.CREST ||
    state === GameState.SPLASH_FINISH
  );
}
