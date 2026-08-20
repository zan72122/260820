/**
 * Every texture in the game is generated here at runtime: no third-party image assets ship
 * with the build, and each surface family (paper / wood / bamboo / metal / cloth / ground /
 * rubber / leather) gets its own base-colour, roughness and normal response.
 */

import {
  CanvasTexture,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearSRGBColorSpace,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  Texture,
  UnsignedByteType,
} from 'three';
import { Noise2D, hash1 } from './noise';
import { clamp, makeRng, smoothstep } from './math';

const cache = new Map<string, Texture>();

function makeCanvas(size: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas context unavailable');
  return { c, ctx };
}

function finish(c: HTMLCanvasElement, srgb: boolean, repeat = 1): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = srgb ? SRGBColorSpace : LinearSRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.needsUpdate = true;
  return t;
}

/** Convert a tileable height field into a tangent-space normal map. */
function heightToNormal(height: Float32Array, size: number, strength: number): DataTexture {
  const data = new Uint8Array(size * size * 4);
  const at = (x: number, y: number): number => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx;
      let ny = -dy;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      const i = (y * size + x) * 4;
      data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((nz / len) * 0.5 * 255 + 127.5);
      data[i + 3] = 255;
    }
  }
  const t = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  t.colorSpace = LinearSRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

function grayscaleTexture(height: Float32Array, size: number, lo: number, hi: number): DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = Math.round(clamp(lo + (hi - lo) * (height[i] * 0.5 + 0.5), 0, 1) * 255);
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const t = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  t.colorSpace = LinearSRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/* ------------------------------------------------------------------ washi paper */

export interface PaperTextures {
  fiberNormal: Texture;
  fiberDetail: Texture; // R: fibre density, G: local thickness, B: deckle flecks
}

/**
 * Sugihara-style washi: long visible fibres running mostly along one axis, uneven sheet
 * thickness and a few darker bark flecks. Thickness drives how much lamp light gets through.
 */
