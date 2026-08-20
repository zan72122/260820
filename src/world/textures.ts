import * as THREE from 'three';
import { fbm2D, makeValueNoise2D, Rng } from '../core/rng';
import { clamp01, lerp, smoothstep } from '../core/mathx';

/**
 * All maps are generated at runtime on a 2D canvas. Nothing is downloaded, so
 * there is no asset licence to verify and no network cost; the trade is a few
 * milliseconds of CPU at load, which is cached per (kind, size, seed).
 */

type Ctx2D = CanvasRenderingContext2D;

function makeCanvas(size: number): { canvas: HTMLCanvasElement; ctx: Ctx2D } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as Ctx2D;
  return { canvas, ctx };
}

function toTexture(
  canvas: HTMLCanvasElement,
  opts: { srgb?: boolean; repeat?: number; aniso?: number } = {},
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (opts.repeat) tex.repeat.set(opts.repeat, opts.repeat);
  tex.anisotropy = opts.aniso ?? 4;
  tex.colorSpace = opts.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Sobel-style height -> tangent-space normal conversion. */
function heightToNormal(height: Float32Array, size: number, strength: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const at = (x: number, y: number): number =>
    height[((y + size) % size) * size + ((x + size) % size)];
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
      img.data[i + 2] = (nz / len) * 0.5 * 255 + 127.5;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export interface UmeMaps {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
}

/**
 * Ripe ume skin: a yellow-green base that shifts toward gold, a faint sun
 * blush, the tiny rust-brown speckles real fruit carry, and the dusty bloom
 * that keeps it from looking like polished plastic.
 */
export function makeUmeMaps(size: number, seed: number, ripeness: number): UmeMaps {
  const noise = makeValueNoise2D(seed);
  const noiseB = makeValueNoise2D(seed ^ 0x51ab);
  const noiseC = makeValueNoise2D(seed ^ 0x2f77);
  const rng = new Rng(seed ^ 0x77aa);

  const { canvas: albedoC, ctx: aCtx } = makeCanvas(size);
  const { canvas: roughC, ctx: rCtx } = makeCanvas(size);
  const aImg = aCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  // Unripe green -> ripe gold -> the deep amber of a fruit left one day too
  // long. A real ume carries all three at once, in patches.
  const cGreen = { r: 0.55, g: 0.66, b: 0.22 };
  const cGold = { r: 0.93, g: 0.72, b: 0.17 };
  const cAmber = { r: 0.84, g: 0.50, b: 0.10 };
  const cBlush = { r: 0.74, g: 0.20, b: 0.09 };
  const cBloom = { r: 0.80, g: 0.84, b: 0.72 };

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = (y * size + x) * 4;

      // Ripening is patchy, never a uniform wash.
      const patch = fbm2D(noise, u * 2.4, v * 2.4, 4);
      const patch2 = fbm2D(noiseC, u * 5.5 + 13, v * 5.5, 3);
      const local = clamp01(ripeness * 0.9 + (patch - 0.5) * 0.7 + (patch2 - 0.5) * 0.28);
      let r: number;
      let g: number;
      let b: number;
      if (local < 0.62) {
        const t = local / 0.62;
        r = lerp(cGreen.r, cGold.r, t);
        g = lerp(cGreen.g, cGold.g, t);
        b = lerp(cGreen.b, cGold.b, t);
      } else {
        const t = (local - 0.62) / 0.38;
        r = lerp(cGold.r, cAmber.r, t);
        g = lerp(cGold.g, cAmber.g, t);
        b = lerp(cGold.b, cAmber.b, t);
      }

      // Sun blush: one cheek only, and only once the fruit is ripe.
      const blush = smoothstep(0.5, 0.98, fbm2D(noiseB, u * 1.4 + 3.1, v * 1.4, 3)) * ripeness;
      r = lerp(r, cBlush.r, blush * 0.55);
      g = lerp(g, cBlush.g, blush * 0.55);
      b = lerp(b, cBlush.b, blush * 0.55);

      // Skin grain at two scales.
      const grain = fbm2D(noise, u * 30, v * 30, 3) - 0.5;
      const micro = fbm2D(noiseC, u * 110, v * 110, 2) - 0.5;
      r = clamp01(r + grain * 0.085 + micro * 0.03);
      g = clamp01(g + grain * 0.08 + micro * 0.03);
      b = clamp01(b + grain * 0.06 + micro * 0.02);

      // Bloom: the powdery wax, in distinct drifts rather than everywhere.
      const bloom = clamp01(fbm2D(noiseB, u * 4.5 + 11, v * 4.5, 4) * 2.1 - 0.95);
      r = lerp(r, cBloom.r, bloom * 0.44);
      g = lerp(g, cBloom.g, bloom * 0.44);
      b = lerp(b, cBloom.b, bloom * 0.44);

      aImg.data[i] = r * 255;
      aImg.data[i + 1] = g * 255;
      aImg.data[i + 2] = b * 255;
      aImg.data[i + 3] = 255;

      // Gloss belongs to bare skin; bloom is chalk-matte. That contrast is
      // what stops the fruit reading as moulded plastic.
      const rough = clamp01(0.24 + bloom * 0.6 + grain * 0.22 + micro * 0.07);
      rImg.data[i] = rough * 255;
      rImg.data[i + 1] = rough * 255;
      rImg.data[i + 2] = rough * 255;
      rImg.data[i + 3] = 255;

      height[y * size + x] = grain * 0.62 + micro * 0.38;
    }
  }

  aCtx.putImageData(aImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  // Rust speckles: discrete marks, the strongest single cue that a surface
  // grew rather than being moulded.
  const speckCount = Math.round(size * 1.1);
  for (let i = 0; i < speckCount; i++) {
    const x = rng.range(0, size);
    const y = rng.range(0, size);
    const rad = rng.range(size * 0.0016, size * 0.0075);
    const a = rng.range(0.12, 0.62);
    const dark = rng.next() < 0.35;
    aCtx.fillStyle = dark ? `rgba(78, 46, 16, ${a})` : `rgba(140, 92, 34, ${a * 0.8})`;
    aCtx.beginPath();
    aCtx.ellipse(x, y, rad, rad * rng.range(0.55, 1.7), rng.range(0, Math.PI), 0, Math.PI * 2);
    aCtx.fill();
    rCtx.fillStyle = `rgba(235, 235, 235, ${a * 0.75})`;
    rCtx.beginPath();
    rCtx.ellipse(x, y, rad * 1.25, rad * 1.25, 0, 0, Math.PI * 2);
    rCtx.fill();
    const hi = Math.min(size - 1, Math.max(0, Math.floor(y))) * size +
      Math.min(size - 1, Math.max(0, Math.floor(x)));
    height[hi] -= 0.28;
  }

  // Freckle clusters, the kind that form where a fruit rested on a branch.
  for (let i = 0; i < 8; i++) {
    const cx = rng.range(0, size);
    const cy = rng.range(0, size);
    const spread = rng.range(size * 0.02, size * 0.06);
    for (let j = 0; j < 22; j++) {
      aCtx.fillStyle = `rgba(96, 58, 22, ${rng.range(0.1, 0.4)})`;
      aCtx.beginPath();
      aCtx.arc(cx + rng.jitter(spread), cy + rng.jitter(spread),
        rng.range(size * 0.001, size * 0.004), 0, Math.PI * 2);
      aCtx.fill();
    }
  }

  return {
    map: toTexture(albedoC, { srgb: true }),
    roughnessMap: toTexture(roughC),
    normalMap: toTexture(heightToNormal(height, size, size * 0.014)),
  };
}

export interface PbrMaps {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
}

/** Warm planed cedar for the workbench, scoop and drying tray. */
export function makeWoodMaps(size: number, seed: number, repeat = 1): PbrMaps {
  const noise = makeValueNoise2D(seed);
  const rng = new Rng(seed ^ 0x1234);
  const { canvas: aC, ctx: aCtx } = makeCanvas(size);
  const { canvas: rC, ctx: rCtx } = makeCanvas(size);
  const aImg = aCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = (y * size + x) * 4;
      // Grain: rings stretched hard along one axis, warped by low-freq noise.
      const warp = fbm2D(noise, u * 1.7, v * 0.45, 3) * 0.5;
      // Few, soft growth rings. The hard high-frequency streaks that read as
      // a barcode are deliberately absent.
      const rings = Math.sin((v * 7.5 + warp * 5 + fbm2D(noise, u * 3.4, v * 1.1, 2) * 2.2) * Math.PI);
      const g = clamp01(0.5 + Math.sign(rings) * Math.pow(Math.abs(rings), 1.7) * 0.32);
      const fibre = (fbm2D(noise, u * 2.4, v * 34, 3) - 0.5) * 0.8;

      const base = { r: 0.74, g: 0.58, b: 0.38 };
      const dark = { r: 0.47, g: 0.33, b: 0.2 };
      const t = clamp01(g * 0.86 + fibre * 0.4 + 0.08);
      const r = lerp(dark.r, base.r, t);
      const gg = lerp(dark.g, base.g, t);
      const b = lerp(dark.b, base.b, t);
      aImg.data[i] = r * 255;
      aImg.data[i + 1] = gg * 255;
      aImg.data[i + 2] = b * 255;
      aImg.data[i + 3] = 255;

      const rough = clamp01(0.6 + (1 - t) * 0.2 + fibre * 0.22);
      rImg.data[i] = rough * 255;
      rImg.data[i + 1] = rough * 255;
      rImg.data[i + 2] = rough * 255;
      rImg.data[i + 3] = 255;
      height[y * size + x] = t * 0.6 + fibre * 0.4;
    }
  }
  aCtx.putImageData(aImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  // A few knots and use-marks so the bench reads as a working surface.
  for (let i = 0; i < 4; i++) {
    const x = rng.range(0, size);
    const y = rng.range(0, size);
    const rad = rng.range(size * 0.01, size * 0.03);
    const grad = aCtx.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, 'rgba(58,36,18,0.9)');
    grad.addColorStop(0.6, 'rgba(96,64,34,0.45)');
    grad.addColorStop(1, 'rgba(120,86,50,0)');
    aCtx.fillStyle = grad;
    aCtx.beginPath();
    aCtx.arc(x, y, rad, 0, Math.PI * 2);
    aCtx.fill();
  }

  return {
    map: toTexture(aC, { srgb: true, repeat }),
    roughnessMap: toTexture(rC, { repeat }),
    normalMap: toTexture(heightToNormal(height, size, size * 0.008), { repeat }),
  };
}

