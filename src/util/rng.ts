/**
 * Deterministic pseudo-random helpers. Every procedural texture and every
 * scatter of wear/dust is generated from a fixed seed so the pavilion looks
 * identical on every launch and on every device.
 */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

/** Integer hash -> [0,1). */
function hash2(x: number, y: number, seed: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Tileable value noise over a `period` x `period` integer lattice. */
export function valueNoise(x: number, y: number, period: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const x0 = ((xi % period) + period) % period;
  const y0 = ((yi % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const u = fade(xf);
  const v = fade(yf);
  const a = hash2(x0, y0, seed);
  const b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed);
  const d = hash2(x1, y1, seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

/** Tileable fractal noise in [0,1]. `period` is the lattice size at octave 0. */
export function fbm(x: number, y: number, period: number, octaves: number, seed: number, gain = 0.5) {
  let amp = 1;
  let sum = 0;
  let norm = 0;
  let p = period;
  let fx = x;
  let fy = y;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(fx, fy, p, seed + i * 131);
    norm += amp;
    amp *= gain;
    p *= 2;
    fx *= 2;
    fy *= 2;
  }
  return sum / norm;
}

/** Ridged noise — good for scratches, fibres and grain edges. */
export function ridged(x: number, y: number, period: number, octaves: number, seed: number) {
  let amp = 1;
  let sum = 0;
  let norm = 0;
  let p = period;
  let fx = x;
  let fy = y;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise(fx, fy, p, seed + i * 977) * 2 - 1);
    sum += amp * n * n;
    norm += amp;
    amp *= 0.55;
    p *= 2;
    fx *= 2;
    fy *= 2;
  }
  return sum / norm;
}

export interface CellResult {
  /** Distance to the nearest feature point, normalised by cell size. */
  f1: number;
  /** Distance to the second nearest feature point. */
  f2: number;
  /** Stable per-cell random value of the nearest point — a grain "id". */
  id: number;
}

const cellTmp: CellResult = { f1: 0, f2: 0, id: 0 };

/** Tileable cellular (Worley) noise. Returns a shared object — copy what you need. */
export function cellular(x: number, y: number, period: number, seed: number): CellResult {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let f1 = 8;
  let f2 = 8;
  let id = 0;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = xi + ox;
      const cy = yi + oy;
      const wx = ((cx % period) + period) % period;
      const wy = ((cy % period) + period) % period;
      const px = cx + hash2(wx, wy, seed);
      const py = cy + hash2(wx, wy, seed + 7919);
      const dx = px - x;
      const dy = py - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = hash2(wx, wy, seed + 104729);
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  cellTmp.f1 = f1;
  cellTmp.f2 = f2;
  cellTmp.id = id;
  return cellTmp;
}
