import { CanvasTexture, RepeatWrapping, SRGBColorSpace, Texture } from 'three';
import type { PatternKind } from '../state/OpticsState';

/* ------------------------------------------------------------------ *
 * Every texture in the game is generated here at run time.
 * Nothing is fetched, so there is nothing to redistribute.
 * ------------------------------------------------------------------ */

function canvas(size: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  return { c, ctx };
}

function hash(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** tileable value noise on a lattice of `period` cells */
function vnoise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const w = (a: number) => ((a % period) + period) % period;
  const a = hash(w(xi), w(yi), seed);
  const b = hash(w(xi + 1), w(yi), seed);
  const c = hash(w(xi), w(yi + 1), seed);
  const d = hash(w(xi + 1), w(yi + 1), seed);
  const u = smooth(xf);
  const v = smooth(yf);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbm(x: number, y: number, period: number, seed: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(x * f, y * f, period * f, seed + i * 17);
    amp *= 0.5;
    f *= 2;
  }
  return sum;
}

/** tileable Voronoi: returns [F1, F2] distances in cell units */
function voronoi(x: number, y: number, cells: number, seed: number): [number, number] {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let f1 = 9;
  let f2 = 9;
  const w = (a: number) => ((a % cells) + cells) % cells;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = xi + dx;
      const cy = yi + dy;
      const px = cx + hash(w(cx), w(cy), seed);
      const py = cy + hash(w(cx), w(cy), seed + 91);
      const d = Math.hypot(px - x, py - y);
      if (d < f1) {
        f2 = f1;
        f1 = d;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return [f1, f2];
}

function heightToNormal(height: Float32Array, size: number, strength: number): CanvasTexture {
  const { c, ctx } = canvas(size);
  const img = ctx.createImageData(size, size);
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx;
      let ny = -dy;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz / len) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  return tex;
}

function grayTexture(size: number, fn: (x: number, y: number) => number, srgb = false): CanvasTexture {
  const { c, ctx } = canvas(size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.max(0, Math.min(1, fn(x / size, y / size))) * 255;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  if (srgb) tex.colorSpace = SRGBColorSpace;
  return tex;
}

function rgbTexture(
  size: number,
  fn: (x: number, y: number) => [number, number, number],
  srgb = true,
): CanvasTexture {
  const { c, ctx } = canvas(size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = fn(x / size, y / size);
      const i = (y * size + x) * 4;
      img.data[i] = Math.max(0, Math.min(1, r)) * 255;
      img.data[i + 1] = Math.max(0, Math.min(1, g)) * 255;
      img.data[i + 2] = Math.max(0, Math.min(1, b)) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  if (srgb) tex.colorSpace = SRGBColorSpace;
  return tex;
}

/* ---------------------------- library ---------------------------- */

let cache: Record<string, Texture> = {};
function memo<T extends Texture>(key: string, make: () => T): T {
  const hit = cache[key];
  if (hit) return hit as T;
  const t = make();
  cache[key] = t;
  return t;
}

export function disposeTextures(): void {
  for (const k of Object.keys(cache)) cache[k].dispose();
  cache = {};
}

/** Gelcoat: sprayed resin skin. Faint orange peel with a whisper of laminate weave. */
export function gelcoatNormal(): CanvasTexture {
  return memo('gelcoat', () => {
    const N = 256;
    const h = new Float32Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const u = (x / N) * 8;
        const v = (y / N) * 8;
        const peel = fbm(u * 3, v * 3, 24, 3, 4) * 0.55;
        // laminate weave, deliberately kept below the peel so it never reads as fabric
        const weave =
          (Math.sin(u * 26) * Math.sin(v * 26) * 0.5 + 0.5) * 0.09 +
          Math.sin((u + v) * 13) * 0.02;
        h[y * N + x] = peel + weave;
      }
    }
    return heightToNormal(h, N, 1.5);
  });
}

/** Roughness variation with a wear direction along the flow. */
export function frpRoughness(): CanvasTexture {
  return memo('frpRough', () =>
    grayTexture(256, (u, v) => {
      const streak = fbm(u * 3, v * 26, 24, 11, 4);
      const blotch = fbm(u * 5, v * 5, 24, 4, 3);
      return 0.36 + streak * 0.3 + blotch * 0.16;
    }),
  );
}

