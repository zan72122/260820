/** Small framerate-independent easing / spring helpers used all over the game. */

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const clamp01 = (v: number): number => clamp(v, 0, 1);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const invLerp = (a: number, b: number, v: number): number =>
  a === b ? 0 : clamp01((v - a) / (b - a));

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = invLerp(edge0, edge1, x);
  return t * t * (3 - 2 * t);
};

export const smootherstep = (edge0: number, edge1: number, x: number): number => {
  const t = invLerp(edge0, edge1, x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export const easeOutQuint = (t: number): number => 1 - Math.pow(1 - t, 5);

export const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;

export const easeOutBack = (t: number): number => {
  const c1 = 1.28;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/**
 * Exponential smoothing that behaves the same at 30fps and 120fps.
 * `smoothing` is the fraction of the remaining distance left after 1 second.
 */
export const damp = (
  current: number,
  target: number,
  smoothing: number,
  dt: number,
): number => lerp(target, current, Math.pow(smoothing, dt));

/** Critically damped spring. Returns the new value; velocity is passed by ref. */
export class Spring {
  value: number;
  velocity = 0;
  target: number;
  /** Angular frequency: higher = snappier. */
  omega: number;
  /** 1 = critically damped, <1 overshoots (nice for fabric). */
  zeta: number;

  constructor(value = 0, omega = 12, zeta = 1) {
    this.value = value;
    this.target = value;
    this.omega = omega;
    this.zeta = zeta;
  }

  set(v: number): void {
    this.value = v;
    this.target = v;
    this.velocity = 0;
  }

  step(dt: number): number {
    // Sub-step so that a long frame (tab restore) cannot explode the spring.
    const steps = Math.min(4, Math.max(1, Math.ceil(dt / 0.02)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const f = this.value - this.target;
      const a = -this.omega * this.omega * f - 2 * this.zeta * this.omega * this.velocity;
      this.velocity += a * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
}

/** Deterministic PRNG (mulberry32) so `?fast=1` runs are reproducible. */
export class Rng {
  private s: number;

  constructor(seed = 0x9e3779b9) {
    this.s = seed >>> 0;
  }

  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1 - 1e-9));
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.min(arr.length - 1, Math.floor(this.next() * arr.length))];
  }
}

/** Cheap 2D value noise, used for cloth folds and texture painting. */
export function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export function valueNoise2(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

export function fbm2(x: number, y: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2(x, y);
    norm += amp;
    x *= 2.03;
    y *= 2.01;
    amp *= 0.5;
  }
  return sum / norm;
}

/** Shortest signed angular difference, in radians. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function dampAngle(
  current: number,
  target: number,
  smoothing: number,
  dt: number,
): number {
  return current + angleDelta(current, target) * (1 - Math.pow(smoothing, dt));
}
