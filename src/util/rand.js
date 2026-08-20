// Deterministic PRNG + CPU value-noise helpers used to bake procedural textures.
// Everything in this project is generated at runtime, so a fixed seed keeps the
// shop looking identical on every device and on every test run.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Tileable 2D value noise. `u,v` are in [0,1); `px,py` are how many lattice cells
 * span that range on each axis, so a plank can have 200 cells along the grain and
 * 12 across it.
 */
export function valueNoise2(u, v, px, py, seed = 1) {
  const x = u * px, y = v * py;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = fade(x - x0), fy = fade(y - y0);
  const wx = (n) => ((n % px) + px) % px;
  const wy = (n) => ((n % py) + py) % py;
  const xa = wx(x0), xb = wx(x0 + 1), ya = wy(y0), yb = wy(y0 + 1);
  return lerp(
    lerp(hash2(xa, ya, seed), hash2(xb, ya, seed), fx),
    lerp(hash2(xa, yb, seed), hash2(xb, yb, seed), fx),
    fy
  );
}

export function valueNoise(x, y, period, seed = 1) {
  return valueNoise2(x / period, y / period, period, period, seed);
}

/** Anisotropic tileable fBm. */
export function fbm2(u, v, px, py, octaves = 4, seed = 1, gain = 0.5) {
  let sum = 0, amp = 1, norm = 0, a = px, b = py;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2(u, v, Math.max(1, Math.round(a)), Math.max(1, Math.round(b)), seed + i * 131);
    norm += amp; amp *= gain; a *= 2; b *= 2;
  }
  return sum / norm;
}

/** Isotropic tileable fBm. `base` = lattice cells across the [0,1] domain. */
export function fbm(u, v, base, octaves = 4, seed = 1, gain = 0.5) {
  return fbm2(u, v, base, base, octaves, seed, gain);
}

/** Tileable Worley / cellular noise, returns distance to nearest feature point. */
export function worley(u, v, cells, seed = 1) {
  const x = u * cells, y = v * cells;
  const xi = Math.floor(x), yi = Math.floor(y);
  let best = 10;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ((xi + dx) % cells + cells) % cells;
      const cy = ((yi + dy) % cells + cells) % cells;
      const px = xi + dx + hash2(cx, cy, seed);
      const py = yi + dy + hash2(cx, cy, seed + 7717);
      const d = Math.hypot(px - x, py - y);
      if (d < best) best = d;
    }
  }
  return Math.min(1, best);
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const mix = (a, b, t) => a + (b - a) * t;
