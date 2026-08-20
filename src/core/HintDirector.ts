import { clamp01 } from './mathx';

export type HintLevel = 0 | 1 | 2;

export interface HintState {
  /** 0 = observe quietly, 1 = one object breathes, 2 = short partial motion. */
  level: HintLevel;
  /** 0..1 amplitude multiplier; drops once the child has done this before. */
  strength: number;
  /** Which single object may hint. Never more than one per scene. */
  target: string | null;
  /** Rises 0->1 while a level-2 preliminary motion plays, then resets. */
  cue: number;
}

export interface HintOptions {
  /** Pure observation window before anything moves. */
  observeMs?: number;
  /** Extra idle time before the short preliminary motion. */
  nudgeMs?: number;
  /** Duration of one preliminary motion. */
  cueMs?: number;
  /** Idle gap between repeats of the preliminary motion. */
  repeatMs?: number;
}

/**
 * Wordless hinting. No modal, no arrow, no narrator: the scene's single
 * relevant object drifts in the breeze, and only if the child is still lost
 * does it play one short motion that stops before revealing the full gesture.
 */
export class HintDirector {
  private readonly observeMs: number;
  private readonly nudgeMs: number;
  private readonly cueMs: number;
  private readonly repeatMs: number;

  private idleMs = 0;
  private cueMsLeft = 0;
  private sinceCueMs = 0;
  private target: string | null = null;
  private mastery = 0;
  private cuePhase = 0;

  constructor(opts: HintOptions = {}) {
    this.observeMs = opts.observeMs ?? 3000;
    this.nudgeMs = opts.nudgeMs ?? 5000;
    this.cueMs = opts.cueMs ?? 900;
    this.repeatMs = opts.repeatMs ?? 6000;
  }

  /** Called whenever the hinted object changes (new step, new stage). */
  focus(target: string | null, mastery = 0): void {
    if (target === this.target && mastery === this.mastery) return;
    this.target = target;
    this.mastery = mastery;
    this.idleMs = 0;
    this.cueMsLeft = 0;
    this.sinceCueMs = 0;
    this.cuePhase = 0;
  }

  /** Any deliberate pointer contact resets the whole ladder back to silence. */
  notifyInteraction(): void {
    this.idleMs = 0;
    this.cueMsLeft = 0;
    this.sinceCueMs = 0;
    this.cuePhase = 0;
  }

  update(dtMs: number): HintState {
    if (this.target === null) {
      return { level: 0, strength: 0, target: null, cue: 0 };
    }
    this.idleMs += dtMs;
    this.sinceCueMs += dtMs;

    // Repeated successes make the same hint quieter, then silent.
    const strength = this.mastery <= 0 ? 1 : this.mastery === 1 ? 0.4 : 0;
    if (strength <= 0) {
      return { level: 0, strength: 0, target: this.target, cue: 0 };
    }

    let level: HintLevel = 0;
    if (this.idleMs >= this.observeMs) level = 1;

    if (
      level === 1 &&
      this.idleMs >= this.observeMs + this.nudgeMs &&
      this.cueMsLeft <= 0 &&
      this.sinceCueMs >= this.repeatMs
    ) {
      this.cueMsLeft = this.cueMs;
      this.sinceCueMs = 0;
    }

    if (this.cueMsLeft > 0) {
      this.cueMsLeft = Math.max(0, this.cueMsLeft - dtMs);
      level = 2;
      this.cuePhase = 1 - this.cueMsLeft / this.cueMs;
    } else {
      this.cuePhase = 0;
    }

    return {
      level,
      strength,
      target: this.target,
      // Half-sine: the motion starts and settles back, never completing the gesture.
      cue: level === 2 ? Math.sin(clamp01(this.cuePhase) * Math.PI) : 0,
    };
  }

  get currentTarget(): string | null {
    return this.target;
  }
}
