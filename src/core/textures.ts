import * as THREE from 'three';
import { clamp01, lerp } from './math';

/**
 * Every surface in this game is generated at runtime on a 2D canvas, so the
 * build ships with no binary texture payload and stays inside a small mobile
 * download. Each Hero Material gets its own colour / roughness / normal set:
 * iron-rich red soil, coarse cassava periderm, lignified stem, scuffed steel
 * lifter, mud-caked rubber boot.
 */

type Ctx = CanvasRenderingContext2D;

function makeCanvas(size: number): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas unavailable');
  return { canvas, ctx };
}

/* ------------------------------------------------------------------ */
/* tileable noise                                                      */
/* ------------------------------------------------------------------ */

function ihash(x: number, y: number, period: number, seed: number): number {
  const xi = ((x % period) + period) % period;
  const yi = ((y % period) + period) % period;
  const s = Math.sin(xi * 127.1 + yi * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function tileValue(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = ihash(xi, yi, period, seed);
  const b = ihash(xi + 1, yi, period, seed);
  const c = ihash(xi, yi + 1, period, seed);
  const d = ihash(xi + 1, yi + 1, period, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

/** Seamless fbm over a unit square (u,v in 0..1). */
export function tileFbm(u: number, v: number, basePeriod: number, octaves: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let period = basePeriod;
  for (let i = 0; i < octaves; i++) {
    sum += tileValue(u * period, v * period, period, seed + i * 13) * amp;
    norm += amp;
    amp *= 0.52;
    period *= 2;
  }
  return sum / norm;
}

/* ------------------------------------------------------------------ */
/* height -> normal                                                    */
/* ------------------------------------------------------------------ */

function heightToNormalTexture(height: Float32Array, size: number, strength: number): THREE.Texture {
  const { canvas, ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const at = (x: number, y: number): number => height[(((y % size) + size) % size) * size + (((x % size) + size) % size)]!;
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
  return finish(canvas, THREE.LinearSRGBColorSpace);
}

function finish(canvas: HTMLCanvasElement, space: THREE.ColorSpace): THREE.Texture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = space;
  tex.needsUpdate = true;
  return tex;
}

function writeGrayscale(size: number, fn: (u: number, v: number) => number): THREE.Texture {
  const { canvas, ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const value = clamp01(fn((x + 0.5) / size, (y + 0.5) / size)) * 255;
      const i = (y * size + x) * 4;
      img.data[i] = value;
      img.data[i + 1] = value;
      img.data[i + 2] = value;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(canvas, THREE.LinearSRGBColorSpace);
}

function writeColor(size: number, fn: (u: number, v: number) => [number, number, number]): THREE.Texture {
  const { canvas, ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = fn((x + 0.5) / size, (y + 0.5) / size);
      const i = (y * size + x) * 4;
      img.data[i] = clamp01(r) * 255;
      img.data[i + 1] = clamp01(g) * 255;
      img.data[i + 2] = clamp01(b) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(canvas, THREE.SRGBColorSpace);
}

function heightField(size: number, fn: (u: number, v: number) => number): Float32Array {
  const data = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      data[y * size + x] = fn((x + 0.5) / size, (y + 0.5) / size);
    }
  }
  return data;
}

export interface MaterialMaps {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

/* ------------------------------------------------------------------ */
/* soil                                                                */
/* ------------------------------------------------------------------ */

export type SoilKind = 'ferralitic' | 'sandy';

interface SoilPalette {
  /** Dry dust film sitting on top. */
  dry: [number, number, number];
  /** Slightly moist aggregate underneath. */
  moist: [number, number, number];
  grit: [number, number, number];
}

export const SOIL_PALETTES: Record<SoilKind, SoilPalette> = {
  // Iron-rich red-brown ferralitic soil.
  ferralitic: {
    dry: [0.62, 0.40, 0.29],
    moist: [0.36, 0.20, 0.13],
    grit: [0.47, 0.33, 0.25],
  },
  // Paler, coarser sandy loam.
  sandy: {
    dry: [0.69, 0.56, 0.40],
    moist: [0.46, 0.35, 0.24],
    grit: [0.76, 0.66, 0.52],
  },
};

export function soilMaps(size: number, kind: SoilKind): MaterialMaps {
  const pal = SOIL_PALETTES[kind];
  const gritScale = kind === 'sandy' ? 34 : 22;

  const map = writeColor(size, (u, v) => {
    const clods = tileFbm(u, v, 5, 4, 11);
    const grit = tileFbm(u, v, gritScale, 3, 27);
    const dust = clamp01(tileFbm(u, v, 9, 3, 41) * 1.25 - 0.1);
    // Dry powder film covers the raised aggregate; hollows keep moisture.
    const wetness = clamp01(0.72 - clods * 0.9 + grit * 0.15);
    const out: [number, number, number] = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const base = lerp(pal.dry[c]!, pal.moist[c]!, wetness);
      const withGrit = lerp(base, pal.grit[c]!, clamp01(grit - 0.55) * 0.9);
      out[c] = withGrit * lerp(0.86, 1.1, dust);
    }
    return out;
  });

  const heights = heightField(size, (u, v) => {
    const clods = tileFbm(u, v, 5, 4, 11);
    const grit = tileFbm(u, v, gritScale, 3, 27);
    return clods * 0.75 + grit * 0.25;
  });
  const normalMap = heightToNormalTexture(heights, size, kind === 'sandy' ? 2.4 : 3.4);

  const roughnessMap = writeGrayscale(size, (u, v) => {
    const clods = tileFbm(u, v, 5, 4, 11);
    // Dry raised dust is very rough; damp hollows read a touch smoother.
    return lerp(0.72, 0.99, clamp01(clods * 1.2));
  });

  return { map, normalMap, roughnessMap };
}

/* ------------------------------------------------------------------ */
/* cassava storage-root periderm                                       */
/* ------------------------------------------------------------------ */

/**
 * u wraps around the root's circumference, v runs along its length, so the
 * transverse skin striations are drawn as bands along v.
 */
export function rootSkinMaps(size: number): MaterialMaps {
  const striate = (u: number, v: number): number => {
    // Rings around the root, wobbled so they never read as machined grooves.
    const wob = tileFbm(u, v * 0.6, 4, 3, 5) * 0.06;
    const band = Math.sin((v + wob) * Math.PI * 2 * 26 + tileFbm(u, v, 3, 2, 9) * 3);
    return band * 0.5 + 0.5;
  };

  const map = writeColor(size, (u, v) => {
    const rings = striate(u, v);
    const patch = tileFbm(u, v, 6, 4, 17);
    const lenticel = clamp01(tileFbm(u * 3, v * 3, 26, 2, 33) - 0.62) * 3;
    // Pale tan periderm, darker where soil-stained, near-white at scuffs.
    const base: [number, number, number] = [0.74, 0.62, 0.46];
    const dark: [number, number, number] = [0.42, 0.31, 0.21];
    const pale: [number, number, number] = [0.87, 0.79, 0.65];
    const out: [number, number, number] = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      let col = lerp(base[c]!, dark[c]!, clamp01(patch * 0.85 - 0.12));
      col = lerp(col, pale[c]!, clamp01(rings - 0.72) * 0.8);
      col = lerp(col, dark[c]! * 0.7, lenticel * 0.5);
      out[c] = col;
    }
    return out;
  });

  const heights = heightField(size, (u, v) => {
    const rings = striate(u, v);
    const patch = tileFbm(u, v, 8, 3, 17);
    const lenticel = clamp01(tileFbm(u * 3, v * 3, 26, 2, 33) - 0.62) * 3;
    return rings * 0.42 + patch * 0.42 - lenticel * 0.25;
  });
  const normalMap = heightToNormalTexture(heights, size, 2.6);

  const roughnessMap = writeGrayscale(size, (u, v) => {
    const patch = tileFbm(u, v, 6, 4, 17);
    // Freshly-lifted roots: damp film in the low spots, chalky dry ridges.
    return lerp(0.55, 0.95, clamp01(patch * 1.15));
  });

  return { map, normalMap, roughnessMap };
}

/** Thin clay film pressed onto the root skin — used as a second blended coat. */
export function mudFilmMaps(size: number, kind: SoilKind): MaterialMaps {
  const pal = SOIL_PALETTES[kind];
  const map = writeColor(size, (u, v) => {
    const n = tileFbm(u, v, 7, 4, 63);
    const g = tileFbm(u, v, 24, 3, 71);
    return [
      lerp(pal.moist[0]!, pal.dry[0]!, n) * lerp(0.9, 1.08, g),
      lerp(pal.moist[1]!, pal.dry[1]!, n) * lerp(0.9, 1.08, g),
      lerp(pal.moist[2]!, pal.dry[2]!, n) * lerp(0.9, 1.08, g),
    ];
  });
  const heights = heightField(size, (u, v) => tileFbm(u, v, 7, 4, 63) * 0.7 + tileFbm(u, v, 24, 3, 71) * 0.3);
  return {
    map,
    normalMap: heightToNormalTexture(heights, size, 2.8),
    roughnessMap: writeGrayscale(size, (u, v) => lerp(0.6, 0.97, tileFbm(u, v, 7, 4, 63))),
  };
}

/** Alpha mask deciding where mud clings; never left/right symmetric. */
export function mudMask(size: number, seed: number): THREE.Texture {
  return writeGrayscale(size, (u, v) => {
    const n = tileFbm(u + seed * 0.31, v + seed * 0.77, 4, 4, 90 + seed);
    const streak = tileFbm(u * 0.5 + seed, v * 2.4, 6, 3, 120 + seed);
    return clamp01((n * 0.7 + streak * 0.5 - 0.42) * 2.6);
  });
}

/* ------------------------------------------------------------------ */
/* lignified stem                                                      */
/* ------------------------------------------------------------------ */

export function stemBarkMaps(size: number): MaterialMaps {
  // v runs from the soil line (0) to the cut face (1).
  const map = writeColor(size, (u, v) => {
    const grain = tileFbm(u * 6, v * 0.8, 20, 3, 3);
    const blotch = tileFbm(u, v, 5, 4, 19);
    // Green-brown lignified bark, darkening and greying at the soil line.
    const bark: [number, number, number] = [0.42, 0.34, 0.24];
    const light: [number, number, number] = [0.56, 0.48, 0.36];
    const soilStain: [number, number, number] = [0.26, 0.18, 0.13];
    const soilLine = clamp01(1 - v * 4.2);
    const out: [number, number, number] = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      let col = lerp(bark[c]!, light[c]!, clamp01(grain * 1.1 - 0.15));
      col = lerp(col, bark[c]! * 0.7, clamp01(blotch - 0.55) * 1.4);
      col = lerp(col, soilStain[c]!, soilLine * 0.75);
      out[c] = col;
    }
    return out;
  });

  const heights = heightField(size, (u, v) => {
    const grain = tileFbm(u * 6, v * 0.8, 20, 3, 3);
    const blotch = tileFbm(u, v, 5, 4, 19);
    return grain * 0.55 + blotch * 0.45;
  });

  return {
    map,
    normalMap: heightToNormalTexture(heights, size, 2.2),
    roughnessMap: writeGrayscale(size, (u, v) => lerp(0.62, 0.93, tileFbm(u, v, 5, 4, 19))),
  };
}

/** Freshly cut top face of the stem: pith, cambium ring, dry bark edge. */
export function stemCutFaceMap(size: number): THREE.Texture {
  return writeColor(size, (u, v) => {
    const dx = u - 0.5;
    const dy = v - 0.5;
    const r = Math.hypot(dx, dy) * 2;
    const ang = Math.atan2(dy, dx);
    const wobble = tileFbm(Math.cos(ang) * 0.5 + 0.5, Math.sin(ang) * 0.5 + 0.5, 6, 3, 55) * 0.08;
    const rr = r + wobble;
    const pith: [number, number, number] = [0.72, 0.66, 0.50];
    const wood: [number, number, number] = [0.60, 0.48, 0.33];
    const cambium: [number, number, number] = [0.38, 0.42, 0.24];
    const barkEdge: [number, number, number] = [0.30, 0.24, 0.17];
    let out: [number, number, number];
    if (rr < 0.22) out = pith;
    else if (rr < 0.78) {
      const t = (rr - 0.22) / 0.56;
      out = [lerp(pith[0], wood[0], t), lerp(pith[1], wood[1], t), lerp(pith[2], wood[2], t)];
    } else if (rr < 0.9) out = cambium;
    else out = barkEdge;
    const fibre = tileFbm(u * 2, v * 2, 30, 2, 61);
    return [out[0] * lerp(0.88, 1.1, fibre), out[1] * lerp(0.88, 1.1, fibre), out[2] * lerp(0.88, 1.1, fibre)];
  });
}

/* ------------------------------------------------------------------ */
/* steel — differentiated wear per part                                */
/* ------------------------------------------------------------------ */

export type SteelWear = 'handle' | 'fulcrum' | 'jaw' | 'pooled';

/**
 * The lifter must never read as one uniform black or chrome part. Each zone
 * gets its own history: the grip is polished by hands, the fulcrum foot is
 * abraded by soil, the jaw interior is bruised by stems, and the water-holding
 * hollows carry real corrosion.
 */
export function steelMaps(size: number, wear: SteelWear): MaterialMaps {
  const rust: [number, number, number] = [0.46, 0.25, 0.12];
  const steel: [number, number, number] = [0.52, 0.51, 0.50];
  const polished: [number, number, number] = [0.72, 0.72, 0.73];
  const scuff: [number, number, number] = [0.60, 0.57, 0.53];

  const rustAmount = wear === 'pooled' ? 0.85 : wear === 'jaw' ? 0.42 : wear === 'fulcrum' ? 0.32 : 0.16;
  const polishAmount = wear === 'handle' ? 0.7 : wear === 'fulcrum' ? 0.5 : 0.2;
  const seed = wear === 'handle' ? 7 : wear === 'fulcrum' ? 23 : wear === 'jaw' ? 47 : 91;

  const map = writeColor(size, (u, v) => {
    const corrode = tileFbm(u, v, 6, 4, seed);
    const speck = tileFbm(u, v, 26, 3, seed + 5);
    const wearBand = wear === 'handle' ? clamp01(1 - Math.abs(v - 0.5) * 2.6) : tileFbm(u, v, 3, 2, seed + 9);
    const out: [number, number, number] = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      let col = steel[c]!;
      col = lerp(col, rust[c]!, clamp01(corrode * 1.4 - 0.45) * rustAmount);
      col = lerp(col, rust[c]! * 0.75, clamp01(speck - 0.72) * rustAmount * 1.6);
      col = lerp(col, polished[c]!, clamp01(wearBand - 0.35) * polishAmount);
      col = lerp(col, scuff[c]!, clamp01(speck * 0.8 - 0.5) * 0.5);
      out[c] = col;
    }
    return out;
  });

  const heights = heightField(size, (u, v) => {
    const corrode = tileFbm(u, v, 6, 4, seed);
    const speck = tileFbm(u, v, 26, 3, seed + 5);
    return corrode * 0.6 * rustAmount + speck * 0.4;
  });

  const roughnessMap = writeGrayscale(size, (u, v) => {
    const corrode = tileFbm(u, v, 6, 4, seed);
    const wearBand = wear === 'handle' ? clamp01(1 - Math.abs(v - 0.5) * 2.6) : tileFbm(u, v, 3, 2, seed + 9);
    let r = 0.62;
    r = lerp(r, 0.95, clamp01(corrode * 1.4 - 0.45) * rustAmount);
    r = lerp(r, 0.28, clamp01(wearBand - 0.35) * polishAmount);
    return r;
  });

  return { map, normalMap: heightToNormalTexture(heights, size, 1.8), roughnessMap };
}

export function steelMetalnessMap(size: number, wear: SteelWear): THREE.Texture {
  const rustAmount = wear === 'pooled' ? 0.85 : wear === 'jaw' ? 0.42 : wear === 'fulcrum' ? 0.32 : 0.16;
  const seed = wear === 'handle' ? 7 : wear === 'fulcrum' ? 23 : wear === 'jaw' ? 47 : 91;
  return writeGrayscale(size, (u, v) => {
    const corrode = tileFbm(u, v, 6, 4, seed);
    // Corrosion products are not metallic.
    return lerp(0.88, 0.08, clamp01(corrode * 1.4 - 0.45) * rustAmount);
  });
}

/* ------------------------------------------------------------------ */
/* mud-caked rubber boot                                               */
/* ------------------------------------------------------------------ */

export function bootMaps(size: number, kind: SoilKind): MaterialMaps {
  const pal = SOIL_PALETTES[kind];
  const map = writeColor(size, (u, v) => {
    const splat = tileFbm(u, v, 5, 4, 131);
    const grime = tileFbm(u, v, 18, 3, 137);
    // Dark green rubber, buried under mud that climbs from the sole upward.
    const rubber: [number, number, number] = [0.10, 0.13, 0.11];
    const climb = clamp01(1 - v * 1.7);
    const mudCover = clamp01(climb * 1.2 + splat * 0.5 - 0.35);
    const out: [number, number, number] = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const mud = lerp(pal.moist[c]!, pal.dry[c]!, grime);
      out[c] = lerp(rubber[c]!, mud, mudCover);
    }
    return out;
  });
  const heights = heightField(size, (u, v) => tileFbm(u, v, 5, 4, 131) * 0.7 + tileFbm(u, v, 18, 3, 137) * 0.3);
  return {
    map,
    normalMap: heightToNormalTexture(heights, size, 2.0),
    roughnessMap: writeGrayscale(size, (_u, v) => {
      const climb = clamp01(1 - v * 1.7);
      return lerp(0.5, 0.95, climb);
    }),
  };
}

