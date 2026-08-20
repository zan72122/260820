import { clamp01, damp, lerp } from './mathx';

export interface DropletEvent {
  /** Which fruit the droplet formed on. */
  fruit: number;
  /** 0..1 how large / how ready to fall. */
  size: number;
  /** True once enough juice exists that the drop runs down instead of beading. */
  runs: boolean;
}

export interface BrineConfig {
  /** Days of compressed time the jar is simulated over. */
  maxDays?: number;
  /** Normalised salt needed before osmosis is clearly readable. */
  saltForFullDrive?: number;
  /** Juice extracted per day at full drive. */
  extractionPerDay?: number;
  fruitCount?: number;
}

/**
 * The causal core of stage 2, kept completely free of rendering.
 *
 * salt lands -> salt dissolves -> skin wets -> droplets bead and run ->
 * juice collects at the bottom -> the level creeps up between the fruit.
 *
 * Nothing here can produce liquid without time passing: `advanceDays` is the
 * only input that grows `juice`, so the child always sees days go by (sun and
 * moon crossing the window) before the jar fills.
 */
export class BrineModel {
  readonly maxDays: number;
  readonly fruitCount: number;
  private readonly saltForFullDrive: number;
  private readonly extractionPerDay: number;

  /** Total salt poured onto the fruit, normalised (1 = a generous layer). */
  saltPoured = 0;
  /** Fraction of the poured salt that has melted into the juice. */
  dissolved = 0;
  /** Compressed days elapsed. */
  day = 0;
  /** Fraction of the extractable juice already drawn out, 0..1. */
  extraction = 0;
  /** Visible skin wetness, 0..1, smoothed for rendering. */
  wetness = 0;
  /** Smoothed liquid surface height 0..1 in jar-interior units. */
  level = 0;
  /** True once the very first grain has touched a fruit. */
  firstContact = false;

  private targetLevel = 0;
  private pending: DropletEvent[] = [];
  private dropAccumulator = 0;
  private perFruitSalt: Float32Array;

  constructor(cfg: BrineConfig = {}) {
    this.maxDays = cfg.maxDays ?? 6;
    this.saltForFullDrive = cfg.saltForFullDrive ?? 1;
    this.extractionPerDay = cfg.extractionPerDay ?? 0.26;
    this.fruitCount = cfg.fruitCount ?? 9;
    this.perFruitSalt = new Float32Array(this.fruitCount);
  }

  /** Salt coverage on one fruit, 0..1. Drives where the skin looks wettest. */
  saltOn(fruit: number): number {
    return this.perFruitSalt[fruit] ?? 0;
  }

  get saltUndissolved(): number {
    return this.saltPoured * (1 - this.dissolved);
  }

  /** 0..1 drive term: how hard the salt is currently pulling water out. */
  get drive(): number {
    return clamp01(this.saltPoured / this.saltForFullDrive) * (1 - this.extraction);
  }

  /** Height of the remaining salt pile relative to the poured maximum. */
  get pileHeight(): number {
    return clamp01(this.saltUndissolved);
  }

  get dayNorm(): number {
    return clamp01(this.day / this.maxDays);
  }

  /**
   * Register salt landing on a fruit. Returns the first-contact droplet if
   * this is the very first grain, so the scene can bead exactly one drop.
   */
  addSalt(amount: number, fruit: number): DropletEvent | null {
    if (amount <= 0) return null;
    this.saltPoured = clamp01(this.saltPoured + amount);
    const idx = Math.max(0, Math.min(this.fruitCount - 1, Math.floor(fruit)));
    this.perFruitSalt[idx] = clamp01(this.perFruitSalt[idx] + amount * 2.2);
    if (!this.firstContact) {
      this.firstContact = true;
      const ev: DropletEvent = { fruit: idx, size: 0.55, runs: false };
      this.pending.push(ev);
      return ev;
    }
    return null;
  }

  /**
   * Advances compressed time. This is the ONLY way juice appears.
   * Returns how much juice was produced by this call.
   */
  advanceDays(deltaDays: number): number {
    if (deltaDays <= 0) return 0;
    const before = this.extraction;
    let remaining = deltaDays;
    // Sub-step so a big swipe still integrates the falling drive correctly.
    while (remaining > 1e-4) {
      const dt = Math.min(0.1, remaining);
      remaining -= dt;
      this.day = Math.min(this.maxDays, this.day + dt);
      const d = this.drive;
      this.extraction = clamp01(this.extraction + d * this.extractionPerDay * dt);
      this.dissolved = clamp01(this.dissolved + d * 0.34 * dt + 0.02 * dt);
      this.dropAccumulator += d * dt * 5.5;
      while (this.dropAccumulator >= 1) {
        this.dropAccumulator -= 1;
        this.pending.push({
          fruit: this.wettestFruit(),
          size: 0.35 + 0.5 * d,
          runs: this.extraction > 0.12,
        });
      }
    }
    this.targetLevel = this.levelFor(this.extraction);
    return this.extraction - before;
  }

  /** Smooths wetness and the liquid surface toward their targets each frame. */
  tick(dtSec: number): void {
    const wetTarget = clamp01(this.extraction * 2.4 + (this.firstContact ? 0.14 : 0));
    this.wetness = damp(this.wetness, wetTarget, 1.8, dtSec);
    this.level = damp(this.level, this.targetLevel, 1.1, dtSec);
  }

  /**
   * Juice volume to visible surface height. The fruit displace liquid, so the
   * level climbs briskly through the packed lower half then eases as it clears
   * the top of the pile: "じわじわ" rather than a switch flipping.
   */
  levelFor(extraction: number): number {
    const e = clamp01(extraction);
    return clamp01(lerp(0, 0.62, Math.pow(e, 0.72)) + lerp(0, 0.26, Math.pow(e, 2.1)));
  }

  private wettestFruit(): number {
    let best = 0;
    let bestV = -1;
    for (let i = 0; i < this.fruitCount; i++) {
      const v = this.perFruitSalt[i];
      if (v > bestV) {
        bestV = v;
        best = i;
      }
    }
    return best;
  }

  consumeDroplets(): DropletEvent[] {
    if (this.pending.length === 0) return [];
    const out = this.pending;
    this.pending = [];
    return out;
  }

  reset(): void {
    this.saltPoured = 0;
    this.dissolved = 0;
    this.day = 0;
    this.extraction = 0;
    this.wetness = 0;
    this.level = 0;
    this.targetLevel = 0;
    this.firstContact = false;
    this.dropAccumulator = 0;
    this.pending.length = 0;
    this.perFruitSalt = new Float32Array(this.fruitCount);
  }
}
