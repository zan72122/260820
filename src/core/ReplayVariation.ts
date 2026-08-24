/**
 * One variable changes per run, and nothing is ever failed.
 *
 * Run 1 teaches the causal chain with the instructor's hand doing most of the
 * pointing. Run 2 removes most of that help and leaves only one thing to
 * discover: turning the valve slowly keeps the window open longer. Run 3
 * changes the module's tempo and nothing else. From run 4 the child works
 * through the whole sequence unaided.
 */
export interface RunConfig {
  index: number;
  /** 0 = no assistance from the instructor's hand, 1 = full. */
  guidance: number;
  bpm: number;
  /** Reveal the module automatically after the sound is understood. */
  autoReveal: boolean;
  /** Play the three-state comparison at the end. */
  comparison: boolean;
}

const BPM_CYCLE = [76, 76, 62, 92, 70, 84];

export class ReplayVariation {
  private run = 0;

  get index(): number {
    return this.run;
  }

  config(): RunConfig {
    const i = this.run;
    return {
      index: i,
      guidance: i === 0 ? 1 : i === 1 ? 0.45 : i === 2 ? 0.2 : 0.08,
      bpm: i < 2 ? BPM_CYCLE[0] : BPM_CYCLE[Math.min(i, BPM_CYCLE.length - 1)],
      autoReveal: i === 0,
      comparison: i === 0,
    };
  }

  next(): RunConfig {
    this.run += 1;
    return this.config();
  }

  reset(): void {
    this.run = 0;
  }
}