/** Orchard floor: dry soil, moss patches, scattered grass. */
export function makeGroundMaps(size: number, seed: number, repeat = 4): PbrMaps {
  const noise = makeValueNoise2D(seed);
  const noiseB = makeValueNoise2D(seed ^ 0x9911);
  const { canvas: aC, ctx: aCtx } = makeCanvas(size);
  const { canvas: rC, ctx: rCtx } = makeCanvas(size);
  const aImg = aCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = (y * size + x) * 4;
      const soil = fbm2D(noise, u * 4, v * 4, 5);
      const grass = clamp01(fbm2D(noiseB, u * 14 + 4, v * 14, 4) * 1.7 - 0.55);
      const detail = fbm2D(noise, u * 62, v * 62, 3) - 0.5;
      const blades = fbm2D(noiseB, u * 150, v * 38, 2) - 0.5;

      const cSoil = { r: 0.36, g: 0.28, b: 0.19 };
      const cDry = { r: 0.55, g: 0.46, b: 0.31 };
      const cGrass = { r: 0.34, g: 0.45, b: 0.19 };
      let r = lerp(cSoil.r, cDry.r, soil);
      let g = lerp(cSoil.g, cDry.g, soil);
      let b = lerp(cSoil.b, cDry.b, soil);
      r = lerp(r, cGrass.r, grass);
      g = lerp(g, cGrass.g, grass);
      b = lerp(b, cGrass.b, grass);
      r = clamp01(r + detail * 0.14 + blades * grass * 0.14);
      g = clamp01(g + detail * 0.14 + blades * grass * 0.18);
      b = clamp01(b + detail * 0.1 + blades * grass * 0.08);

      aImg.data[i] = r * 255;
      aImg.data[i + 1] = g * 255;
      aImg.data[i + 2] = b * 255;
      aImg.data[i + 3] = 255;
      const rough = clamp01(0.86 - grass * 0.14 + detail * 0.1);
      rImg.data[i] = rough * 255;
      rImg.data[i + 1] = rough * 255;
      rImg.data[i + 2] = rough * 255;
      rImg.data[i + 3] = 255;
      height[y * size + x] = soil * 0.5 + grass * 0.2 + detail * 0.4 + blades * 0.25;
    }
  }
  aCtx.putImageData(aImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  return {
    map: toTexture(aC, { srgb: true, repeat }),
    roughnessMap: toTexture(rC, { repeat }),
    normalMap: toTexture(heightToNormal(height, size, size * 0.02), { repeat }),
  };
}