export function washiTextures(size = 512): PaperTextures {
  const key = `washi${size}`;
  const cached = cache.get(key) as unknown as PaperTextures | undefined;
  if (cached) return cached;

  const n = new Noise2D(9021);
  const fineHeight = new Float32Array(size * size);
  const { c, ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);

  // Long fibres: heavily anisotropic noise, plus a sparse set of individual strands.
  const strandRng = makeRng(4411);
  const strands: { y: number; amp: number; freq: number; phase: number; w: number }[] = [];
  for (let i = 0; i < 140; i++) {
    strands.push({
      y: strandRng() * size,
      amp: 2 + strandRng() * 9,
      freq: 0.004 + strandRng() * 0.02,
      phase: strandRng() * 10,
      w: 0.6 + strandRng() * 1.9,
    });
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      // anisotropic fibre grain (stretched 6x along x)
      const grain = n.fbmTileable(u * 6, v * 34, 6, 4);
      const cloud = n.fbmTileable(u * 3.1, v * 3.1, 3, 4); // sheet thickness clouds
      let strandV = 0;
      for (const s of strands) {
        const yy = s.y + Math.sin((x * s.freq + s.phase) * 2.2) * s.amp;
        const d = Math.abs(((y - yy + size * 1.5) % size) - size * 0.5);
        if (d < s.w * 2.2) strandV += (1 - d / (s.w * 2.2)) * 0.5;
      }
      const fleck = hash1(x * 3.7 + y * 11.3) > 0.9993 ? 1 : 0;
      const h = grain * 0.55 + strandV * 0.6 + cloud * 0.25;
      fineHeight[y * size + x] = h;

      const i = (y * size + x) * 4;
      img.data[i] = Math.round(clamp(0.5 + grain * 0.5 + strandV * 0.5, 0, 1) * 255); // fibre density
      img.data[i + 1] = Math.round(clamp(0.5 + cloud * 0.62, 0.08, 1) * 255); // local thickness
      img.data[i + 2] = Math.round(clamp(fleck * 0.9 + Math.max(0, cloud) * 0.15, 0, 1) * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const out: PaperTextures = {
    fiberNormal: heightToNormal(fineHeight, size, 1.7),
    fiberDetail: finish(c, false),
  };
  cache.set(key, out as unknown as Texture);
  return out;
}

/* ------------------------------------------------------------------ wood */

export interface PbrSet {
  map: Texture;
  normalMap: Texture;
  roughnessMap: Texture;
}

/** Painted / bare cedar. `painted` gives the cart its worn vermilion lacquer. */
export function woodTextures(
  size = 512,
  opts: { hueA?: string; hueB?: string; ringFreq?: number; wear?: number; seed?: number } = {},
): PbrSet {
  const hueA = opts.hueA ?? '#8a6742';
  const hueB = opts.hueB ?? '#5d422a';
  const ringFreq = opts.ringFreq ?? 15;
  const wear = opts.wear ?? 0.3;
  const seed = opts.seed ?? 771;
  const key = `wood${size}${hueA}${hueB}${ringFreq}${wear}${seed}`;
  const cached = cache.get(key) as unknown as PbrSet | undefined;
  if (cached) return cached;

  const n = new Noise2D(seed);
  const { c, ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const a = hexToRgb(hueA);
  const b = hexToRgb(hueB);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const warp = n.fbmTileable(u * 2.4, v * 2.4, 3, 3) * 0.22;
      const rings = Math.abs(Math.sin((v + warp) * Math.PI * ringFreq));
      const grain = n.fbmTileable(u * 22, v * 3.2, 4, 4);
      const t = clamp(rings * 0.72 + grain * 0.3 + 0.12, 0, 1);
      const scuff = smoothstep(0.55, 0.95, n.fbmTileable(u * 5.5 + 20, v * 5.5, 5, 3) * 0.5 + 0.5) * wear;
      const i = (y * size + x) * 4;
      img.data[i] = Math.round(clamp(a[0] + (b[0] - a[0]) * t + scuff * 40, 0, 255));
      img.data[i + 1] = Math.round(clamp(a[1] + (b[1] - a[1]) * t + scuff * 38, 0, 255));
      img.data[i + 2] = Math.round(clamp(a[2] + (b[2] - a[2]) * t + scuff * 34, 0, 255));
      img.data[i + 3] = 255;
      height[y * size + x] = rings * 0.35 + grain * 0.55;
      rough[y * size + x] = clamp(0.35 + rings * 0.3 + scuff * 0.9 - 0.5, -1, 1);
    }
  }
  ctx.putImageData(img, 0, 0);
  const out: PbrSet = {
    map: finish(c, true),
    normalMap: heightToNormal(height, size, 1.1),
    roughnessMap: grayscaleTexture(rough, size, 0.42, 0.95),
  };
  cache.set(key, out as unknown as Texture);
  return out;
}

/* ------------------------------------------------------------------ bamboo */

export function bambooTextures(size = 512): PbrSet {
  const key = `bamboo${size}`;
  const cached = cache.get(key) as unknown as PbrSet | undefined;
  if (cached) return cached;
  const n = new Noise2D(3311);
  const { c, ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const fiber = n.fbmTileable(u * 3, v * 46, 4, 4);
      // culm nodes across the strip
      const nodeT = Math.abs(((v * 3) % 1) - 0.5) * 2;
      const node = smoothstep(0.86, 1.0, nodeT);
      const dry = n.fbmTileable(u * 7 + 5, v * 7, 4, 3) * 0.5 + 0.5;
      const base = [206, 196, 132];
      const dark = [150, 138, 88];
      const t = clamp(fiber * 0.5 + 0.5, 0, 1) * 0.6 + dry * 0.4;
      const i = (y * size + x) * 4;
      const nodeTint = node * 34;
      img.data[i] = Math.round(clamp(base[0] + (dark[0] - base[0]) * t - nodeTint, 0, 255));
      img.data[i + 1] = Math.round(clamp(base[1] + (dark[1] - base[1]) * t - nodeTint, 0, 255));
      img.data[i + 2] = Math.round(clamp(base[2] + (dark[2] - base[2]) * t - nodeTint * 0.4, 0, 255));
      img.data[i + 3] = 255;
      height[y * size + x] = fiber * 0.4 + node * 1.6;
      rough[y * size + x] = clamp(-0.25 + dry * 0.5 + node * 0.5, -1, 1);
    }
  }
  ctx.putImageData(img, 0, 0);
  const out: PbrSet = {
    map: finish(c, true),
    normalMap: heightToNormal(height, size, 1.5),
    roughnessMap: grayscaleTexture(rough, size, 0.24, 0.72),
  };
  cache.set(key, out as unknown as Texture);
  return out;
}

