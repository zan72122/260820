import { Signal } from './Signals';

export interface QualityLevel {
  index: number;
  maxDpr: number;
  shadowMapSize: number;
  shadows: boolean;
  particles: boolean;
  label: string;
}

const LEVELS: QualityLevel[] = [
  { index: 0, maxDpr: 2.0, shadowMapSize: 1024, shadows: true, particles: true, label: 'high' },
  { index: 1, maxDpr: 1.5, shadowMapSize: 768, shadows: true, particles: true, label: 'mid' },
  { index: 2, maxDpr: 1.0, shadowMapSize: 512, shadows: false, particles: false, label: 'low' },
];

/**
 * Drops resolution, then shadows, then the flow markers. What it never drops:
 * the cuff deformation, the valve, the needle, or a single scheduled sound —
 * the causal chain has to survive on the slowest device we support.
 */
export class AdaptiveQuality {
  readonly onChange = new Signal<QualityLevel>();
  private levelIndex = 0;
  private samples: number[] = [];
  private cooldown = 2;

  constructor(startIndex = 0) {
    this.levelIndex = startIndex;
  }

  get level(): QualityLevel {
    return LEVELS[this.levelIndex];
  }

  sample(dt: number): void {
    if (dt <= 0 || dt > 0.5) return;
    this.samples.push(dt);
    if (this.samples.length > 90) this.samples.shift();
    this.cooldown -= dt;
    if (this.cooldown > 0 || this.samples.length < 60) return;

    const sorted = this.samples.slice().sort((a, b) => a - b);
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    const median = sorted[Math.floor(sorted.length * 0.5)];

    if (p90 > 1 / 34 && this.levelIndex < LEVELS.length - 1) {
      this.levelIndex += 1;
      this.commit();
    } else if (median < 1 / 58 && p90 < 1 / 48 && this.levelIndex > 0) {
      this.levelIndex -= 1;
      this.commit();
    }
  }

  private commit(): void {
    this.samples.length = 0;
    this.cooldown = 4;
    this.onChange.emit(this.level);
  }
}