/**
 * The harvest net. Drawn as an alpha-tested weave so the mesh has real holes
 * without ever entering the transparent sort queue.
 */
export function makeNetMaps(size: number): { map: THREE.CanvasTexture; alphaMap: THREE.CanvasTexture } {
  const { canvas: aC, ctx } = makeCanvas(size);
  const { canvas: mC, ctx: mCtx } = makeCanvas(size);
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, size, size);

  const cells = 8;
  const step = size / cells;
  const cord = Math.max(2, step * 0.22);

  mCtx.fillStyle = '#0e1b2e';
  mCtx.fillRect(0, 0, size, size);

  // Alpha: white where a cord runs.
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'butt';
  ctx.lineWidth = cord;
  for (let i = 0; i <= cells; i++) {
    const p = i * step;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  // Colour: twisted blue polypropylene, lighter along the cord centre.
  for (let i = 0; i <= cells; i++) {
    const p = i * step;
    const gv = mCtx.createLinearGradient(p - cord / 2, 0, p + cord / 2, 0);
    gv.addColorStop(0, '#173a58');
    gv.addColorStop(0.4, '#3d6f92');
    gv.addColorStop(0.6, '#6c9cbb');
    gv.addColorStop(1, '#1b3d5c');
    mCtx.strokeStyle = gv;
    mCtx.lineWidth = cord;
    mCtx.beginPath();
    mCtx.moveTo(p, 0);
    mCtx.lineTo(p, size);
    mCtx.stroke();

    const gh = mCtx.createLinearGradient(0, p - cord / 2, 0, p + cord / 2);
    gh.addColorStop(0, '#14324c');
    gh.addColorStop(0.45, '#396683');
    gh.addColorStop(0.65, '#628fae');
    gh.addColorStop(1, '#173651');
    mCtx.strokeStyle = gh;
    mCtx.beginPath();
    mCtx.moveTo(0, p);
    mCtx.lineTo(size, p);
    mCtx.stroke();
  }

  return {
    map: toTexture(mC, { srgb: true }),
    alphaMap: toTexture(aC),
  };
}

