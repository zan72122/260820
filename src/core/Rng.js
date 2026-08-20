/**
 * Deterministic 32-bit RNG (mulberry32). A fixed seed is required by the
 * E2E policy so that fish trajectories, tear placement and droplet scatter
 * replay identically between runs.
 */
export class Rng {
  constructor(seed = 0x9e3779b9) {
    this.seed = seed >>> 0;
    this._s = this.seed;
  }

  reset(seed = this.seed) {
    this.seed = seed >>> 0;
    this._s = this.seed;
    return this;
  }

  /** @returns {number} uniform in [0,1) */
  next() {
    this._s = (this._s + 0x6d2b79f5) >>> 0;
    let t = this._s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** @returns {number} uniform in [min,max) */
  range(min, max) {
    return min + (max - min) * this.next();
  }

  /** @returns {number} uniform in [-a,a) */
  sym(a) {
    return this.range(-a, a);
  }

  /** @returns {number} integer in [0,n) */
  int(n) {
    return Math.floor(this.next() * n) % n;
  }

  pick(arr) {
    return arr[this.int(arr.length)];
  }
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const TAU = Math.PI * 2;

/** Shortest signed angular difference b-a, wrapped to [-PI, PI]. */
export function angleDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
