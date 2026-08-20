import type { BallId, FloorId } from '../physics/params';

/**
 * Progression.
 *
 * The first two trials are fixed on purpose: same ball, same height, one
 * control. Everything the child could otherwise fiddle with is held by the
 * machine, so the only variable left is the floor — which is the thing they
 * are supposed to notice.
 *
 * After that, freedom opens one axis at a time, and only in response to what
 * the child actually does. A child who is happily repeating the same drop is
 * not pestered; a timer eventually opens the next axis anyway, because a
 * locked control that never appears is just as bad as one that appears too
 * early.
 */

export type Phase =
  | 'boot'
  | 'trial1.ready'
  | 'trial1.falling'
  | 'trial1.result'
  | 'presenting'
  | 'trial2.ready'
  | 'trial2.falling'
  | 'trial2.result'
  | 'free';

export interface Unlocks {
  floors: boolean;
  balls: boolean;
  height: boolean;
  chain: boolean;
}

export interface Metrics {
  /** Seconds from the first frame until the ring was first touched. */
  timeToFirstTouch: number | null;
  /** Did the child run a second floor without being told to? */
  triedSecondFloorAlone: boolean;
  /** Did they change only the floor, keeping the same ball? */
  isolatedTheFloor: boolean;
  /** Did they change the ball or the height once they understood? */
  variedBallOrHeight: boolean;
  /** Did they fill all three cradles and run a chain? */
  builtChain: boolean;
  /** Times the exact same combination was run back to back. */
  repeats: number;
  dropsTotal: number;
  dropsAfterUnderstanding: number;
  floorsTried: Set<FloorId>;
  ballsTried: Set<BallId>;
  heightsTried: Set<number>;
  chainRuns: number;
  sweeps: number;
}

interface Combo {
  floor: FloorId;
  ball: BallId;
  height: number;
}

const STORAGE_KEY = 'hanekaeri.session.v1';

export class GameState {
  phase: Phase = 'boot';
  unlocks: Unlocks = { floors: false, balls: false, height: false, chain: false };
  metrics: Metrics = {
    timeToFirstTouch: null,
    triedSecondFloorAlone: false,
    isolatedTheFloor: false,
    variedBallOrHeight: false,
    builtChain: false,
    repeats: 0,
    dropsTotal: 0,
    dropsAfterUnderstanding: 0,
    floorsTried: new Set(),
    ballsTried: new Set(),
    heightsTried: new Set(),
    chainRuns: 0,
    sweeps: 0,
  };

  /** Seconds since the pavilion was ready to be touched. */
  elapsed = 0;
  /** Seconds since the second trial finished. */
  freeElapsed = 0;
  /** Seconds since anything at all was touched. */
  idle = 0;

  private lastCombo: Combo | null = null;
  private floorChangesByChild = 0;
  private ballChangesByChild = 0;
  private heightChangesByChild = 0;
  private dropsSinceFloorChange = 0;

  get understood() {
    return this.phase === 'free';
  }

  tick(dt: number) {
    this.elapsed += dt;
    this.idle += dt;
    if (this.phase === 'free') {
      this.freeElapsed += dt;
      this.evaluateUnlocks();
    }
  }

  touched() {
    if (this.metrics.timeToFirstTouch === null) this.metrics.timeToFirstTouch = this.elapsed;
    this.idle = 0;
  }

  enterFree() {
    if (this.phase === 'free') return;
    this.phase = 'free';
    this.freeElapsed = 0;
    // Choosing the floor is the first freedom, because it is the one the
    // child has just been shown to matter.
    this.unlocks.floors = true;
    this.save();
  }

  noteFloorChange(byChild: boolean) {
    if (byChild) {
      this.floorChangesByChild++;
      this.dropsSinceFloorChange = 0;
      this.idle = 0;
    }
  }

  noteBallChange() {
    this.ballChangesByChild++;
    this.idle = 0;
    if (this.understood) this.metrics.variedBallOrHeight = true;
  }

  noteHeightChange() {
    this.heightChangesByChild++;
    this.idle = 0;
    if (this.understood) this.metrics.variedBallOrHeight = true;
  }

  noteSweep() {
    this.metrics.sweeps++;
    this.idle = 0;
  }

  noteChainRun(filledSlots: number) {
    this.metrics.chainRuns++;
    if (filledSlots >= 3) this.metrics.builtChain = true;
  }

