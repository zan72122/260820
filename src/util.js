// ---------------------------------------------------------------------------
// Small math / noise / tween helpers shared by the whole game.
// ---------------------------------------------------------------------------

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const mix = lerp;
export const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const smootherstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
// Frame-rate independent exponential approach.
export const damp = (current, target, lambda, dt) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutElastic = (t) => {
  if (t === 0 || t === 1) return t;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};
export const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
export const easeInQuad = (t) => t * t;

// --- deterministic RNG ------------------------------------------------------
export function makeRng(seed = 1234) {
  let s = seed >>> 0;
  return function rng() {
    // xorshift32
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// --- value noise ------------------------------------------------------------
const P = new Uint8Array(512);
{
  const rng = makeRng(20260819);
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
  }
  for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const grad2 = (h, x, y) => {
  switch (h & 7) {
    case 0: return x + y;
    case 1: return x - y;
    case 2: return -x + y;
    case 3: return -x - y;
    case 4: return x;
    case 5: return -x;
    case 6: return y;
    default: return -y;
  }
};

/** Perlin-ish 2D noise in [-1,1]. */
export function noise2(x, y) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x), yf = y - Math.floor(y);
  const u = fade(xf), v = fade(yf);
  const aa = P[P[X] + Y], ab = P[P[X] + Y + 1];
  const ba = P[P[X + 1] + Y], bb = P[P[X + 1] + Y + 1];
  const x1 = lerp(grad2(aa, xf, yf), grad2(ba, xf - 1, yf), u);
  const x2 = lerp(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u);
  return lerp(x1, x2, v);
}

/** Tileable value noise over a period, for seamless textures. */
export function tileNoise(x, y, period) {
  const xi = ((x % period) + period) % period;
  const yi = ((y % period) + period) % period;
  return noise2(xi, yi);
}

export function fbm(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
  let a = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += a * noise2(x * f, y * f);
    norm += a;
    a *= gain; f *= lacunarity;
  }
  return sum / norm;
}

// --- misc -------------------------------------------------------------------
export function hexToRgb(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}
export function rgbCss(r, g, b, a = 1) {
  return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}

/** Tiny tween manager; callbacks receive eased t in [0,1]. */
export class Tweener {
  constructor() { this.items = []; }
  add(duration, onUpdate, ease = easeInOutCubic, onDone = null, delay = 0) {
    const item = { t: 0, duration, onUpdate, ease, onDone, delay, dead: false };
    this.items.push(item);
    return item;
  }
  cancel(item) { if (item) item.dead = true; }
  clear() { this.items.length = 0; }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.dead) { this.items.splice(i, 1); continue; }
      if (it.delay > 0) { it.delay -= dt; continue; }
      it.t += dt;
      const raw = it.duration <= 0 ? 1 : clamp01(it.t / it.duration);
      it.onUpdate(it.ease(raw), raw);
      if (raw >= 1) {
        it.dead = true;
        this.items.splice(i, 1);
        if (it.onDone) it.onDone();
      }
    }
  }
}
