import * as THREE from 'three';
import { clamp01, fbm, lerp, makeRng, noise2, turbulence } from '../core/util';

function makeCanvas(size: number) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  return { c, ctx };
}

function toTexture(c: HTMLCanvasElement, srgb: boolean, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** Convert a height field into a tangent-space normal map texture. */
function normalFromHeight(height: Float32Array, size: number, strength: number) {
  const { c, ctx } = makeCanvas(size);
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
  return c;
}

export type PbrSet = {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
};

let soilCache: PbrSet | null = null;

/** Crumbly autumn field soil: clods, grit, damp patches. */
export function soilTextures(): PbrSet {
  if (soilCache) return soilCache;
  const S = 512;
  const { c: albedo, ctx } = makeCanvas(S);
  const img = ctx.createImageData(S, S);
  const height = new Float32Array(S * S);
  const { c: roughC, ctx: rctx } = makeCanvas(S);
  const rimg = rctx.createImageData(S, S);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x / S) * 8;
      const v = (y / S) * 8;
      // clumps of different scale = clods sitting in loose tilth
      const clod = turbulence(u * 1.5, v * 1.5, 4, 11);
      const grain = fbm(u * 15, v * 15, 3, 23);
      const grit = noise2(x * 0.9, y * 0.9, 71);
      const damp = fbm(u * 0.8 + 3, v * 0.8, 3, 51); // wetter hollows
      const h = clod * 0.62 + grain * 0.3 + grit * 0.08;
      height[y * S + x] = h;

      // dry tilled earth -> damp dark loam
      const dryR = 0.415, dryG = 0.345, dryB = 0.268;
      const wetR = 0.185, wetG = 0.147, wetB = 0.118;
      const w = clamp01((damp - 0.42) * 2.3) * 0.85;
      const shade = 0.72 + h * 0.55;
      let r = lerp(dryR, wetR, w) * shade;
      let g = lerp(dryG, wetG, w) * shade;
      let b = lerp(dryB, wetB, w) * shade;
      // scattered pale grit + a little organic debris
      if (grit > 0.955) { r += 0.16; g += 0.15; b += 0.13; }
      if (noise2(x * 0.7 + 90, y * 0.7, 99) > 0.975) { r += 0.05; g += 0.03; b -= 0.02; }

      const i = (y * S + x) * 4;
      img.data[i] = clamp01(r) * 255;
      img.data[i + 1] = clamp01(g) * 255;
      img.data[i + 2] = clamp01(b) * 255;
      img.data[i + 3] = 255;

      // damp soil is glossier than dust
      const rough = clamp01(0.99 - w * 0.42 - grain * 0.08);
      rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = rough * 255;
      rimg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  rctx.putImageData(rimg, 0, 0);

  soilCache = {
    map: toTexture(albedo, true),
    normalMap: toTexture(normalFromHeight(height, S, 1.35), false),
    roughnessMap: toTexture(roughC, false),
  };
  return soilCache;
}

let skinCache: PbrSet | null = null;

/** Freshly lifted sweet-potato skin: red-violet, mottled, lenticels, scuffs. */
export function tuberSkinTextures(): PbrSet {
  if (skinCache) return skinCache;
  const S = 512;
  const { c: albedo, ctx } = makeCanvas(S);
  const img = ctx.createImageData(S, S);
  const height = new Float32Array(S * S);
  const { c: roughC, ctx: rctx } = makeCanvas(S);
  const rimg = rctx.createImageData(S, S);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x / S) * 6;
      const v = (y / S) * 6;
      const mottle = fbm(u * 2.4, v * 2.0, 4, 7);
      const streak = fbm(u * 0.7, v * 9.0, 3, 13); // faint lengthwise striations
      const pores = noise2(x * 1.7, y * 1.7, 41);
      const scuff = clamp01((fbm(u * 3.1 + 5, v * 3.1, 3, 61) - 0.72) * 3.0);

      // #6d2b52 .. #a04a72 red-violet range, with paler scuffed flesh showing
      let r = lerp(0.30, 0.47, mottle) + streak * 0.045;
      let g = lerp(0.055, 0.115, mottle) + streak * 0.015;
      let b = lerp(0.145, 0.245, mottle) + streak * 0.022;
      if (pores < 0.055) { r *= 0.6; g *= 0.6; b *= 0.65; } // lenticel dots
      r = lerp(r, 0.60, scuff * 0.5);
      g = lerp(g, 0.40, scuff * 0.5);
      b = lerp(b, 0.31, scuff * 0.5);

      const h = mottle * 0.5 + (pores < 0.055 ? -0.35 : 0) + streak * 0.15;
      height[y * S + x] = h;

      const i = (y * S + x) * 4;
      img.data[i] = clamp01(r) * 255;
      img.data[i + 1] = clamp01(g) * 255;
      img.data[i + 2] = clamp01(b) * 255;
      img.data[i + 3] = 255;

      const rough = clamp01(0.52 + mottle * 0.2 + scuff * 0.3);
      rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = rough * 255;
      rimg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  rctx.putImageData(rimg, 0, 0);

  skinCache = {
    map: toTexture(albedo, true),
    normalMap: toTexture(normalFromHeight(height, S, 1.5), false),
    roughnessMap: toTexture(roughC, false),
  };
  return skinCache;
}

