import { clamp01 } from './mathutil';

export interface BeatEvent {
  /** Index of the cardiac cycle, monotonically increasing from 0. */
  index: number;
  /** AudioContext time (seconds) of S1 for this cycle. */
  s1Time: number;
  /** AudioContext time (seconds) of S2 for this cycle. */
  s2Time: number;
  /** Cycle length in seconds. */
  period: number;
}

/**
 * The single heartbeat timeline of the whole piece.
 *
 * Every sound, every animation (heart, chest micro-motion, chestpiece tremor,
 * record-tile playback, instructor's table tap) reads its phase from here, so
 * moving the chestpiece never restarts or re-phases the heart. There is one
 * heart; there is one clock.
 *
 * The clock is driven by AudioContext time when audio is alive, and falls back
 * to performance.now() so that the game is fully playable with sound off.
 */
export class CardiacClock {
  /** Beats per minute of the training manikin's normal sinus rhythm. */
  private bpm = 72;
  private originAudioTime = 0;
  private lastScheduledIndex = -1;
  private nowFn: () => number;

  constructor(nowFn?: () => number) {
    this.nowFn = nowFn ?? (() => performance.now() / 1000);
    this.originAudioTime = this.nowFn();
  }

  /**
   * Re-base the clock onto a new time source (AudioContext.currentTime) without
   * losing the phase that has already elapsed.
   */
  rebase(nowFn: () => number): void {
    const phaseElapsed = this.elapsed();
    this.nowFn = nowFn;
    this.originAudioTime = nowFn() - phaseElapsed;
  }

  get period(): number {
    return 60 / this.bpm;
  }

  /** Systole length: S1 -> S2 gap. Scales mildly with rate, as in life. */
  get systole(): number {
    return Math.min(0.36, 0.28 + (this.period - 0.7) * 0.14);
  }

  now(): number {
    return this.nowFn();
  }

  elapsed(): number {
    return this.nowFn() - this.originAudioTime;
  }

  /** Cycle index at the current instant. */
  beatIndex(): number {
    return Math.floor(this.elapsed() / this.period);
  }

  /** 0..1 position inside the current cycle. */
  phase(): number {
    const e = this.elapsed() / this.period;
    return e - Math.floor(e);
  }

  /** Envelope 0..1 that peaks right after S1 — used for ventricular contraction. */
  contractionEnvelope(): number {
    const p = this.phase();
    const sysFrac = this.systole / this.period;
    if (p < sysFrac) {
      const t = p / sysFrac;
      return Math.sin(Math.PI * clamp01(t)) ** 0.8;
    }
    const t = (p - sysFrac) / (1 - sysFrac);
    return 0.12 * Math.exp(-3.2 * t);
  }

  /** Short impulse envelopes for the two sounds, for visual sync of the taps. */
  soundEnvelope(which: 1 | 2): number {
    const p = this.phase() * this.period;
    const at = which === 1 ? 0 : this.systole;
    const d = p - at;
    if (d < 0 || d > 0.5) return 0;
    return Math.exp(-d * 26);
  }

  /**
   * Yields the beats that begin inside [now, now + lookahead] and have not been
   * handed out yet. Used by the audio scheduler.
   */
  pullDueBeats(lookahead: number): BeatEvent[] {
    const horizon = this.elapsed() + lookahead;
    const out: BeatEvent[] = [];
    let next = this.lastScheduledIndex + 1;
    while (next * this.period <= horizon) {
      const s1Elapsed = next * this.period;
      out.push({
        index: next,
        s1Time: this.originAudioTime + s1Elapsed,
        s2Time: this.originAudioTime + s1Elapsed + this.systole,
        period: this.period,
      });
      this.lastScheduledIndex = next;
      next++;
      if (out.length > 8) break;
    }
    return out;
  }

  /** Absolute time of S1 or S2 for a given cycle index. */
  timeOfSound(index: number, which: 1 | 2): number {
    return this.originAudioTime + index * this.period + (which === 2 ? this.systole : 0);
  }

  /** Drop any scheduling backlog (e.g. after the tab was backgrounded). */
  resync(): void {
    this.lastScheduledIndex = Math.floor(this.elapsed() / this.period) - 1;
  }
}
