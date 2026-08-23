import * as THREE from 'three';
import { GlyphDef, pointInGlyph, pointInCounter } from './glyphs';

/**
 * Precomputed 2D fields over the flask interior, in "mold space":
 * u,v in [0,1] over the sand surface. The glyph occupies a centred box.
 *
 * - depress: 0..1 how deep the pattern press sinks the sand at this cell
 *            (0 inside counters -> sand islands stay standing)
 * - island:  index+1 of counter at this cell, else 0
 * - flow:    normalised melt arrival order from the gate (BFS geodesic
 *            inside glyph+runner), 1e9 outside castable region
 */

export interface MoldField {
  n: number;
  depress: Float32Array;
  island: Uint8Array;
  flow: Float32Array;
  flowMax: number;
  /** em -> mold uv transform */
  emToUv(x: number, y: number): [number, number];
  uvToEm(u: number, v: number): [number, number];
  sample(arr: Float32Array, u: number, v: number): number;
  /** gate position in uv */
  gateUv: [number, number];
  runnerHalfW: number;
  glyphScale: number;
}

export function buildMoldField(def: GlyphDef, n = 224): MoldField {
  const depress = new Float32Array(n * n);
  const island = new Uint8Array(n * n);
  const flow = new Float32Array(n * n).fill(1e9);

  // glyph box: letter height 0.62 of flask, centred, baseline offset
  const scale = 0.62;
  const cx = 0.5, cy = 0.5;
  // v is inverted: em glyph top (y=1) maps to small v (= local -z, away from camera)
  const emToUv = (x: number, y: number): [number, number] => [cx + x * scale, cy - (y - 0.5) * scale];
  const uvToEm = (u: number, v: number): [number, number] => [(u - cx) / scale, 0.5 - (v - cy) / scale];

  const gUv = emToUv(def.gate.x, def.gate.y);
  const runnerHalfW = 0.030;

  const inRunner = (u: number, v: number) =>
    u < gUv[0] + 0.012 && u > 0.035 && Math.abs(v - gUv[1]) < runnerHalfW;

  const castable = new Uint8Array(n * n);

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, v = (j + 0.5) / n;
      const [ex, ey] = uvToEm(u, v);
      const idx = j * n + i;
      const inG = pointInGlyph(def, ex, ey);
      const ci = pointInCounter(def, ex, ey);
      if (ci >= 0) island[idx] = ci + 1;
      if (inG) {
        depress[idx] = 1;
        castable[idx] = 1;
      } else if (inRunner(u, v)) {
        depress[idx] = 0.55;
        castable[idx] = 1;
      }
    }
  }

  // slight edge softening of depress (sand isn't razor sharp)
  softBlur(depress, n, 1);

  // BFS flow field from gate cell across castable region
  const gi = Math.min(n - 1, Math.max(0, Math.round(gUv[0] * n)));
  const gj = Math.min(n - 1, Math.max(0, Math.round(gUv[1] * n)));
  let start = -1;
  // find nearest castable cell to the gate
  outer: for (let r = 0; r < n; r++) {
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        const i = gi + di, j = gj + dj;
        if (i < 0 || j < 0 || i >= n || j >= n) continue;
        if (castable[j * n + i]) { start = j * n + i; break outer; }
      }
    }
  }
  if (start >= 0) {
    const q = new Int32Array(n * n);
    let qh = 0, qt = 0;
    flow[start] = 0;
    q[qt++] = start;
    const neigh = [-1, 1, -n, n, -n - 1, -n + 1, n - 1, n + 1];
    const cost = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];
    while (qh < qt) {
      const c = q[qh++];
      const ciX = c % n;
      for (let k = 0; k < 8; k++) {
        const m = c + neigh[k];
        if (m < 0 || m >= n * n) continue;
        const miX = m % n;
        if (Math.abs(miX - ciX) > 1) continue;
        if (!castable[m]) continue;
        const nd = flow[c] + cost[k];
        if (nd < flow[m] - 1e-6) {
          flow[m] = nd;
          q[qt++] = m; // BFS with diagonal costs: not exact Dijkstra but fine for a flow look
        }
      }
    }
  }
  let flowMax = 0;
  for (let k = 0; k < flow.length; k++) if (flow[k] < 1e8 && flow[k] > flowMax) flowMax = flow[k];
  if (flowMax <= 0) flowMax = 1;
  for (let k = 0; k < flow.length; k++) if (flow[k] < 1e8) flow[k] /= flowMax;

  // dilate flow values outward a few cells so contour vertices sample sane
  // values (bilinear at the glyph edge would otherwise blend with 1e9)
  for (let pass = 0; pass < 4; pass++) {
    const prev = flow.slice();
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const idx = j * n + i;
        if (prev[idx] < 1e8) continue;
        let best = 1e9;
        if (i > 0 && prev[idx - 1] < best) best = prev[idx - 1];
        if (i < n - 1 && prev[idx + 1] < best) best = prev[idx + 1];
        if (j > 0 && prev[idx - n] < best) best = prev[idx - n];
        if (j < n - 1 && prev[idx + n] < best) best = prev[idx + n];
        if (best < 1e8) flow[idx] = best;
      }
    }
  }
  for (let k = 0; k < flow.length; k++) if (flow[k] > 1e8) flow[k] = 1.05;

  const sample = (arr: Float32Array, u: number, v: number): number => {
    const x = Math.min(n - 1.001, Math.max(0, u * n - 0.5));
    const y = Math.min(n - 1.001, Math.max(0, v * n - 0.5));
    const i0 = Math.floor(x), j0 = Math.floor(y);
    const fx = x - i0, fy = y - j0;
    const a = arr[j0 * n + i0], b = arr[j0 * n + i0 + 1];
    const c = arr[(j0 + 1) * n + i0], d = arr[(j0 + 1) * n + i0 + 1];
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
  };

  return {
    n, depress, island, flow, flowMax,
    emToUv, uvToEm, sample,
    gateUv: gUv, runnerHalfW, glyphScale: scale,
  };
}

function softBlur(a: Float32Array, n: number, passes: number) {
  const tmp = new Float32Array(a.length);
  for (let p = 0; p < passes; p++) {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const idx = j * n + i;
        let s = a[idx] * 4, w = 4;
        if (i > 0) { s += a[idx - 1]; w++; }
        if (i < n - 1) { s += a[idx + 1]; w++; }
        if (j > 0) { s += a[idx - n]; w++; }
        if (j < n - 1) { s += a[idx + n]; w++; }
        tmp[idx] = s / w;
      }
    }
    a.set(tmp);
  }
}

/** deterministic hash noise (fixed seed for E2E reproducibility) */
export function hash2(x: number, y: number, seed = 7): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function valueNoise(x: number, y: number, seed = 7): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export function fbm(x: number, y: number, oct = 3, seed = 7): number {
  let s = 0, amp = 0.5, f = 1;
  for (let o = 0; o < oct; o++) {
    s += valueNoise(x * f, y * f, seed + o * 31) * amp;
    amp *= 0.5; f *= 2.1;
  }
  return s;
}

export function makeCanvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}