let woodCache: PbrSet | null = null;

/** Old harvest crate: open grain, split ends, worn corners. */
export function woodTextures(): PbrSet {
  if (woodCache) return woodCache;
  const S = 512;
  const { c: albedo, ctx } = makeCanvas(S);
  const img = ctx.createImageData(S, S);
  const height = new Float32Array(S * S);
  const { c: roughC, ctx: rctx } = makeCanvas(S);
  const rimg = rctx.createImageData(S, S);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const warp = fbm(u * 4, v * 22, 3, 5) * 0.22;
      const rings = Math.abs(Math.sin((v * 26 + warp * 9) * Math.PI));
      const fibre = fbm(u * 3, v * 90, 2, 17);
      const wear = fbm(u * 5 + 2, v * 5, 3, 29);
      const g0 = 0.30 + rings * 0.20 + fibre * 0.09;
      let r = g0 * 1.24;
      let g = g0 * 0.99;
      let b = g0 * 0.70;
      const bleach = clamp01((wear - 0.55) * 2.4);
      r = lerp(r, 0.56, bleach * 0.5);
      g = lerp(g, 0.52, bleach * 0.5);
      b = lerp(b, 0.45, bleach * 0.5);
      height[y * S + x] = rings * 0.6 + fibre * 0.4;

      const i = (y * S + x) * 4;
      img.data[i] = clamp01(r) * 255;
      img.data[i + 1] = clamp01(g) * 255;
      img.data[i + 2] = clamp01(b) * 255;
      img.data[i + 3] = 255;
      const rough = clamp01(0.74 + rings * 0.12 + bleach * 0.12);
      rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = rough * 255;
      rimg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  rctx.putImageData(rimg, 0, 0);
  woodCache = {
    map: toTexture(albedo, true),
    normalMap: toTexture(normalFromHeight(height, S, 1.1), false),
    roughnessMap: toTexture(roughC, false),
  };
  return woodCache;
}

let steelCache: PbrSet | null = null;

/** Worn digging-fork steel: polished tips, pitted shoulders. */
export function steelTextures(): PbrSet {
  if (steelCache) return steelCache;
  const S = 256;
  const { c: albedo, ctx } = makeCanvas(S);
  const img = ctx.createImageData(S, S);
  const height = new Float32Array(S * S);
  const { c: roughC, ctx: rctx } = makeCanvas(S);
  const rimg = rctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x / S) * 4;
      const v = (y / S) * 4;
      const pit = turbulence(u * 7, v * 7, 3, 3);
      const scratch = fbm(u * 1.2, v * 40, 2, 9);
      const rust = clamp01((fbm(u * 2.2 + 8, v * 2.2, 3, 19) - 0.58) * 3);
      let base = 0.54 + scratch * 0.18 + pit * 0.12;
      let r = base, g = base, b = base * 1.03;
      r = lerp(r, 0.44, rust); g = lerp(g, 0.27, rust); b = lerp(b, 0.17, rust);
      height[y * S + x] = pit * 0.7 + scratch * 0.3;
      const i = (y * S + x) * 4;
      img.data[i] = clamp01(r) * 255;
      img.data[i + 1] = clamp01(g) * 255;
      img.data[i + 2] = clamp01(b) * 255;
      img.data[i + 3] = 255;
      const rough = clamp01(0.26 + pit * 0.35 + rust * 0.42);
      rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = rough * 255;
      rimg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  rctx.putImageData(rimg, 0, 0);
  steelCache = {
    map: toTexture(albedo, true),
    normalMap: toTexture(normalFromHeight(height, S, 0.9), false),
    roughnessMap: toTexture(roughC, false),
  };
  return steelCache;
}

