import { DataTexture, LinearFilter, RGBAFormat, ClampToEdgeWrapping } from 'three';
import { SLIDE_LENGTH } from './slideCurve';
import { clamp, smoothstep } from '../core/math';

export type SurfaceKind = 'dry' | 'wet' | 'sand' | 'rubber';

export const SURFACE_CELLS = 96;

/**
 * The state of the slide bed along its length. Three loose coverages per cell
 * (water film, sprinkled sand, laid rubber strip); whatever is left over is
 * bare dry steel. The same array feeds the shader and the friction model, so
 * a puddle you can see is a puddle the object actually feels.
 */
export class SlideSurface {
  readonly wet = new Float32Array(SURFACE_CELLS);
  readonly sand = new Float32Array(SURFACE_CELLS);
  readonly rubber = new Float32Array(SURFACE_CELLS);
  readonly texture: DataTexture;
  private data = new Uint8Array(SURFACE_CELLS * 4);
  private dirty = true;
  /** Bumped whenever coverage changes, so the sim can invalidate caches. */
  revision = 0;

  constructor() {
    this.texture = new DataTexture(this.data, SURFACE_CELLS, 1, RGBAFormat);
    this.texture.minFilter = LinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.wrapS = this.texture.wrapT = ClampToEdgeWrapping;
    this.texture.needsUpdate = true;
    this.resetToMorning();
  }

  /** Cell index for an arc position. */
  static cell(s: number): number {
    return clamp(Math.floor((s / SLIDE_LENGTH) * SURFACE_CELLS), 0, SURFACE_CELLS - 1);
  }

  static cellArc(i: number): number {
    return ((i + 0.5) / SURFACE_CELLS) * SLIDE_LENGTH;
  }

  /**
   * The state the park is found in: the sun has already dried the steep upper
   * half, and a thin film of last night's rain is still sitting in the flatter
   * middle where the bed stops draining.
   */
  resetToMorning(): void {
    for (let i = 0; i < SURFACE_CELLS; i++) {
      const s = SlideSurface.cellArc(i);
      const film =
        smoothstep(2.18, 2.46, s) * (1 - smoothstep(3.3, 3.52, s)) * 0.92 +
        smoothstep(3.9, 4.1, s) * (1 - smoothstep(4.35, 4.55, s)) * 0.3;
      this.wet[i] = clamp(film, 0, 1);
      this.sand[i] = 0;
      this.rubber[i] = 0;
    }
    this.dirty = true;
    this.revision++;
  }

  private paint(target: Float32Array, s: number, radius: number, amount: number): void {
    const c0 = SlideSurface.cell(s - radius);
    const c1 = SlideSurface.cell(s + radius);
    for (let i = c0; i <= c1; i++) {
      const d = Math.abs(SlideSurface.cellArc(i) - s) / radius;
      const w = Math.max(0, 1 - d * d);
      target[i] = clamp(target[i] + amount * w, 0, 1);
    }
    this.dirty = true;
    this.revision++;
  }

  addWater(s: number, radius = 0.28, amount = 0.7): void {
    this.paint(this.wet, s, radius, amount);
    // Water washes loose sand away.
    this.paint(this.sand, s, radius, -amount * 0.8);
  }

  addSand(s: number, radius = 0.3, amount = 0.55): void {
    this.paint(this.sand, s, radius, amount);
  }

  /** Wiping with the cloth takes off both water and grit. */
  wipe(s: number, radius = 0.34, amount = 0.85): void {
    this.paint(this.wet, s, radius, -amount);
    this.paint(this.sand, s, radius, -amount);
  }

  setRubberStrip(centre: number, halfLength: number, on: boolean): void {
    for (let i = 0; i < SURFACE_CELLS; i++) {
      const s = SlideSurface.cellArc(i);
      const inside = Math.abs(s - centre) <= halfLength;
      if (inside) this.rubber[i] = on ? 1 : 0;
    }
    this.dirty = true;
    this.revision++;
  }

  clearRubber(): void {
    this.rubber.fill(0);
    this.dirty = true;
    this.revision++;
  }

  /** Normalised coverage at an arc position, for both shading and friction. */
  sample(s: number, out: { wet: number; sand: number; rubber: number; dry: number }): void {
    const t = clamp((s / SLIDE_LENGTH) * SURFACE_CELLS - 0.5, 0, SURFACE_CELLS - 1);
    const i = Math.min(SURFACE_CELLS - 2, Math.floor(t));
    const f = t - i;
    const w = this.wet[i] + (this.wet[i + 1] - this.wet[i]) * f;
    const a = this.sand[i] + (this.sand[i + 1] - this.sand[i]) * f;
    const r = this.rubber[i] + (this.rubber[i + 1] - this.rubber[i]) * f;
    // A rubber strip sits on top of everything else; sand covers water.
    const rr = r;
    const aa = a * (1 - rr);
    const ww = w * (1 - rr) * (1 - aa);
    out.rubber = rr;
    out.sand = aa;
    out.wet = ww;
    out.dry = clamp(1 - rr - aa - ww, 0, 1);
  }

  flush(): void {
    if (!this.dirty) return;
    for (let i = 0; i < SURFACE_CELLS; i++) {
      this.data[i * 4 + 0] = this.wet[i] * 255;
      this.data[i * 4 + 1] = this.sand[i] * 255;
      this.data[i * 4 + 2] = this.rubber[i] * 255;
      this.data[i * 4 + 3] = 255;
    }
    this.texture.needsUpdate = true;
    this.dirty = false;
  }

  /** True when at least two clearly different states exist on the bed. */
  distinctStates(): number {
    let wet = 0;
    let sand = 0;
    let rub = 0;
    let dry = 0;
    for (let i = 0; i < SURFACE_CELLS; i++) {
      if (this.rubber[i] > 0.5) rub++;
      else if (this.sand[i] > 0.35) sand++;
      else if (this.wet[i] > 0.35) wet++;
      else dry++;
    }
    return [wet, sand, rub, dry].filter((n) => n > 2).length;
  }
}
