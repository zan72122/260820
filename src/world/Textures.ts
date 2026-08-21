import * as THREE from 'three';
import { Rng, clamp } from '../core/Rng';

/**
 * Every surface in the test section is generated here: moulded FRP, wet
 * concrete, galvanised steel, rubber, and the water sheets. Procedural means
 * no placeholder assets ever ship, and every material can carry the wear,
 * streaks and drainage marks that make the scale read.
 */

type Sampler = (x: number, y: number) => number;

function makeCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  return { canvas, ctx };
}

/** Seeded, tiling value noise. */
function valueNoise(seed: number, cells: number): Sampler {
  const rng = new Rng(seed);
  const grid = new Float32Array(cells * cells);
  for (let i = 0; i < grid.length; i++) grid[i] = rng.next();
  const at = (ix: number, iy: number) =>
    grid[((iy % cells) + cells) % cells * cells + (((ix % cells) + cells) % cells)];
  return (x: number, y: number) => {
    const fx = x * cells;
    const fy = y * cells;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = fx - ix;
    const ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = at(ix, iy);
    const b = at(ix + 1, iy);
    const c = at(ix, iy + 1);
    const d = at(ix + 1, iy + 1);
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  };
}

function fbm(seed: number, baseCells: number, octaves: number): Sampler {
  const layers: { s: Sampler; amp: number }[] = [];
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    layers.push({ s: valueNoise(seed + o * 977, baseCells * Math.pow(2, o)), amp });
    total += amp;
    amp *= 0.5;
  }
  return (x, y) => {
    let v = 0;
    for (const l of layers) v += l.s(x, y) * l.amp;
    return v / total;
  };
}

function writePixels(
  size: number,
  fn: (x: number, y: number, i: number, data: Uint8ClampedArray) => void,
): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      fn(x / size, y / size, (y * size + x) * 4, img.data);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function toTexture(canvas: HTMLCanvasElement, repeat = 1, srgb = false): THREE.Texture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Height field -> tangent-space normal map. */
function normalFromHeight(size: number, height: Sampler, strength: number): HTMLCanvasElement {
  const e = 1 / size;
  return writePixels(size, (x, y, i, data) => {
    const hL = height(x - e, y);
    const hR = height(x + e, y);
    const hD = height(x, y - e);
    const hU = height(x, y + e);
    const nx = (hL - hR) * strength;
    const ny = (hD - hU) * strength;
    const nz = 1;
    const len = Math.hypot(nx, ny, nz);
    data[i] = ((nx / len) * 0.5 + 0.5) * 255;
    data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
    data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
    data[i + 3] = 255;
  });
}

export interface SurfaceMaps {
  map: THREE.Texture;
  roughnessMap: THREE.Texture;
  normalMap: THREE.Texture;
}

const cache: Record<string, SurfaceMaps | THREE.Texture> = {};

/** Moulded FRP slide shell: pale gelcoat, mould flow marks, cleaning wear. */
export function frpMaps(): SurfaceMaps {
  const key = 'frp';
  if (cache[key]) return cache[key] as SurfaceMaps;
  // 256 is plenty at the tiling these surfaces use, and it keeps the whole
  // procedural set inside a fraction of a second on a phone.
  const size = 256;
  const grain = fbm(11, 6, 3);
  const streak = valueNoise(31, 14);
  const wear = fbm(57, 3, 3);

  const map = writePixels(size, (x, y, i, d) => {
    // v runs along the slide, u across it: streaks follow the water.
    const flow = streak(x * 0.5, y * 3.0);
    const g = grain(x, y);
    const w = wear(x * 1.3, y * 0.6);
    let base = 0.78 + g * 0.1 - flow * 0.06;
    base -= clamp(w - 0.55, 0, 1) * 0.16; // scuffed lanes
    const tint = 0.955 + flow * 0.02;
    d[i] = clamp(base * 232 * tint, 0, 255);
    d[i + 1] = clamp(base * 241, 0, 255);
    d[i + 2] = clamp(base * 246 * (1.01 - g * 0.02), 0, 255);
    d[i + 3] = 255;
  });

  const rough = writePixels(size, (x, y, i, d) => {
    const flow = streak(x * 0.5, y * 3.0);
    const w = fbm(57, 3, 3)(x * 1.3, y * 0.6);
    // Dry gelcoat is glossy; scrubbed and worn lanes go duller.
    const r = clamp(0.14 + flow * 0.1 + clamp(w - 0.5, 0, 1) * 0.42, 0.05, 0.85);
    const v = r * 255;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  });

  const normal = normalFromHeight(
    size,
    (x, y) => grain(x, y) * 0.55 + streak(x * 0.5, y * 3.0) * 0.45,
    7,
  );

  const maps: SurfaceMaps = {
    map: toTexture(map, 1, true),
    roughnessMap: toTexture(rough, 1),
    normalMap: toTexture(normal, 1),
  };
  cache[key] = maps;
  return maps;
}

