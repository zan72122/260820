import * as THREE from 'three';

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp(invLerp(e0, e1, x), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Frame-rate independent exponential approach. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

export function dampVec3(cur: THREE.Vector3, target: THREE.Vector3, lambda: number, dt: number) {
  const t = 1 - Math.exp(-lambda * dt);
  cur.lerp(target, t);
  return cur;
}

/** Deterministic 32bit RNG (mulberry32) so a seed reproduces a flower exactly. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number) {
    return a + (b - a) * this.next();
  }
  /** Signed noise in [-1,1]. */
  sym(scale = 1) {
    return (this.next() * 2 - 1) * scale;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length) % arr.length];
  }
}

/** Cheap deterministic 1D value noise, used for organic edges. */
export function valueNoise1(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n: number) => {
    let t = (n * 374761393 + seed * 668265263) >>> 0;
    t = (t ^ (t >>> 13)) >>> 0;
    t = Math.imul(t, 1274126177) >>> 0;
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
  };
  const a = h(i);
  const b = h(i + 1);
  const u = f * f * (3 - 2 * f);
  return (a + (b - a) * u) * 2 - 1;
}

export function fbm1(x: number, seed = 0, octaves = 3): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise1(x * freq, seed + o * 17) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return sum / norm;
}

/** Shortest signed angular difference. */
export function angleDelta(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
