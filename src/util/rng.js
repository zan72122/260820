// Deterministic RNG. E2E_FAST runs and repeatable casts both rely on a fixed seed.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed = 1337) { this.reseed(seed); }
  reseed(seed) { this.seed = seed >>> 0; this._n = mulberry32(this.seed); }
  next() { return this._n(); }
  range(a, b) { return a + (b - a) * this._n(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  sign() { return this._n() < 0.5 ? -1 : 1; }
  pick(arr) { return arr[Math.floor(this._n() * arr.length) % arr.length]; }
  // Bell-ish distribution, handy for "mostly average with occasional character".
  gauss() { return (this._n() + this._n() + this._n()) / 3 * 2 - 1; }
}

// Cheap value noise used by procedural textures and by the wind.
export function hash2(x, y) {
  let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}

export function valueNoise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export function fbm2(x, y, octaves = 4) {
  let f = 0, amp = 0.5, norm = 0;
  for (let i = 0; i < octaves; i++) {
    f += amp * valueNoise2(x, y);
    norm += amp;
    x *= 2.03; y *= 1.97; amp *= 0.5;
  }
  return f / norm;
}