/** Kindergarten hall flooring: straight boards, joints, and a scuffed satin finish. */
export function plankTextures(size = 512): PbrSet {
  const key = `plank${size}`;
  const cached = cache.get(key) as unknown as PbrSet | undefined;
  if (cached) return cached;
  const n = new Noise2D(1907);
  const { c, ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const boards = 6;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const board = Math.floor(v * boards);
      const inBoard = v * boards - board;
      const seam = smoothstep(0.045, 0.0, Math.min(inBoard, 1 - inBoard));
      // each board gets its own tone and its own grain phase
      const tone = 0.86 + 0.16 * (hash1(board * 12.9) - 0.5);
      const grain = n.fbmTileable(u * 26 + board * 3.1, v * 3.2, 13, 4);
      const scuff = smoothstep(0.55, 1.0, n.fbmTileable(u * 6 + 11, v * 6, 3, 3) * 0.5 + 0.5);
      const t = clamp(tone + grain * 0.09 - seam * 0.5 - scuff * 0.05, 0, 1.4);
      const i = (y * size + x) * 4;
      img.data[i] = Math.round(clamp(206 * t, 0, 255));
      img.data[i + 1] = Math.round(clamp(173 * t, 0, 255));
      img.data[i + 2] = Math.round(clamp(128 * t, 0, 255));
      img.data[i + 3] = 255;
      height[y * size + x] = grain * 0.25 - seam * 1.6;
      rough[y * size + x] = clamp(-0.35 + scuff * 1.1 + seam * 0.8 + grain * 0.15, -1, 1);
    }
  }
  ctx.putImageData(img, 0, 0);
  const out: PbrSet = {
    map: finish(c, true),
    normalMap: heightToNormal(height, size, 1.2),
    roughnessMap: grayscaleTexture(rough, size, 0.24, 0.78),
  };
  cache.set(key, out as unknown as Texture);
  return out;
}

/* ------------------------------------------------------------------ ground */

/** Packed summer earth for the kindergarten yard: gravel, footprints, faint evening damp. */
export function groundTextures(size = 512): PbrSet & { aoMap: Texture } {
  const key = `ground${size}`;
  const cached = cache.get(key) as unknown as (PbrSet & { aoMap: Texture }) | undefined;
  if (cached) return cached;
  const n = new Noise2D(6120);
  const { c, ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const coarse = n.fbmTileable(u * 4, v * 4, 4, 4);
      const grit = n.fbmTileable(u * 30, v * 30, 15, 3);
      const pebble = smoothstep(0.62, 0.85, n.fbmTileable(u * 16 + 3, v * 16, 8, 2) * 0.5 + 0.5);
      const damp = smoothstep(0.35, 0.8, n.fbmTileable(u * 2.2 + 9, v * 2.2, 2, 3) * 0.5 + 0.5);
      const shade = clamp(0.52 + coarse * 0.22 + grit * 0.14 + pebble * 0.18, 0, 1);
      const i = (y * size + x) * 4;
      img.data[i] = Math.round(clamp(146 * shade + pebble * 32, 0, 255));
      img.data[i + 1] = Math.round(clamp(124 * shade + pebble * 30, 0, 255));
      img.data[i + 2] = Math.round(clamp(102 * shade + pebble * 26, 0, 255));
      img.data[i + 3] = 255;
      height[y * size + x] = coarse * 0.4 + grit * 0.5 + pebble * 0.7;
      // evening dew sits in the hollows: lower roughness there
      rough[y * size + x] = clamp(0.55 - damp * 0.8 + grit * 0.3, -1, 1);
      ao[y * size + x] = clamp(coarse * 0.6 + pebble * -0.4, -1, 1);
    }
  }
  ctx.putImageData(img, 0, 0);
  const out = {
    map: finish(c, true),
    normalMap: heightToNormal(height, size, 1.35),
    roughnessMap: grayscaleTexture(rough, size, 0.55, 1.0),
    aoMap: grayscaleTexture(ao, size, 0.62, 1.0),
  };
  cache.set(key, out as unknown as Texture);
  return out;
}

/* ------------------------------------------------------------------ cloth / leather / metal */

