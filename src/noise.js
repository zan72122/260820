// Small deterministic noise + canvas-texture helpers.
// Everything here is procedural so the game ships with zero binary assets.

export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

/** Tileable value noise on a period x period lattice. */
function valueNoise(seed, period) {
  const rnd = makeRng(seed);
  const P = Math.max(2, period | 0);
  const g = new Float32Array(P * P);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const at = (x, y) => g[(((y % P) + P) % P) * P + (((x % P) + P) % P)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const tx = x - xi, ty = y - yi;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = at(xi, yi), b = at(xi + 1, yi);
    const c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    const top = a + (b - a) * sx;
    const bot = c + (d - c) * sx;
    return top + (bot - top) * sy;
  };
}

/** Tileable fBm over the unit square. Returns f(u, v) in [0,1]. */
export function fbm(seed, baseFreq = 6, octaves = 5, gain = 0.5) {
  const layers = [];
  let p = Math.max(2, baseFreq | 0);
  for (let o = 0; o < octaves; o++) {
    layers.push({ n: valueNoise(seed + o * 7919, p), p });
    p *= 2;
  }
  return (u, v) => {
    let sum = 0, amp = 1, tot = 0;
    for (const l of layers) {
      sum += amp * l.n(u * l.p, v * l.p);
      tot += amp;
      amp *= gain;
    }
    return sum / tot;
  };
}

/** Ridged / billowy variant, good for crusty snow and rock. */
export function ridged(seed, baseFreq = 6, octaves = 4) {
  const f = fbm(seed, baseFreq, octaves);
  return (u, v) => 1 - Math.abs(f(u, v) * 2 - 1);
}

export function canvas2d(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { canvas: c, ctx: c.getContext('2d', { willReadFrequently: true }) };
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Fill a canvas pixel-by-pixel. cb(u, v, x, y) must return [r,g,b] in 0..255.
 * Kept as a tight loop; these run once at boot.
 */
export function paint(w, h, cb) {
  const { canvas, ctx } = canvas2d(w, h);
  const img = ctx.createImageData(w, h);
  const d = img.data;
  let i = 0;
  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const rgb = cb(x / w, v, x, y);
      d[i++] = rgb[0]; d[i++] = rgb[1]; d[i++] = rgb[2]; d[i++] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Grayscale height canvas -> tangent-space normal map canvas (Sobel). */
export function heightToNormal(heightCanvas, strength = 2.4) {
  const w = heightCanvas.width, h = heightCanvas.height;
  const hctx = heightCanvas.getContext('2d', { willReadFrequently: true });
  const src = hctx.getImageData(0, 0, w, h).data;
  const H = (x, y) => src[((((y % h) + h) % h) * w + (((x % w) + w) % w)) * 4] / 255;

  const { canvas, ctx } = canvas2d(w, h);
  const out = ctx.createImageData(w, h);
  const d = out.data;
  let i = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = H(x - 1, y - 1), t = H(x, y - 1), tr = H(x + 1, y - 1);
      const l = H(x - 1, y), r = H(x + 1, y);
      const bl = H(x - 1, y + 1), b = H(x, y + 1), br = H(x + 1, y + 1);
      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);
      let nx = -dx * strength, ny = -dy * strength, nz = 1;
      const inv = 1 / Math.hypot(nx, ny, nz);
      nx *= inv; ny *= inv; nz *= inv;
      d[i++] = (nx * 0.5 + 0.5) * 255;
      d[i++] = (ny * 0.5 + 0.5) * 255;
      d[i++] = (nz * 0.5 + 0.5) * 255;
      d[i++] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

/** Grayscale canvas from a scalar field, used as height / roughness / ao source. */
export function paintGray(w, h, cb) {
  return paint(w, h, (u, v, x, y) => {
    const g = clamp(cb(u, v, x, y), 0, 1) * 255;
    return [g, g, g];
  });
}