/** Brushed stainless: fine machining direction plus chatter. */
export function steelNormal(): CanvasTexture {
  return memo('steelN', () => {
    const N = 256;
    const h = new Float32Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const u = x / N;
        const v = y / N;
        const grain = fbm(u * 2, v * 120, 24, 5, 3) * 0.6;
        const chatter = Math.sin(v * 260) * 0.06;
        h[y * N + x] = grain + chatter + fbm(u * 14, v * 14, 24, 9, 2) * 0.14;
      }
    }
    return heightToNormal(h, N, 1.1);
  });
}

export function steelRoughness(): CanvasTexture {
  return memo('steelR', () =>
    grayTexture(256, (u, v) => 0.2 + fbm(u * 3, v * 40, 24, 21, 3) * 0.3 + fbm(u * 9, v * 9, 24, 6, 2) * 0.12),
  );
}

/** Knurled grip band for the collar. */
export function knurlNormal(): CanvasTexture {
  return memo('knurl', () => {
    const N = 256;
    const h = new Float32Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const u = (x / N) * 46;
        const v = (y / N) * 6;
        const a = Math.abs(((u + v) % 1) - 0.5);
        const b = Math.abs(((u - v + 100) % 1) - 0.5);
        h[y * N + x] = (Math.min(a, b) * 2) ** 0.8 * 0.8 + fbm(u * 0.4, v * 2, 24, 31, 2) * 0.1;
      }
    }
    return heightToNormal(h, N, 2.4);
  });
}

/** EPDM: matte pebbled rubber. */
export function rubberNormal(): CanvasTexture {
  return memo('rubberN', () => {
    const N = 256;
    const h = new Float32Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const u = (x / N) * 26;
        const v = (y / N) * 26;
        const [f1] = voronoi(u, v, 26, 3);
        h[y * N + x] = f1 * 0.7 + fbm(u * 2, v * 2, 24, 8, 3) * 0.3;
      }
    }
    return heightToNormal(h, N, 1.5);
  });
}

/** Raft skin: welded fabric with a coarse weave. */
export function raftNormal(): CanvasTexture {
  return memo('raftN', () => {
    const N = 256;
    const h = new Float32Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const u = (x / N) * 60;
        const v = (y / N) * 60;
        const weave = (Math.sin(u * 3.14159) * 0.5 + 0.5) * (Math.sin(v * 3.14159) * 0.5 + 0.5);
        h[y * N + x] = weave * 0.5 + fbm(u * 0.3, v * 0.3, 24, 13, 3) * 0.5;
      }
    }
    return heightToNormal(h, N, 1.2);
  });
}

export function concreteAlbedo(): CanvasTexture {
  return memo('concA', () =>
    rgbTexture(256, (u, v) => {
      const m = fbm(u * 6, v * 6, 24, 2, 4);
      const spec = hash(Math.floor(u * 256), Math.floor(v * 256), 7) > 0.9975 ? 0.09 : 0;
      const stain = fbm(u * 2, v * 2, 24, 17, 3) * 0.14;
      const g = 0.4 + m * 0.16 - stain + spec;
      return [g * 1.02, g, g * 0.96];
    }),
  );
}

export function concreteNormal(): CanvasTexture {
  return memo('concN', () => {
    const N = 256;
    const h = new Float32Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const u = (x / N) * 18;
        const v = (y / N) * 18;
        const [f1, f2] = voronoi(u, v, 18, 12);
        h[y * N + x] = fbm(u * 2, v * 2, 24, 3, 4) * 0.7 + (f2 - f1) * 0.2;
      }
    }
    return heightToNormal(h, N, 1.0);
  });
}

