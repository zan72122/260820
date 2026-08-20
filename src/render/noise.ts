/** Tileable value noise / fBm used by the procedural texture bakery. */

const LATTICE = 256;

/**
 * Coordinates are passed already multiplied by their frequency, and the wrap
 * period is given per axis, so a texture can tile at different frequencies
 * horizontally and vertically — which is what the anisotropic surfaces
 * (brushed steel, felt nap, wood grain) need. Octaves stop before the period
 * would exceed the lattice, because an octave that cannot wrap shows up as a
 * seam.
 */
export class Noise2D {
  private grid: Float32Array;

  constructor(seed = 1, private size = LATTICE) {
    this.grid = new Float32Array(this.size * this.size);
    let s = seed >>> 0 || 1;
    for (let i = 0; i < this.grid.length; i++) {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      this.grid[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
  }

  private wrap(p: number): number {
    const r = Math.round(p);
    if (!Number.isFinite(r) || r < 2) return 2;
    return r > this.size ? this.size : r;
  }

  value(x: number, y: number, px = this.size, py = px): number {
    const wx = this.wrap(px);
    const wy = this.wrap(py);
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const x0 = ((xi % wx) + wx) % wx;
    const y0 = ((yi % wy) + wy) % wy;
    const x1 = (x0 + 1) % wx;
    const y1 = (y0 + 1) % wy;
    const g = this.grid;
    const s = this.size;
    const a = g[y0 * s + x0];
    const b = g[y0 * s + x1];
    const c = g[y1 * s + x0];
    const d = g[y1 * s + x1];
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }

  fbm(x: number, y: number, octaves = 4, px = LATTICE, py = px, gain = 0.5): number {
    let amp = 1;
    let sum = 0;
    let norm = 0;
    let f = 1;
    for (let o = 0; o < octaves; o++) {
      if (o > 0 && (px * f > this.size || py * f > this.size)) break;
      sum += amp * this.value(x * f, y * f, px * f, py * f);
      norm += amp;
      amp *= gain;
      f *= 2;
    }
    return norm > 0 ? sum / norm : 0.5;
  }

  /** Ridged / cellular-ish variant for grain and crumb detail. */
  ridged(x: number, y: number, octaves = 3, px = LATTICE, py = px): number {
    let amp = 1;
    let sum = 0;
    let norm = 0;
    let f = 1;
    for (let o = 0; o < octaves; o++) {
      if (o > 0 && (px * f > this.size || py * f > this.size)) break;
      const n = this.value(x * f, y * f, px * f, py * f);
      sum += amp * (1 - Math.abs(n * 2 - 1));
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return norm > 0 ? sum / norm : 0.5;
  }
}