/** Poured concrete apron: aggregate, drainage falls, damp edges, footmarks. */
export function concreteMaps(): SurfaceMaps {
  const key = 'concrete';
  if (cache[key]) return cache[key] as SurfaceMaps;
  const size = 256;
  const agg = valueNoise(97, 120);
  const blotch = fbm(131, 4, 3);
  const damp = fbm(151, 2, 3);

  const map = writePixels(size, (x, y, i, d) => {
    const a = agg(x, y);
    const b = blotch(x, y);
    const wetness = clamp((damp(x * 0.8, y * 0.8) - 0.44) * 3.4, 0, 1);
    let v = 0.76 + a * 0.035 + b * 0.05;
    v *= 1 - wetness * 0.26; // standing damp reads darker
    d[i] = clamp(v * 208, 0, 255);
    d[i + 1] = clamp(v * 205, 0, 255);
    d[i + 2] = clamp(v * 196, 0, 255);
    d[i + 3] = 255;
  });

  const rough = writePixels(size, (x, y, i, d) => {
    const wetness = clamp((damp(x * 0.8, y * 0.8) - 0.44) * 3.4, 0, 1);
    const a = agg(x, y);
    const r = clamp(0.92 - wetness * 0.5 - a * 0.04, 0.24, 1);
    const v = r * 255;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  });

  const normal = normalFromHeight(size, (x, y) => agg(x, y) * 0.28 + blotch(x, y) * 0.72, 3);

  const maps: SurfaceMaps = {
    map: toTexture(map, 1, true),
    roughnessMap: toTexture(rough, 1),
    normalMap: toTexture(normal, 1),
  };
  cache[key] = maps;
  return maps;
}

/** Hot-dip galvanised steel: spangle, run marks, grime in the corners. */
export function galvanisedMaps(): SurfaceMaps {
  const key = 'galv';
  if (cache[key]) return cache[key] as SurfaceMaps;
  const size = 256;
  const spangle = valueNoise(211, 26);
  const grime = fbm(233, 3, 3);
  const map = writePixels(size, (x, y, i, d) => {
    const s = spangle(x, y);
    const g = grime(x, y);
    const v = 0.72 + s * 0.12 - clamp(g - 0.55, 0, 1) * 0.2;
    d[i] = clamp(v * 214, 0, 255);
    d[i + 1] = clamp(v * 219, 0, 255);
    d[i + 2] = clamp(v * 224, 0, 255);
    d[i + 3] = 255;
  });
  const rough = writePixels(size, (x, y, i, d) => {
    const s = spangle(x, y);
    const g = grime(x, y);
    const v = clamp(0.46 + s * 0.12 + clamp(g - 0.5, 0, 1) * 0.35, 0.25, 1) * 255;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  });
  const normal = normalFromHeight(size, (x, y) => spangle(x, y), 3.5);
  const maps: SurfaceMaps = {
    map: toTexture(map, 1, true),
    roughnessMap: toTexture(rough, 1),
    normalMap: toTexture(normal, 1),
  };
  cache[key] = maps;
  return maps;
}

/** Moulded rubber raft skin: matte, faint pebble grain, seam dirt. */
export function rubberMaps(): SurfaceMaps {
  const key = 'rubber';
  if (cache[key]) return cache[key] as SurfaceMaps;
  const size = 256;
  const pebble = valueNoise(307, 42);
  const wear = fbm(331, 3, 3);
  const map = writePixels(size, (x, y, i, d) => {
    const p = pebble(x, y);
    const w = wear(x, y);
    const v = 0.72 + p * 0.16 - clamp(w - 0.6, 0, 1) * 0.22;
    d[i] = clamp(v * 246, 0, 255);
    d[i + 1] = clamp(v * 247, 0, 255);
    d[i + 2] = clamp(v * 243, 0, 255);
    d[i + 3] = 255;
  });
  const rough = writePixels(size, (x, y, i, d) => {
    const p = pebble(x, y);
    const v = clamp(0.72 + p * 0.16, 0.4, 1) * 255;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  });
  const normal = normalFromHeight(size, (x, y) => pebble(x, y) * 0.7 + wear(x, y) * 0.3, 6);
  const maps: SurfaceMaps = {
    map: toTexture(map, 1, true),
    roughnessMap: toTexture(rough, 1),
    normalMap: toTexture(normal, 1),
  };
  cache[key] = maps;
  return maps;
}

/** Tiling water normal used for the film on the slide and the pools. */
export function waterNormal(): THREE.Texture {
  const key = 'waterN';
  if (cache[key]) return cache[key] as THREE.Texture;
  const size = 256;
  const n1 = fbm(401, 5, 3);
  const n2 = valueNoise(419, 40);
  const canvas = normalFromHeight(size, (x, y) => n1(x, y) * 0.75 + n2(x, y) * 0.25, 22);
  const tex = toTexture(canvas, 1);
  cache[key] = tex;
  return tex;
}