/** Two independent caustic layers packed into R and G. */
export function causticTexture(res: number): CanvasTexture {
  return memo(`caustic${res}`, () =>
    rgbTexture(
      res,
      (u, v) => {
        const cells = 8;
        const a = voronoi(u * cells + fbm(u * 3, v * 3, 24, 1, 2) * 0.8, v * cells, cells, 5);
        const b = voronoi(u * cells * 0.7, v * cells * 0.7 + fbm(u * 4, v * 4, 24, 6, 2) * 0.9, cells, 19);
        const ridge = (f: [number, number]) => Math.pow(Math.max(0, 1 - (f[1] - f[0])), 5);
        return [ridge(a), ridge(b), 0];
      },
      false,
    ),
  );
}

/** Soft cloud alpha used by the sky billboards. */
export function cloudTexture(): CanvasTexture {
  return memo('cloud', () => {
    const N = 256;
    const { c, ctx } = canvas(N);
    const img = ctx.createImageData(N, N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const u = x / N;
        const v = y / N;
        const d = Math.hypot(u - 0.5, (v - 0.5) * 1.9) * 2;
        const n = fbm(u * 5, v * 5, 24, 23, 5);
        const a = Math.max(0, Math.min(1, (1 - d) * 1.5 + n * 0.85 - 0.5));
        const i = (y * N + x) * 4;
        img.data[i] = 255;
        img.data[i + 1] = 255;
        img.data[i + 2] = 255;
        img.data[i + 3] = a * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  });
}

/** Streaky foam alpha for the water film. */
export function foamTexture(): CanvasTexture {
  return memo('foam', () =>
    grayTexture(256, (u, v) => {
      const s = fbm(u * 3, v * 30, 24, 41, 4);
      return Math.max(0, s * 1.6 - 0.62);
    }),
  );
}

const PLATE_HALF = 0.51; // metres, matches the physical plate

/** Height of the moulded relief on a plate, in plate-local metres. */
function plateHeight(kind: PatternKind, x: number, y: number): number {
  if (kind === 'rings') {
    const r = Math.hypot(x, y);
    const f = r * 3.1 - Math.floor(r * 3.1);
    return Math.max(0, 1 - Math.abs(f - 0.24) / 0.26) * Math.min(1, Math.max(0, (1.05 - r) / 0.5));
  }
  if (kind === 'stripes') {
    const f = y * 4.4 - Math.floor(y * 4.4);
    return Math.max(0, 1 - Math.abs(f - 0.22) / 0.22);
  }
  const g = 3.6;
  const cx = Math.round(x * g);
  const cy = Math.round(y * g);
  const jit = hash(cx, cy, 3);
  const dx = x * g - cx + (jit - 0.5) * 0.35;
  const dy = y * g - cy + ((jit * 7.13) % 1 - 0.5) * 0.35;
  return Math.max(0, 1 - Math.hypot(dx, dy) / 0.3);
}

/** Relief normal for the physical plate surface. */
export function plateReliefNormal(kind: PatternKind): CanvasTexture {
  return memo(`relief-${kind}`, () => {
    const N = 256;
    const h = new Float32Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const px = (x / N - 0.5) * 2 * PLATE_HALF;
        const py = (y / N - 0.5) * 2 * PLATE_HALF;
        h[y * N + x] = plateHeight(kind, px, py) * 0.9 + fbm(x / N * 12, y / N * 12, 24, 3, 3) * 0.1;
      }
    }
    const t = heightToNormal(h, N, 2.2);
    t.wrapS = t.wrapT = RepeatWrapping;
    return t;
  });
}

/** How much light each part of the plate lets through (also drives its opacity). */
export function plateTransmission(kind: PatternKind): CanvasTexture {
  return memo(`trans-${kind}`, () =>
    grayTexture(256, (u, v) => {
      const px = (u - 0.5) * 2 * PLATE_HALF;
      const py = (v - 0.5) * 2 * PLATE_HALF;
      return 0.24 + plateHeight(kind, px, py) * 0.76;
    }),
  );
}

/** Warm ramp used by the sky dome. */
export function skyGradient(): CanvasTexture {
  return memo('sky', () => {
    const { c, ctx } = canvas(64);
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0.0, '#2f6fb8');
    g.addColorStop(0.38, '#7fb4e2');
    g.addColorStop(0.72, '#cfe1ee');
    g.addColorStop(1.0, '#e6e2d6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  });
}