/** Rough plaster / stucco used for the workshop wall behind the bench. */
export function makeWallMaps(size: number, seed: number, repeat = 2): PbrMaps {
  const noise = makeValueNoise2D(seed);
  const { canvas: aC, ctx: aCtx } = makeCanvas(size);
  const { canvas: rC, ctx: rCtx } = makeCanvas(size);
  const aImg = aCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const i = (y * size + x) * 4;
      const n = fbm2D(noise, u * 12, v * 12, 4);
      const fine = fbm2D(noise, u * 70, v * 70, 2) - 0.5;
      const t = clamp01(n * 0.5 + 0.5 + fine * 0.3);
      const r = lerp(0.62, 0.82, t);
      const g = lerp(0.58, 0.78, t);
      const b = lerp(0.5, 0.68, t);
      aImg.data[i] = r * 255;
      aImg.data[i + 1] = g * 255;
      aImg.data[i + 2] = b * 255;
      aImg.data[i + 3] = 255;
      const rough = clamp01(0.9 + fine * 0.1);
      rImg.data[i] = rough * 255;
      rImg.data[i + 1] = rough * 255;
      rImg.data[i + 2] = rough * 255;
      rImg.data[i + 3] = 255;
      height[y * size + x] = t;
    }
  }
  aCtx.putImageData(aImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  return {
    map: toTexture(aC, { srgb: true, repeat }),
    roughnessMap: toTexture(rC, { repeat }),
    normalMap: toTexture(heightToNormal(height, size, size * 0.012), { repeat }),
  };
}