/* ------------------------------------------------------------------ */
/* foliage + misc                                                      */
/* ------------------------------------------------------------------ */

/** Palmate cassava leaf silhouette used on billboards and mid-ground plants. */
export function cassavaLeafTexture(size: number): { map: THREE.Texture; alphaMap: THREE.Texture } {
  const { canvas, ctx } = makeCanvas(size);
  ctx.clearRect(0, 0, size, size);
  const lobes = 7;
  const cx = size * 0.5;
  const cy = size * 0.93;
  for (let i = 0; i < lobes; i++) {
    const t = i / (lobes - 1);
    const ang = lerp(-1.30, 1.30, t) - Math.PI / 2;
    const len = size * (0.84 - Math.abs(t - 0.5) * 0.40);
    // Cassava lobes are lanceolate: broad through the middle, not needles.
    const wide = size * (0.150 - Math.abs(t - 0.5) * 0.055);
    const g = ctx.createLinearGradient(cx, cy, cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
    g.addColorStop(0, '#3d5a24');
    g.addColorStop(0.55, '#4f7130');
    g.addColorStop(1, '#5f8339');
    ctx.fillStyle = g;
    ctx.beginPath();
    const tipX = cx + Math.cos(ang) * len;
    const tipY = cy + Math.sin(ang) * len;
    const midX = cx + Math.cos(ang) * len * 0.45;
    const midY = cy + Math.sin(ang) * len * 0.45;
    const nx = Math.cos(ang + Math.PI / 2);
    const ny = Math.sin(ang + Math.PI / 2);
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(midX + nx * wide, midY + ny * wide, tipX, tipY);
    ctx.quadraticCurveTo(midX - nx * wide, midY - ny * wide, cx, cy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,62,26,0.42)';
    ctx.lineWidth = Math.max(1, size / 220);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
  }
  // petiole
  ctx.strokeStyle = '#7c4a2c';
  ctx.lineWidth = Math.max(2, size / 90);
  ctx.beginPath();
  ctx.moveTo(cx, size);
  ctx.lineTo(cx, cy);
  ctx.stroke();

  const map = finish(canvas, THREE.SRGBColorSpace);
  const data = ctx.getImageData(0, 0, size, size);
  const { canvas: aCanvas, ctx: aCtx } = makeCanvas(size);
  const aImg = aCtx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const a = data.data[i * 4 + 3]!;
    aImg.data[i * 4] = a;
    aImg.data[i * 4 + 1] = a;
    aImg.data[i * 4 + 2] = a;
    aImg.data[i * 4 + 3] = 255;
  }
  aCtx.putImageData(aImg, 0, 0);
  const alphaMap = finish(aCanvas, THREE.LinearSRGBColorSpace);
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  alphaMap.wrapS = alphaMap.wrapT = THREE.ClampToEdgeWrapping;
  return { map, alphaMap };
}

