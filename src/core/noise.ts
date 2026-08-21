/** Small deterministic value-noise / fbm helpers used to bake PBR maps at runtime. */

export function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/** Tileable value noise lattice. */
export class ValueNoise {
  private readonly grid: Float32Array;
  constructor(public readonly size: number, seed: number) {
    const rng = makeRng(seed);
    this.grid = new Float32Array(size * size);
    for (let i = 0; i < this.grid.length; i++) this.grid[i] = rng();
  }

  private at(x: number, y: number): number {
    const s = this.size;
    return this.grid[(((y % s) + s) % s) * s + (((x % s) + s) % s)];
  }

  /** u,v in [0,1) — wraps seamlessly. */
  sample(u: number, v: number): number {
    const x = u * this.size;
    const y = v * this.size;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = this.at(xi, yi);
    const b = this.at(xi + 1, yi);
    const c = this.at(xi, yi + 1);
    const d = this.at(xi + 1, yi + 1);
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  }
}

export interface FbmOptions {
  octaves?: number;
  lacunarity?: number;
  gain?: number;
  baseFreq?: number;
  seed?: number;
  /** Squash the noise along v (streaks) — >1 stretches vertically. */
  stretchV?: number;
  stretchU?: number;
}

export function fbmField(size: number, opts: FbmOptions = {}): Float32Array {
  const {
    octaves = 4,
    lacunarity = 2,
    gain = 0.5,
    baseFreq = 4,
    seed = 1337,
    stretchU = 1,
    stretchV = 1,
  } = opts;
  const layers: ValueNoise[] = [];
  for (let o = 0; o < octaves; o++) layers.push(new ValueNoise(Math.max(2, Math.round(baseFreq * Math.pow(lacunarity, o))), seed + o * 7919));
  const out = new Float32Array(size * size);
  let min = Infinity;
  let max = -Infinity;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) / stretchU;
      const v = (y / size) / stretchV;
      let amp = 1;
      let sum = 0;
      let norm = 0;
      for (let o = 0; o < octaves; o++) {
        sum += layers[o].sample(u, v) * amp;
        norm += amp;
        amp *= gain;
      }
      const val = sum / norm;
      out[y * size + x] = val;
      if (val < min) min = val;
      if (val > max) max = val;
    }
  }
  const inv = 1 / Math.max(1e-5, max - min);
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - min) * inv;
  return out;
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