/** Faint scuffs and fingerprints for the jar glass. */
export function makeGlassWearMap(size: number, seed: number): THREE.CanvasTexture {
  const rng = new Rng(seed);
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, size, size);
  ctx.lineCap = 'round';
  for (let i = 0; i < 130; i++) {
    const x = rng.range(0, size);
    const y = rng.range(0, size);
    const len = rng.range(size * 0.01, size * 0.09);
    const ang = rng.range(0, Math.PI * 2);
    ctx.strokeStyle = `rgba(190,190,190,${rng.range(0.05, 0.3)})`;
    ctx.lineWidth = rng.range(0.6, 2.2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }
  for (let i = 0; i < 10; i++) {
    const x = rng.range(0, size);
    const y = rng.range(0, size);
    const rad = rng.range(size * 0.02, size * 0.06);
    const grad = ctx.createRadialGradient(x, y, rad * 0.2, x, y, rad);
    grad.addColorStop(0, 'rgba(150,150,150,0.16)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(canvas);
}

/** Soft round shadow used for contact shadows under fruit and trays. */
export function makeContactShadowTexture(size = 128): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.62)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.34)');
  g.addColorStop(0.78, 'rgba(0,0,0,0.10)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = toTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** Round soft blob used for droplets, glints and dust motes. */
export function makeBlobTexture(size = 64, hardness = 0.35): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(hardness, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = toTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** Leaf silhouette used for the dappled light gobo and canopy cards. */
export function makeLeafDappleTexture(size: number, seed: number): THREE.CanvasTexture {
  const rng = new Rng(seed);
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  for (let i = 0; i < 1400; i++) {
    const x = rng.range(0, size);
    const y = rng.range(0, size);
    const w = rng.range(size * 0.006, size * 0.019);
    const h = w * rng.range(0.4, 0.8);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rng.range(0, Math.PI * 2));
    ctx.beginPath();
    ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Blur toward a soft gobo by repeated low-alpha redraws.
  ctx.globalAlpha = 0.4;
  ctx.filter = 'blur(3px)';
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;

  // Thin the canopy out toward its rim: a tree's shade has a soft round edge.
  const fade = ctx.createRadialGradient(
    size / 2, size / 2, size * 0.24, size / 2, size / 2, size * 0.5,
  );
  fade.addColorStop(0, 'rgba(255,255,255,0)');
  fade.addColorStop(0.75, 'rgba(255,255,255,0.7)');
  fade.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);

  const tex = toTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/**
 * A cluster of plum leaves with alpha, used for alpha-tested canopy cards.
 * Alpha test rather than blending keeps the tree out of the sort queue.
 */
export function makeLeafCardTexture(size: number, seed: number): {
  map: THREE.CanvasTexture;
  alphaMap: THREE.CanvasTexture;
} {
  const rng = new Rng(seed);
  const { canvas: cC, ctx } = makeCanvas(size);
  const { canvas: aC, ctx: aCtx } = makeCanvas(size);
  aCtx.fillStyle = '#000000';
  aCtx.fillRect(0, 0, size, size);

  const drawLeaf = (
    c: Ctx2D,
    x: number,
    y: number,
    len: number,
    ang: number,
    fill: string,
  ): void => {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(len * 0.42, -len * 0.3, len, 0);
    c.quadraticCurveTo(len * 0.42, len * 0.3, 0, 0);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    c.restore();
  };

  const cx = size / 2;
  const cy = size / 2;
  for (let i = 0; i < 34; i++) {
    const a = rng.range(0, Math.PI * 2);
    const rad = rng.range(0, size * 0.42) * Math.sqrt(rng.next());
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad * 0.8;
    const len = rng.range(size * 0.1, size * 0.22);
    const ang = rng.range(0, Math.PI * 2);
    const shade = rng.range(0.55, 1.05);
    const g = Math.round(110 * shade);
    const r = Math.round(66 * shade);
    const b = Math.round(46 * shade);
    drawLeaf(ctx, x, y, len, ang, `rgb(${r},${g},${b})`);
    drawLeaf(aCtx, x, y, len, ang, '#ffffff');
  }
  return {
    map: toTexture(cC, { srgb: true }),
    alphaMap: toTexture(aC),
  };
}

/** Soft-edged rectangle used for the shaft of window light on the bench. */
export function makeSoftRectTexture(size = 128): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.52);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.78)');
  g.addColorStop(0.85, 'rgba(255,255,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = toTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** Coarse woven basketry, alpha-tested like the harvest net. */
export function makeWeaveMaps(size: number, seed: number): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
} {
  const noise = makeValueNoise2D(seed);
  const { canvas: cC, ctx } = makeCanvas(size);
  const height = new Float32Array(size * size);
  const rows = 14;
  const step = size / rows;
  ctx.fillStyle = '#8b6b41';
  ctx.fillRect(0, 0, size, size);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < rows; c++) {
      const over = (r + c) % 2 === 0;
      const x = c * step;
      const y = r * step;
      const shade = 0.75 + fbm2D(noise, c * 0.6, r * 0.6, 2) * 0.5;
      const base = over ? 190 : 140;
      const g = ctx.createLinearGradient(x, y, over ? x : x + step, over ? y + step : y);
      g.addColorStop(0, `rgb(${Math.round(base * 0.55 * shade)},${Math.round(base * 0.42 * shade)},${Math.round(base * 0.26 * shade)})`);
      g.addColorStop(0.5, `rgb(${Math.round(base * shade)},${Math.round(base * 0.78 * shade)},${Math.round(base * 0.5 * shade)})`);
      g.addColorStop(1, `rgb(${Math.round(base * 0.5 * shade)},${Math.round(base * 0.38 * shade)},${Math.round(base * 0.24 * shade)})`);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, step, step);
      for (let py = 0; py < step; py++) {
        for (let px = 0; px < step; px++) {
          const ix = Math.min(size - 1, Math.floor(x + px));
          const iy = Math.min(size - 1, Math.floor(y + py));
          const t = over ? py / step : px / step;
          height[iy * size + ix] = Math.sin(t * Math.PI) * (over ? 1 : 0.6);
        }
      }
    }
  }
  return {
    map: toTexture(cC, { srgb: true }),
    normalMap: toTexture(heightToNormal(height, size, size * 0.02)),
  };
}