let leafCache: { map: THREE.Texture; alphaMap: THREE.Texture } | null = null;

/**
 * Leaf surface detail in leaf-local UV space (0..1 across the blade).
 * Alpha carries insect damage so no two leaves read as the same card.
 */
export function leafTextures() {
  if (leafCache) return leafCache;
  const S = 256;
  const { c: albedo, ctx } = makeCanvas(S);
  const rng = makeRng(4242);

  ctx.fillStyle = '#5e7f35';
  ctx.fillRect(0, 0, S, S);
  const im = ctx.getImageData(0, 0, S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const blotch = fbm(u * 5, v * 5, 3, 3);
      const fine = fbm(u * 30, v * 30, 2, 8);
      // autumn yellowing creeps in from the margins and the tip
      const edge = clamp01(1 - Math.min(Math.min(u, 1 - u), Math.min(v, 1 - v)) * 3.4);
      const yellow = clamp01(edge * 0.85 + (blotch - 0.55) * 1.4);
      let r = lerp(0.215, 0.66, yellow) + fine * 0.05;
      let g = lerp(0.395, 0.60, yellow) + fine * 0.06;
      let b = lerp(0.105, 0.19, yellow) + fine * 0.02;
      const i = (y * S + x) * 4;
      im.data[i] = clamp01(r * (0.82 + blotch * 0.4)) * 255;
      im.data[i + 1] = clamp01(g * (0.82 + blotch * 0.4)) * 255;
      im.data[i + 2] = clamp01(b * (0.82 + blotch * 0.4)) * 255;
      im.data[i + 3] = 255;
    }
  }
  ctx.putImageData(im, 0, 0);

  // veins: midrib from the base (0.5, 1) to the tip (0.5, 0), then laterals
  ctx.strokeStyle = 'rgba(178,192,138,0.30)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(S * 0.5, S * 0.98);
  ctx.lineTo(S * 0.5, S * 0.05);
  ctx.stroke();
  ctx.lineWidth = 1.25;
  for (let i = 0; i < 9; i++) {
    const t = 0.1 + i * 0.095;
    const y0 = S * (0.95 - t * 0.9);
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(S * 0.5, y0);
      ctx.quadraticCurveTo(
        S * (0.5 + dir * 0.24), y0 - S * 0.03,
        S * (0.5 + dir * (0.46 - t * 0.28)), y0 - S * (0.10 + t * 0.05),
      );
      ctx.stroke();
    }
  }

  // alpha map: insect holes + nibbled margins
  const { c: alphaC, ctx: actx } = makeCanvas(S);
  actx.fillStyle = '#fff';
  actx.fillRect(0, 0, S, S);
  actx.fillStyle = '#000';
  for (let i = 0; i < 5; i++) {
    const cx = rng() * S;
    const cy = rng() * S;
    const rad = 3 + rng() * 8;
    actx.beginPath();
    for (let a = 0; a <= 20; a++) {
      const ang = (a / 20) * Math.PI * 2;
      const rr = rad * (0.65 + noise2(Math.cos(ang) * 3 + i * 7, Math.sin(ang) * 3, i) * 0.8);
      const px = cx + Math.cos(ang) * rr;
      const py = cy + Math.sin(ang) * rr;
      if (a === 0) actx.moveTo(px, py); else actx.lineTo(px, py);
    }
    actx.closePath();
    actx.fill();
  }

  leafCache = { map: toTexture(albedo, true), alphaMap: toTexture(alphaC, false) };
  return leafCache;
}

let mudCache: THREE.Texture | null = null;

/** Greyscale mask deciding where wet soil clings to a lifted tuber. */
export function mudMaskTexture(): THREE.Texture {
  if (mudCache) return mudCache;
  const S = 256;
  const { c, ctx } = makeCanvas(S);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x / S) * 5;
      const v = (y / S) * 5;
      const m = clamp01(turbulence(u * 2.2, v * 2.2, 4, 77) * 1.25 + fbm(u * 8, v * 8, 2, 5) * 0.25 - 0.12);
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = m * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  mudCache = toTexture(c, false);
  return mudCache;
}