  noteDrop(floor: FloorId, ball: BallId, height: number) {
    this.metrics.dropsTotal++;
    this.metrics.floorsTried.add(floor);
    this.metrics.ballsTried.add(ball);
    this.metrics.heightsTried.add(height);
    this.idle = 0;
    if (this.understood) {
      this.metrics.dropsAfterUnderstanding++;
      this.dropsSinceFloorChange++;
      if (this.floorChangesByChild >= 1) this.metrics.triedSecondFloorAlone = true;
      if (this.lastCombo && this.lastCombo.ball === ball && this.lastCombo.height === height && this.lastCombo.floor !== floor) {
        this.metrics.isolatedTheFloor = true;
      }
    }
    if (this.lastCombo && this.lastCombo.floor === floor && this.lastCombo.ball === ball && this.lastCombo.height === height) {
      this.metrics.repeats++;
    }
    this.lastCombo = { floor, ball, height };
    this.save();
  }

  private evaluateUnlocks() {
    const m = this.metrics;
    if (!this.unlocks.balls) {
      // Once they have run the comparison themselves — or simply kept
      // playing for a while — the specimens become available.
      if ((this.floorChangesByChild >= 1 && m.dropsAfterUnderstanding >= 2) || this.freeElapsed > 55) {
        this.unlocks.balls = true;
        this.save();
      }
    }
    if (this.unlocks.balls && !this.unlocks.height) {
      if ((this.ballChangesByChild >= 1 && m.dropsAfterUnderstanding >= 3) || this.freeElapsed > 110) {
        this.unlocks.height = true;
        this.save();
      }
    }
    if (this.unlocks.height && !this.unlocks.chain) {
      const varied = this.ballChangesByChild + this.heightChangesByChild;
      if ((varied >= 2 && m.dropsAfterUnderstanding >= 5) || this.freeElapsed > 175) {
        this.unlocks.chain = true;
        this.save();
      }
    }
  }

  /**
   * Session persistence. Nothing leaves the device — this exists so that a
   * rotation-triggered reload, or Safari discarding the page, does not throw
   * away what the child has built.
   */
  save() {
    try {
      const payload = {
        phase: this.phase,
        unlocks: this.unlocks,
        elapsed: this.elapsed,
        freeElapsed: this.freeElapsed,
        floorChangesByChild: this.floorChangesByChild,
        ballChangesByChild: this.ballChangesByChild,
        heightChangesByChild: this.heightChangesByChild,
        metrics: {
          ...this.metrics,
          floorsTried: [...this.metrics.floorsTried],
          ballsTried: [...this.metrics.ballsTried],
          heightsTried: [...this.metrics.heightsTried],
        },
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Private browsing or a full quota: play on regardless.
    }
  }

  static restore(): Partial<GameState> | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as Partial<GameState>;
    } catch {
      return null;
    }
  }

  applyRestored(data: Record<string, unknown>) {
    if (!data) return;
    if (typeof data.phase === 'string') this.phase = data.phase as Phase;
    if (data.unlocks) Object.assign(this.unlocks, data.unlocks);
    if (typeof data.elapsed === 'number') this.elapsed = data.elapsed;
    if (typeof data.freeElapsed === 'number') this.freeElapsed = data.freeElapsed;
    if (typeof data.floorChangesByChild === 'number') this.floorChangesByChild = data.floorChangesByChild;
    if (typeof data.ballChangesByChild === 'number') this.ballChangesByChild = data.ballChangesByChild;
    if (typeof data.heightChangesByChild === 'number') this.heightChangesByChild = data.heightChangesByChild;
    const m = data.metrics as Record<string, unknown> | undefined;
    if (m) {
      Object.assign(this.metrics, m);
      this.metrics.floorsTried = new Set((m.floorsTried as FloorId[]) ?? []);
      this.metrics.ballsTried = new Set((m.ballsTried as BallId[]) ?? []);
      this.metrics.heightsTried = new Set((m.heightsTried as number[]) ?? []);
    }
  }

  get childFloorChanges() {
    return this.floorChangesByChild;
  }

  get childBallChanges() {
    return this.ballChangesByChild;
  }

  get childHeightChanges() {
    return this.heightChangesByChild;
  }

  get dropsOnCurrentFloor() {
    return this.dropsSinceFloorChange;
  }
}
