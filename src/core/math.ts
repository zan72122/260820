export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const invLerp = (a: number, b: number, v: number): number =>
  a === b ? 0 : clamp((v - a) / (b - a), 0, 1);

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = invLerp(edge0, edge1, x);
  return t * t * (3 - 2 * t);
};

export const smootherstep = (edge0: number, edge1: number, x: number): number => {
  const t = invLerp(edge0, edge1, x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** Frame-rate independent exponential approach. `rate` is the fraction of the
 *  remaining distance covered per second (0.999 = very snappy). */
export const damp = (current: number, target: number, rate: number, dt: number): number =>
  lerp(current, target, 1 - Math.pow(1 - rate, dt * 60));

export const TAU = Math.PI * 2;

export const deg = (d: number): number => (d * Math.PI) / 180;

/** Deterministic value noise in 1D, used for surface detail and micro-wobble. */
export function noise1(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n: number) => {
    let t = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    t ^= t >>> 13;
    t = Math.imul(t, 0xc2b2ae35);
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
  };
  const a = h(i);
  const b = h(i + 1);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}
