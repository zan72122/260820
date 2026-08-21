import { GameState } from '../core/StateMachine';

export interface GuidanceHooks {
  /** One quiet pulse of water inside the live bores. */
  nozzlePulse: (strength: number) => void;
  /** A single drop gathering and falling back into a bore. */
  drip: () => void;
  /** The raft rocks where it waits. */
  rockRaft: () => void;
  /** The lever shivers with the pressure standing behind it. */
  leverShiver: (strength: number) => void;
  /** The launch dog knocks once against the waiting raft. */
  launchNudge: () => void;
}

/**
 * The whole hint system. It never draws an arrow, never flashes a button and
 * never speaks: it only makes the equipment do the small physical things it
 * would really do, on a slow schedule, so noticing stays the child's job.
 */
export class ChildGuidanceState {
  private idle = 0;
  private hintCount = 0;
  private lastState: GameState = GameState.BOOT;
  private cooldown = 0;

  constructor(private readonly hooks: GuidanceHooks) {}

  /** Any deliberate action from the child resets the schedule. */
  notifyActivity(): void {
    this.idle = 0;
    this.hintCount = 0;
  }

  update(dt: number, state: GameState, blastCharge: number): void {
    if (state !== this.lastState) {
      this.lastState = state;
      this.idle = 0;
      this.hintCount = 0;
      this.cooldown = 0;
    }
    if (blastCharge > 0.05) {
      // They have found it. Nothing more to say.
      this.idle = 0;
      this.hintCount = 0;
      return;
    }
    this.idle += dt;
    this.cooldown -= dt;
    if (this.cooldown > 0) return;

    switch (state) {
      case GameState.RAFT_RESTS_BEFORE_HILL:
      case GameState.DISCOVER_NOZZLES: {
        const first = this.hintCount === 0;
        const wait = first ? 1.6 : 6.5;
        if (this.idle >= wait) {
          this.hintCount++;
          this.idle = 0;
          this.cooldown = 1.4;
          const strength = Math.min(0.35 + this.hintCount * 0.15, 0.8);
          this.hooks.nozzlePulse(strength);
          this.hooks.leverShiver(strength);
          this.hooks.rockRaft();
          if (!first) this.hooks.drip();
        }
        break;
      }
      case GameState.RELEASE_TEST_RAFT:
      case GameState.CHANGE_ONE_VARIABLE: {
        if (this.idle >= (this.hintCount === 0 ? 5.5 : 7.5)) {
          this.hintCount++;
          this.idle = 0;
          this.cooldown = 2;
          this.hooks.launchNudge();
        }
        break;
      }
      default:
        break;
    }
  }
}