/** Long thin streaks that make the flow direction on the slide readable. */
export function flowStreaks(): THREE.Texture {
  const key = 'streaks';
  if (cache[key]) return cache[key] as THREE.Texture;
  const size = 256;
  const s = valueNoise(457, 22);
  const canvas = writePixels(size, (x, y, i, d) => {
    const v = clamp(0.5 + s(x * 1.0, y * 0.08) * 0.55, 0, 1) * 255;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  });
  const tex = toTexture(canvas, 1);
  cache[key] = tex;
  return tex;
}

/** Slow caustic ribbons projected into the pools on capable devices. */
export function caustics(): THREE.Texture {
  const key = 'caustics';
  if (cache[key]) return cache[key] as THREE.Texture;
  const size = 256;
  const a = fbm(503, 5, 3);
  const b = fbm(521, 7, 3);
  const canvas = writePixels(size, (x, y, i, d) => {
    const band = Math.abs(a(x, y) - b(x, y));
    const v = clamp(Math.pow(1 - band * 3.2, 3), 0, 1);
    const c = v * 255;
    d[i] = c;
    d[i + 1] = c;
    d[i + 2] = c;
    d[i + 3] = 255;
  });
  const tex = toTexture(canvas, 1);
  cache[key] = tex;
  return tex;
}

/** Soft round particle used for foam and spray. */
export function foamSprite(): THREE.Texture {
  const key = 'foam';
  if (cache[key]) return cache[key] as THREE.Texture;
  const size = 128;
  const lumps = fbm(601, 5, 3);
  const canvas = writePixels(size, (x, y, i, d) => {
    const dx = x - 0.5;
    const dy = y - 0.5;
    const r = Math.hypot(dx, dy) * 2;
    const edge = clamp(1 - r, 0, 1);
    const a = Math.pow(edge, 1.7) * (0.6 + lumps(x, y) * 0.7);
    d[i] = 255;
    d[i + 1] = 255;
    d[i + 2] = 255;
    d[i + 3] = clamp(a, 0, 1) * 255;
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache[key] = tex;
  return tex;
}

/** 4x4 flipbook of a foam burst, used for the landing splash. */
export function splashSheet(): THREE.Texture {
  const key = 'splash';
  if (cache[key]) return cache[key] as THREE.Texture;
  const frames = 4;
  const cell = 128;
  const size = cell * frames;
  const { canvas, ctx } = makeCanvas(size);
  ctx.clearRect(0, 0, size, size);
  const rng = new Rng(0x51ab);
  for (let f = 0; f < frames * frames; f++) {
    const cx = (f % frames) * cell + cell / 2;
    const cy = Math.floor(f / frames) * cell + cell / 2;
    const t = f / (frames * frames - 1);
    const spread = 0.16 + t * 0.42;
    const alpha = Math.pow(1 - t, 1.35);
    const blobs = 26;
    for (let b = 0; b < blobs; b++) {
      const ang = rng.range(0, Math.PI * 2);
      const rad = Math.pow(rng.next(), 0.65) * cell * spread;
      const r = cell * (0.05 + rng.next() * 0.09) * (1.15 - t * 0.5);
      const x = cx + Math.cos(ang) * rad;
      const y = cy + Math.sin(ang) * rad * 0.78 - t * cell * 0.1;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${(0.75 * alpha).toFixed(3)})`);
      g.addColorStop(0.65, `rgba(233,246,252,${(0.4 * alpha).toFixed(3)})`);
      g.addColorStop(1, 'rgba(226,242,250,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache[key] = tex;
  return tex;
}

/** Open steel grating for the inspection walkway. */
export function gratingAlpha(): THREE.Texture {
  const key = 'grate';
  if (cache[key]) return cache[key] as THREE.Texture;
  const size = 128;
  const canvas = writePixels(size, (x, y, i, d) => {
    const bar = x % (1 / 8) < 1 / 8 * 0.36 || y % (1 / 4) < (1 / 4) * 0.2 ? 255 : 0;
    d[i] = 255;
    d[i + 1] = 255;
    d[i + 2] = 255;
    d[i + 3] = bar;
  });
  const tex = toTexture(canvas, 1);
  cache[key] = tex;
  return tex;
}

/** Same surface, different tiling. Textures are shared, so anything that
 *  needs its own scale takes a clone. */
export function withRepeat(maps: SurfaceMaps, x: number, y: number): SurfaceMaps {
  const clone = (t: THREE.Texture): THREE.Texture => {
    const c = t.clone();
    c.needsUpdate = true;
    c.wrapS = c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(x, y);
    return c;
  };
  return {
    map: clone(maps.map),
    roughnessMap: clone(maps.roughnessMap),
    normalMap: clone(maps.normalMap),
  };
}
