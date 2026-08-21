import type * as THREE from 'three';

export type Tier = 0 | 1 | 2 | 3; // 0 = full, 3 = most reduced

/**
 * Adaptive quality. Degradation order is fixed by design:
 *   distant density -> particle count -> shadow resolution -> render scale.
 * The pod reveal, the soil shedding and the inversion animation are never
 * touched, whatever the tier.
 */
export class Quality {
  tier: Tier = 0;
  renderScale = 1;
  private samples: number[] = [];
  private lastChange = 0;
  private listeners: ((t: Tier) => void)[] = [];
  readonly fast: boolean;

  constructor(private renderer: THREE.WebGLRenderer, fast: boolean) {
    this.fast = fast;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderScale = fast ? 1 : dpr > 2.5 ? 0.75 : 1;
    if (fast) this.tier = 2;
  }

  onChange(fn: (t: Tier) => void) {
    this.listeners.push(fn);
    fn(this.tier);
  }

  get maxPixelRatio(): number {
    if (this.fast) return 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cap = this.tier >= 3 ? 1 : this.tier === 2 ? 1.25 : this.tier === 1 ? 1.5 : 2;
    return Math.min(dpr, cap) * this.renderScale;
  }

  get shadowSize(): number {
    return this.fast ? 512 : [1024, 1024, 768, 512][this.tier];
  }

  get particleBudget(): number {
    return this.fast ? 40 : [200, 150, 96, 56][this.tier];
  }

  get farDensity(): number {
    return this.fast ? 0.25 : [1, 0.7, 0.45, 0.28][this.tier];
  }

  private windowStart = 0;

  sample(dt: number, now: number) {
    if (this.fast) return;
    if (!this.windowStart) this.windowStart = now;
    this.samples.push(dt);
    // time based, not frame based: on a slow device 45 frames can take half a
    // minute, which is exactly when the adaptation is needed most
    if (this.samples.length < 12 || now - this.windowStart < 1000) return;
    this.windowStart = now;
    const sorted = this.samples.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    this.samples.length = 0;
    if (now - this.lastChange < 2500) return;
    // 30 fps floor: shed quality above 34ms, recover well under 20ms.
    if (median > 0.034 && this.tier < 3) this.set((this.tier + 1) as Tier, now);
    else if (median < 0.018 && this.tier > 0) this.set((this.tier - 1) as Tier, now);
  }

  private set(t: Tier, now: number) {
    this.tier = t;
    this.lastChange = now;
    this.renderer.setPixelRatio(this.maxPixelRatio);
    for (const l of this.listeners) l(t);
  }
}
