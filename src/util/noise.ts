/**
 * CPU value/gradient noise used to bake the procedural material textures.
 * Kept dependency free and deterministic: every texture is reproducible from a seed.
 */

import { makeRng } from './math';

const PERM_SIZE = 512;

function buildPermutation(seed: number): Uint8Array {
  const rng = makeRng(seed);
  const p = new Uint8Array(PERM_SIZE);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = base[i];
    base[i] = base[j];
    base[j] = t;
  }
  for (let i = 0; i < PERM_SIZE; i++) p[i] = base[i & 255];
  return p;
}

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
const lerpN = (a: number, b: number, t: number): number => a + (b - a) * t;

function grad2(hash: number, x: number, y: number): number {
  switch (hash & 7) {
    case 0:
      return x + y;
    case 1:
      return x - y;
    case 2:
      return -x + y;
    case 3:
      return -x - y;
    case 4:
      return x;
    case 5:
      return -x;
    case 6:
      return y;
    default:
      return -y;
  }
}

export class Noise2D {
  private readonly p: Uint8Array;

  constructor(seed = 1337) {
    this.p = buildPermutation(seed);
  }

  /** Perlin-style gradient noise in roughly [-1, 1]. */
  noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const p = this.p;
    const aa = p[p[X] + Y];
    const ab = p[p[X] + Y + 1];
    const ba = p[p[X + 1] + Y];
    const bb = p[p[X + 1] + Y + 1];
    const x1 = lerpN(grad2(aa, xf, yf), grad2(ba, xf - 1, yf), u);
    const x2 = lerpN(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u);
    return lerpN(x1, x2, v);
  }

  /** Tileable variant: wraps cleanly on a `period` grid. */
  tileable(x: number, y: number, period: number): number {
    const xa = x % period;
    const ya = y % period;
    const xb = xa - period;
    const yb = ya - period;
    const wx = xa / period;
    const wy = ya / period;
    const n =
      this.noise(xa, ya) * (1 - wx) * (1 - wy) +
      this.noise(xb, ya) * wx * (1 - wy) +
      this.noise(xa, yb) * (1 - wx) * wy +
      this.noise(xb, yb) * wx * wy;
    return n;
  }

  fbm(x: number, y: number, octaves = 4, lacunarity = 2.03, gain = 0.5): number {
    let amp = 0.5;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / (norm || 1);
  }

  fbmTileable(x: number, y: number, period: number, octaves = 4): number {
    let amp = 0.5;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.tileable(x * freq, y * freq, period * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / (norm || 1);
  }
}

/** Cheap 1D hash noise, handy for jitter that must stay deterministic. */
export function hash1(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}
