import { clamp01, damp } from './mathx';

export type Side = 0 | 1;

export interface DryFruit {
  /** Sun-hours accumulated on each side. */
  exposure: [number, number];
  /** Which side currently faces the sky. */
  up: Side;
  /** Smoothed 0..1 dryness used for gloss, wrinkle and colour. */
  dryness: number;
  /** Set once the fruit has been laid on the tray. */
  placed: boolean;
}

/**
 * Stage 3 model: sunlight only dries the side that faces it, so rolling a
 * fruit over is a real, visible act rather than decoration.
 */
export class DryModel {
  readonly fruits: DryFruit[] = [];
  /** Sun-hours for one side to look fully sun-dried. */
  readonly hoursPerSide: number;

  constructor(count: number, hoursPerSide = 2.2) {
    this.hoursPerSide = hoursPerSide;
    for (let i = 0; i < count; i++) {
      this.fruits.push({ exposure: [0, 0], up: 0, dryness: 0, placed: false });
    }
  }

  place(index: number): void {
    const f = this.fruits[index];
    if (f) f.placed = true;
  }

  get placedCount(): number {
    return this.fruits.reduce((n, f) => n + (f.placed ? 1 : 0), 0);
  }

  /** Adds sun-hours to the upward face of every placed fruit. */
  addSun(hours: number): void {
    if (hours <= 0) return;
    for (const f of this.fruits) {
      if (!f.placed) continue;
      f.exposure[f.up] = Math.min(this.hoursPerSide * 1.6, f.exposure[f.up] + hours);
    }
  }

  roll(index: number): Side | null {
    const f = this.fruits[index];
    if (!f || !f.placed) return null;
    f.up = f.up === 0 ? 1 : 0;
    return f.up;
  }

  /** How dry one face looks, purely from the sun it has had. */
  sideDryness(index: number, side: Side): number {
    const f = this.fruits[index];
    if (!f) return 0;
    return clamp01(f.exposure[side] / this.hoursPerSide);
  }

  /**
   * Overall doneness. Both faces count, and the paler one counts for more, so
   * turning a fruit over is genuinely worth doing -- without being required
   * before the stage can finish.
   */
  targetDryness(f: DryFruit): number {
    const a = clamp01(f.exposure[0] / this.hoursPerSide);
    const b = clamp01(f.exposure[1] / this.hoursPerSide);
    return clamp01(Math.min(a, b) * 0.42 + ((a + b) / 2) * 0.58);
  }

  tick(dtSec: number): void {
    for (const f of this.fruits) {
      f.dryness = damp(f.dryness, this.targetDryness(f), 2.4, dtSec);
    }
  }

  /** Average finished-ness, used for the stage's progress. */
  get overallDryness(): number {
    const placed = this.fruits.filter((f) => f.placed);
    if (placed.length === 0) return 0;
    return placed.reduce((s, f) => s + this.targetDryness(f), 0) / placed.length;
  }

  /** True when at least one fruit still has a pale, unturned face. */
  get anyUnturned(): boolean {
    return this.fruits.some(
      (f) => f.placed && Math.min(f.exposure[0], f.exposure[1]) < this.hoursPerSide * 0.25,
    );
  }

  reset(): void {
    for (const f of this.fruits) {
      f.exposure[0] = 0;
      f.exposure[1] = 0;
      f.up = 0;
      f.dryness = 0;
      f.placed = false;
    }
  }
}