export function clothTextures(size = 256, color = '#2e5f86', seed = 512): PbrSet {
  const key = `cloth${size}${color}${seed}`;
  const cached = cache.get(key) as unknown as PbrSet | undefined;
  if (cached) return cached;
  const n = new Noise2D(seed);
  const { c, ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const rgb = hexToRgb(color);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const weave =
        Math.sin((x / size) * Math.PI * 2 * 42) * Math.sin((y / size) * Math.PI * 2 * 42) * 0.5;
      const fuzz = n.fbmTileable((x / size) * 12, (y / size) * 12, 6, 3);
      const t = 0.86 + weave * 0.16 + fuzz * 0.12;
      const i = (y * size + x) * 4;
      img.data[i] = Math.round(clamp(rgb[0] * t, 0, 255));
      img.data[i + 1] = Math.round(clamp(rgb[1] * t, 0, 255));
      img.data[i + 2] = Math.round(clamp(rgb[2] * t, 0, 255));
      img.data[i + 3] = 255;
      height[y * size + x] = weave * 0.9 + fuzz * 0.35;
      rough[y * size + x] = clamp(0.2 + fuzz * 0.5, -1, 1);
    }
  }
  ctx.putImageData(img, 0, 0);
  const out: PbrSet = {
    map: finish(c, true),
    normalMap: heightToNormal(height, size, 0.9),
    roughnessMap: grayscaleTexture(rough, size, 0.72, 0.98),
  };
  cache.set(key, out as unknown as Texture);
  return out;
}

/** Taiko drum head: stretched cowhide, slightly polished in the centre from the bachi. */
export function drumHeadTextures(size = 256): PbrSet {
  const key = `drumhead${size}`;
  const cached = cache.get(key) as unknown as PbrSet | undefined;
  if (cached) return cached;
  const n = new Noise2D(2277);
  const { c, ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size - 0.5;
      const v = y / size - 0.5;
      const r = Math.hypot(u, v) * 2;
      const pore = n.fbmTileable((x / size) * 26, (y / size) * 26, 13, 4);
      const stretch = n.fbmTileable((x / size) * 4, (y / size) * 4, 2, 3);
      const worn = smoothstep(0.55, 0.05, r); // struck centre is polished
      const t = 0.9 + pore * 0.14 + stretch * 0.09;
      const i = (y * size + x) * 4;
      img.data[i] = Math.round(clamp(226 * t - worn * 16, 0, 255));
      img.data[i + 1] = Math.round(clamp(203 * t - worn * 20, 0, 255));
      img.data[i + 2] = Math.round(clamp(167 * t - worn * 22, 0, 255));
      img.data[i + 3] = 255;
      height[y * size + x] = pore * 0.6 + stretch * 0.5;
      rough[y * size + x] = clamp(0.4 + pore * 0.4 - worn * 1.1, -1, 1);
    }
  }
  ctx.putImageData(img, 0, 0);
  const out: PbrSet = {
    map: finish(c, true),
    normalMap: heightToNormal(height, size, 0.8),
    roughnessMap: grayscaleTexture(rough, size, 0.3, 0.9),
  };
  cache.set(key, out as unknown as Texture);
  return out;
}

/** Brushed / slightly tarnished brass for the kane and the cart fittings. */
export function metalTextures(size = 256): PbrSet {
  const key = `metal${size}`;
  const cached = cache.get(key) as unknown as PbrSet | undefined;
  if (cached) return cached;
  const n = new Noise2D(881);
  const { c, ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const brush = n.fbmTileable((x / size) * 60, (y / size) * 2.5, 4, 3);
      const tarnish = n.fbmTileable((x / size) * 5 + 7, (y / size) * 5, 3, 4) * 0.5 + 0.5;
      const t = 0.78 + brush * 0.16 - tarnish * 0.2;
      const i = (y * size + x) * 4;
      img.data[i] = Math.round(clamp(212 * t + 18, 0, 255));
      img.data[i + 1] = Math.round(clamp(180 * t + 14, 0, 255));
      img.data[i + 2] = Math.round(clamp(112 * t + 10, 0, 255));
      img.data[i + 3] = 255;
      height[y * size + x] = brush * 0.5;
      rough[y * size + x] = clamp(-0.55 + tarnish * 1.2 + brush * 0.2, -1, 1);
    }
  }
  ctx.putImageData(img, 0, 0);
  const out: PbrSet = {
    map: finish(c, true),
    normalMap: heightToNormal(height, size, 0.7),
    roughnessMap: grayscaleTexture(rough, size, 0.14, 0.62),
  };
  cache.set(key, out as unknown as Texture);
  return out;
}