/** Woven basket weave. */
export function basketMaps(size: number): MaterialMaps {
  const map = writeColor(size, (u, v) => {
    const weaveU = Math.sin(u * Math.PI * 2 * 18);
    const weaveV = Math.sin(v * Math.PI * 2 * 11);
    const over = weaveU * weaveV > 0 ? 1 : 0;
    const fibre = tileFbm(u * 2, v * 2, 30, 2, 77);
    const light: [number, number, number] = [0.60, 0.46, 0.27];
    const dark: [number, number, number] = [0.38, 0.28, 0.16];
    const t = over * 0.7 + fibre * 0.3;
    return [lerp(dark[0], light[0], t), lerp(dark[1], light[1], t), lerp(dark[2], light[2], t)];
  });
  const heights = heightField(size, (u, v) => {
    const weaveU = Math.sin(u * Math.PI * 2 * 18);
    const weaveV = Math.sin(v * Math.PI * 2 * 11);
    return (weaveU * weaveV > 0 ? 0.75 : 0.25) + tileFbm(u * 2, v * 2, 30, 2, 77) * 0.2;
  });
  return {
    map,
    normalMap: heightToNormalTexture(heights, size, 2.4),
    roughnessMap: writeGrayscale(size, () => 0.86),
  };
}

/** Soft round alpha for falling grains and contact shadows. */
export function radialAlpha(size: number, power = 2.2): THREE.Texture {
  return writeGrayscale(size, (u, v) => {
    const r = Math.hypot(u - 0.5, v - 0.5) * 2;
    return Math.pow(Math.max(0, 1 - r), power);
  });
}

const cache = new Map<string, unknown>();
export function cached<T>(key: string, make: () => T): T {
  const hit = cache.get(key);
  if (hit !== undefined) return hit as T;
  const value = make();
  cache.set(key, value);
  return value;
}

/**
 * Maps are cached and shared between materials, so every consumer gets its own
 * lightweight clone: the GPU image stays shared while repeat/offset stay local.
 */
export function applyMaps(
  material: THREE.MeshStandardMaterial,
  maps: MaterialMaps,
  repeat: THREE.Vector2,
  anisotropy: number,
): void {
  const prep = (tex: THREE.Texture): THREE.Texture => {
    const copy = tex.clone();
    copy.repeat.copy(repeat);
    copy.anisotropy = anisotropy;
    copy.needsUpdate = true;
    return copy;
  };
  material.map = prep(maps.map);
  material.normalMap = prep(maps.normalMap);
  material.roughnessMap = prep(maps.roughnessMap);
  material.needsUpdate = true;
}
