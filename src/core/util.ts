export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
export const smootherstep = (t: number) => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;

/** Frame-rate independent exponential damping. `rate` ~ how fast (1/s). */
export const damp = (current: number, target: number, rate: number, dt: number) =>
  target + (current - target) * Math.exp(-rate * dt);

/** Deterministic 32-bit RNG (mulberry32) so every play session is reproducible per seed. */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;
export const rrange = (rng: Rng, a: number, b: number) => a + (b - a) * rng();
export const rpick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];

/* ---- value noise / fbm (CPU side, used for textures and terrain) ---- */
const hash2 = (x: number, y: number, seed = 0) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export function noise2(x: number, y: number, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

export function fbm(x: number, y: number, octaves = 4, seed = 0, lacunarity = 2, gain = 0.5) {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * freq, y * freq, seed + i * 17);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** Ridged/turbulent variant — good for cracked, crumbly soil. */
export function turbulence(x: number, y: number, octaves = 4, seed = 0) {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * Math.abs(noise2(x * freq, y * freq, seed + i * 31) * 2 - 1);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}