/** Rubber cart tyre: moulded tread plus road dust caught in the shoulders. */
export function rubberTextures(size = 256): PbrSet {
  const key = `rubber${size}`;
  const cached = cache.get(key) as unknown as PbrSet | undefined;
  if (cached) return cached;
  const n = new Noise2D(4499);
  const { c, ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tread = Math.abs(((x / size) * 24) % 1 - 0.5) * 2;
      const groove = smoothstep(0.35, 0.6, tread);
      const dust = smoothstep(0.5, 0.95, n.fbmTileable((x / size) * 9, (y / size) * 9, 5, 3) * 0.5 + 0.5);
      const grit = n.fbmTileable((x / size) * 40, (y / size) * 40, 20, 2);
      const v = 26 + groove * 16 + dust * 58 + grit * 8;
      const i = (y * size + x) * 4;
      img.data[i] = Math.round(clamp(v * 1.02, 0, 255));
      img.data[i + 1] = Math.round(clamp(v * 0.98, 0, 255));
      img.data[i + 2] = Math.round(clamp(v * 0.94, 0, 255));
      img.data[i + 3] = 255;
      height[y * size + x] = groove * 1.4 + grit * 0.3;
      rough[y * size + x] = clamp(0.1 + dust * 0.8 + grit * 0.2, -1, 1);
    }
  }
  ctx.putImageData(img, 0, 0);
  const out: PbrSet = {
    map: finish(c, true),
    normalMap: heightToNormal(height, size, 1.4),
    roughnessMap: grayscaleTexture(rough, size, 0.62, 0.99),
  };
  cache.set(key, out as unknown as Texture);
  return out;
}

/** Paper cord used to lash the frame joints. */
export function cordTextures(size = 128): PbrSet {
  const key = `cord${size}`;
  const cached = cache.get(key) as unknown as PbrSet | undefined;
  if (cached) return cached;
  const n = new Noise2D(1201);
  const { c, ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const twist = Math.sin(((x / size) * 9 + (y / size) * 1.6) * Math.PI * 2) * 0.5 + 0.5;
      const fuzz = n.fbmTileable((x / size) * 18, (y / size) * 18, 9, 3);
      const t = 0.72 + twist * 0.24 + fuzz * 0.16;
      const i = (y * size + x) * 4;
      img.data[i] = Math.round(clamp(214 * t, 0, 255));
      img.data[i + 1] = Math.round(clamp(196 * t, 0, 255));
      img.data[i + 2] = Math.round(clamp(160 * t, 0, 255));
      img.data[i + 3] = 255;
      height[y * size + x] = twist * 1.1 + fuzz * 0.4;
    }
  }
  ctx.putImageData(img, 0, 0);
  const flat = new Float32Array(size * size).fill(0.55);
  const out: PbrSet = {
    map: finish(c, true),
    normalMap: heightToNormal(height, size, 1.2),
    roughnessMap: grayscaleTexture(flat, size, 0.85, 0.95),
  };
  cache.set(key, out as unknown as Texture);
  return out;
}

/* ------------------------------------------------------------------ helpers */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/** A soft radial falloff sprite used for glows, light pools and dust motes. */
export function radialSprite(size = 128, power = 2.2, inner = 1): CanvasTexture {
  const key = `radial${size}${power}${inner}`;
  const cached = cache.get(key) as CanvasTexture | undefined;
  if (cached) return cached;
  const { c, ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size - 0.5;
      const v = (y + 0.5) / size - 0.5;
      const r = clamp(Math.hypot(u, v) * 2, 0, 1);
      const a = Math.pow(1 - r, power) * inner;
      const i = (y * size + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(clamp(a, 0, 1) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.colorSpace = LinearSRGBColorSpace;
  t.needsUpdate = true;
  cache.set(key, t);
  return t;
}

export function disposeTextureCache(): void {
  for (const t of cache.values()) {
    const anyT = t as unknown as Record<string, Texture>;
    if (typeof (t as Texture).dispose === 'function') (t as Texture).dispose();
    else for (const k of Object.keys(anyT)) anyT[k]?.dispose?.();
  }
  cache.clear();
}
