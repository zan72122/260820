/** Small deterministic noise toolkit used to bake all textures procedurally. */

export function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    // xorshift32
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

const PERM_SIZE = 256;

export class ValueNoise {
  private readonly grad: Float32Array;

  constructor(seed: number) {
    const rng = makeRng(seed);
    this.grad = new Float32Array(PERM_SIZE * PERM_SIZE);
    for (let i = 0; i < this.grad.length; i++) this.grad[i] = rng();
  }

  private at(x: number, y: number): number {
    const ix = ((x % PERM_SIZE) + PERM_SIZE) % PERM_SIZE;
    const iy = ((y % PERM_SIZE) + PERM_SIZE) % PERM_SIZE;
    return this.grad[iy * PERM_SIZE + ix];
  }

  /** Tileable value noise with a period of `period` cells. */
  noise(x: number, y: number, period: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const wx0 = ((x0 % period) + period) % period;
    const wy0 = ((y0 % period) + period) % period;
    const wx1 = (wx0 + 1) % period;
    const wy1 = (wy0 + 1) % period;
    const a = this.at(wx0, wy0);
    const b = this.at(wx1, wy0);
    const c = this.at(wx0, wy1);
    const d = this.at(wx1, wy1);
    return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
  }

  /** Tileable fBm in [0,1]. `base` = cells across the tile at octave 0. */
  fbm(u: number, v: number, base: number, octaves: number, gain = 0.5, lacunarity = 2): number {
    let amp = 1;
    let sum = 0;
    let norm = 0;
    let freq = base;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.noise(u * freq, v * freq, Math.max(1, Math.round(freq)));
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  /** Ridged / billowy variant, good for clods and bark. */
  billow(u: number, v: number, base: number, octaves: number): number {
    let amp = 1;
    let sum = 0;
    let norm = 0;
    let freq = base;
    for (let o = 0; o < octaves; o++) {
      const n = Math.abs(this.noise(u * freq, v * freq, Math.max(1, Math.round(freq))) * 2 - 1);
      sum += amp * n;
      norm += amp;
      amp *= 0.52;
      freq *= 2;
    }
    return sum / norm;
  }
}

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Build a height field -> tangent-space normal map RGB buffer. */
export function heightToNormalRGBA(
  height: Float32Array,
  size: number,
  strength: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4);
  const idx = (x: number, y: number) => ((y + size) % size) * size + ((x + size) % size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx =
        height[idx(x + 1, y - 1)] +
        2 * height[idx(x + 1, y)] +
        height[idx(x + 1, y + 1)] -
        (height[idx(x - 1, y - 1)] + 2 * height[idx(x - 1, y)] + height[idx(x - 1, y + 1)]);
      const dy =
        height[idx(x - 1, y + 1)] +
        2 * height[idx(x, y + 1)] +
        height[idx(x + 1, y + 1)] -
        (height[idx(x - 1, y - 1)] + 2 * height[idx(x, y - 1)] + height[idx(x + 1, y - 1)]);
      let nx = -dx * strength;
      let ny = -dy * strength;
      const nz = 1;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= inv;
      ny *= inv;
      const o = (y * size + x) * 4;
      out[o] = (nx * 0.5 + 0.5) * 255;
      out[o + 1] = (ny * 0.5 + 0.5) * 255;
      out[o + 2] = (nz * inv * 0.5 + 0.5) * 255;
      out[o + 3] = 255;
    }
  }
  return out;
}
