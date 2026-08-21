import { RUNS } from '../core/Config';

/**
 * Run order. After the first success the game keeps offering another go, and
 * every next run differs from the one before it by exactly one thing: how
 * heavy the raft is, or where the water comes from.
 */
export class ReplayController {
  private index = 0;
  private direction = 1;
  private firstPassDone = false;

  get runIndex(): number {
    return this.index;
  }

  get preset() {
    return RUNS[this.index];
  }

  /** What changed for this run, as something a child can see rather than read. */
  get changed(): 'first' | 'lighter' | 'heavier' | 'course' {
    return RUNS[this.index].changed;
  }

  reset(): void {
    this.index = 0;
    this.direction = 1;
    this.firstPassDone = false;
  }

  /** Move to the next run in the sequence. */
  advance(): number {
    if (!this.firstPassDone) {
      if (this.index < RUNS.length - 1) {
        this.index++;
        if (this.index === RUNS.length - 1) this.firstPassDone = true;
        return this.index;
      }
      this.firstPassDone = true;
    }
    // Afterwards, walk back and forth across runs 2-4 so each new go still
    // only changes one variable from the last one.
    const min = 1;
    const max = RUNS.length - 1;
    if (this.index >= max) this.direction = -1;
    if (this.index <= min) this.direction = 1;
    this.index = Math.min(max, Math.max(min, this.index + this.direction));
    return this.index;
  }

  /** Description used by the staging beat to pick which bag the rig moves. */
  bagsFor(index: number): number {
    return RUNS[index].bags;
  }
}
