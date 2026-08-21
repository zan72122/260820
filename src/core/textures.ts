import * as THREE from 'three';
import { clamp01, fbmField, lerp, makeRng, smoothstep } from './noise';

export interface MapSet {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
}

type PixelFn = (
  x: number,
  y: number,
  u: number,
  v: number,
  out: Float32Array,
) => void; // out = [r,g,b,roughness,height]

let bakedPixels = 0;
export const bakeCost = () => bakedPixels;

function canvasTexture(data: ImageData, colorSpace: THREE.ColorSpace): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = data.width;
  c.height = data.height;
  c.getContext('2d')!.putImageData(data, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = colorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Bakes colour, roughness and a Sobel-derived normal map in a single pixel pass. */
export function bakeMaps(size: number, normalStrength: number, fn: PixelFn): MapSet {
  bakedPixels += size * size;
  const col = new ImageData(size, size);
  const rgh = new ImageData(size, size);
  const nrm = new ImageData(size, size);
  const height = new Float32Array(size * size);
  const scratch = new Float32Array(5);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      scratch[0] = scratch[1] = scratch[2] = 0.5;
      scratch[3] = 0.5;
      scratch[4] = 0.5;
      fn(x, y, x / size, y / size, scratch);
      const i = (y * size + x) * 4;
      col.data[i] = clamp01(scratch[0]) * 255;
      col.data[i + 1] = clamp01(scratch[1]) * 255;
      col.data[i + 2] = clamp01(scratch[2]) * 255;
      col.data[i + 3] = 255;
      const r = clamp01(scratch[3]) * 255;
      rgh.data[i] = r;
      rgh.data[i + 1] = r;
      rgh.data[i + 2] = r;
      rgh.data[i + 3] = 255;
      height[y * size + x] = scratch[4];
    }
  }

  const h = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * normalStrength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * normalStrength;
      let nx = -dx;
      let ny = -dy;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      const i = (y * size + x) * 4;
      nrm.data[i] = (nx * 0.5 + 0.5) * 255;
      nrm.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      nrm.data[i + 2] = (nz / len) * 0.5 * 255 + 127.5;
      nrm.data[i + 3] = 255;
    }
  }

  return {
    map: canvasTexture(col, THREE.SRGBColorSpace),
    roughnessMap: canvasTexture(rgh, THREE.NoColorSpace),
    normalMap: canvasTexture(nrm, THREE.NoColorSpace),
  };
}

const F = (size: number, o: Parameters<typeof fbmField>[1]) => fbmField(size, o);
const sampleF = (f: Float32Array, size: number, x: number, y: number) =>
  f[((y % size) + size) % size * size + (((x % size) + size) % size)];

/* ------------------------------------------------------------------ */
/* Material map recipes                                                */
/* ------------------------------------------------------------------ */

/** Thick sand-cast skin under industrial enamel: coarse lumps, fine porosity, worn edges. */
export function castIronMaps(
  size = 256,
  base: [number, number, number] = [0.245, 0.278, 0.296],
  /** 1 = sand-cast and worn, 0 = smooth painted fabrication */
  cast = 1,
): MapSet {
  const skin = F(size, { seed: 21, baseFreq: 7, octaves: 4, gain: 0.55 });
  const pores = F(size, { seed: 88, baseFreq: 46, octaves: 2, gain: 0.4 });
  const wear = F(size, { seed: 305, baseFreq: 3, octaves: 3 });
  const grime = F(size, { seed: 411, baseFreq: 5, octaves: 4, gain: 0.6 });
  return bakeMaps(size, 3.4, (x, y, _u, _v, out) => {
    const s = sampleF(skin, size, x, y);
    const p = sampleF(pores, size, x, y);
    const w = smoothstep(0.72 + (1 - cast) * 0.24, 0.95 + (1 - cast) * 0.045, sampleF(wear, size, x, y)) * cast;
    const g = sampleF(grime, size, x, y);
    // enamel over iron: desaturated slate teal
    const shade = 1 - cast * 0.18 + s * (0.1 + cast * 0.18) - p * (0.04 + cast * 0.12);
    let r = base[0] * shade;
    let gr = base[1] * shade;
    let b = base[2] * shade;
    // rubbed-through paint reveals warm grey iron with a faint oxide cast
    r = lerp(r, 0.246 + s * 0.05, w);
    gr = lerp(gr, 0.219 + s * 0.04, w);
    b = lerp(b, 0.196 + s * 0.03, w);
    // oily film darkens and gloss-shifts locally
    const oil = smoothstep(0.66, 0.9, g);
    r *= 1 - oil * 0.22;
    gr *= 1 - oil * 0.22;
    b *= 1 - oil * 0.18;
    out[0] = r;
    out[1] = gr;
    out[2] = b;
    out[3] = clamp01(0.62 + s * 0.16 + p * 0.14 - w * 0.24 - oil * 0.2);
    out[4] = (s * 0.75 + p * 0.25) * (0.25 + cast * 0.75);
  });
}

/** Rolled / drawn stainless: reflection follows the machining direction, gloss only where rubbed. */
export function stainlessMaps(size = 256): MapSet {
  const streak = F(size, { seed: 55, baseFreq: 110, octaves: 3, gain: 0.4, stretchV: 26 });
  const broad = F(size, { seed: 91, baseFreq: 6, octaves: 3 });
  const rub = F(size, { seed: 178, baseFreq: 3, octaves: 2, stretchV: 5 });
  return bakeMaps(size, 1.3, (x, y, _u, _v, out) => {
    const s = sampleF(streak, size, x, y);
    const b = sampleF(broad, size, x, y);
    const r = smoothstep(0.6, 0.92, sampleF(rub, size, x, y));
    const tone = 0.74 + s * 0.08 + b * 0.06;
    out[0] = tone * 0.985;
    out[1] = tone * 1.0;
    out[2] = tone * 1.025;
    out[3] = clamp01(0.3 + s * 0.14 + b * 0.06 - r * 0.18);
    out[4] = s * 0.8 + b * 0.2;
  });
}

/** Painted carbon-steel pipe: even enamel, grime collecting low, condensation beads. */
export function paintedPipeMaps(
  base: [number, number, number],
  size = 256,
  wetness = 0.35,
): MapSet {
  const orange = F(size, { seed: 12, baseFreq: 30, octaves: 3, gain: 0.5 });
  const dirt = F(size, { seed: 260, baseFreq: 5, octaves: 4, gain: 0.6 });
  const rng = makeRng(9001);
  const beads: number[] = [];
  const beadCount = Math.round(size * 0.9 * wetness);
  for (let i = 0; i < beadCount; i++) beads.push(rng() * size, rng() * size, 0.9 + rng() * 2.1);
  const beadField = new Float32Array(size * size);
  for (let i = 0; i < beads.length; i += 3) {
    const bx = beads[i];
    const by = beads[i + 1];
    const br = beads[i + 2];
    const r0 = Math.ceil(br) + 1;
    for (let dy = -r0; dy <= r0; dy++) {
      for (let dx = -r0; dx <= r0; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > br) continue;
        const px = (Math.round(bx) + dx + size) % size;
        const py = (Math.round(by) + dy + size) % size;
        const v = Math.sqrt(1 - (d / br) * (d / br));
        beadField[py * size + px] = Math.max(beadField[py * size + px], v);
      }
    }
  }
  return bakeMaps(size, 2.2, (x, y, _u, v, out) => {
    const o = sampleF(orange, size, x, y);
    const d = sampleF(dirt, size, x, y);
    const bead = beadField[y * size + x];
    // grime accumulates on the underside of horizontal runs (high v)
    const low = smoothstep(0.55, 1.0, v);
    const soil = clamp01(smoothstep(0.55, 0.95, d) * (0.35 + low * 0.65));
    const shade = 0.94 + o * 0.1;
    let r = base[0] * shade;
    let g = base[1] * shade;
    let b = base[2] * shade;
    r = lerp(r, 0.17, soil * 0.55);
    g = lerp(g, 0.166, soil * 0.55);
    b = lerp(b, 0.155, soil * 0.5);
    out[0] = r;
    out[1] = g;
    out[2] = b;
    out[3] = clamp01(0.42 + o * 0.16 + soil * 0.3 - bead * 0.34);
    out[4] = o * 0.35 + bead * 0.65;
  });
}

/** Compressed EPDM gasket: matte, faint mould texture, slight bulge. */
export function rubberMaps(size = 128): MapSet {
  const grain = F(size, { seed: 700, baseFreq: 40, octaves: 3, gain: 0.5 });
  const swell = F(size, { seed: 733, baseFreq: 5, octaves: 2 });
  return bakeMaps(size, 1.7, (x, y, _u, _v, out) => {
    const g = sampleF(grain, size, x, y);
    const s = sampleF(swell, size, x, y);
    const tone = 0.052 + g * 0.03 + s * 0.014;
    out[0] = tone;
    out[1] = tone * 1.02;
    out[2] = tone * 1.06;
    out[3] = clamp01(0.86 + g * 0.1 - s * 0.05);
    out[4] = g * 0.4 + s * 0.6;
  });
}

/** Poured concrete: exposed aggregate, form-tie seams, damp patches that read darker + smoother. */
export function concreteMaps(size = 384): MapSet {
  const agg = F(size, { seed: 404, baseFreq: 70, octaves: 3, gain: 0.5 });
  const broad = F(size, { seed: 12, baseFreq: 6, octaves: 4, gain: 0.55 });
  const damp = F(size, { seed: 909, baseFreq: 7, octaves: 3, gain: 0.5 });
  return bakeMaps(size, 2.8, (_x, _y, u, v, out) => {
    const x = Math.round(u * size);
    const y = Math.round(v * size);
    const a = sampleF(agg, size, x, y);
    const b = sampleF(broad, size, x, y);
    const d = smoothstep(0.66, 0.96, sampleF(damp, size, x, y));
    // form-work board seams every 0.25 in v and a vertical panel joint
    const seamV = smoothstep(0.014, 0.0, Math.abs(((v * 4) % 1) - 0.5) - 0.485);
    const seamU = smoothstep(0.012, 0.0, Math.abs(((u * 2) % 1) - 0.5) - 0.487);
    const seam = Math.max(seamV, seamU);
    const grit = smoothstep(0.68, 0.95, a);
    let tone = 0.5 + b * 0.1 + grit * 0.08;
    tone *= 1 - seam * 0.28;
    tone = lerp(tone, tone * 0.88, d);
    out[0] = tone * 1.0;
    out[1] = tone * 0.99;
    out[2] = tone * 0.955;
    out[3] = clamp01(0.9 - grit * 0.06 - d * 0.3 + b * 0.05);
    out[4] = b * 0.4 + grit * 0.45 - seam * 0.5 + 0.2;
  });
}

/** Epoxy plant floor: sealed, scuffed by boots, gloss only where wet. */
export function epoxyFloorMaps(size = 384): MapSet {
  const speck = F(size, { seed: 61, baseFreq: 64, octaves: 2 });
  const broad = F(size, { seed: 145, baseFreq: 5, octaves: 4, gain: 0.55 });
  const wet = F(size, { seed: 777, baseFreq: 5.5, octaves: 3, gain: 0.55 });
  const scuff = F(size, { seed: 313, baseFreq: 26, octaves: 2, stretchU: 7 });
  return bakeMaps(size, 1.1, (_x, _y, u, v, out) => {
    const x = Math.round(u * size);
    const y = Math.round(v * size);
    const s = sampleF(speck, size, x, y);
    const b = sampleF(broad, size, x, y);
    const w = smoothstep(0.62, 0.94, sampleF(wet, size, x, y));
    const sc = smoothstep(0.62, 0.9, sampleF(scuff, size, x, y));
    // industrial sea-green epoxy with a fine quartz broadcast
    let r = 0.212 + b * 0.05 + s * 0.055;
    let g = 0.238 + b * 0.055 + s * 0.055;
    let bl = 0.228 + b * 0.05 + s * 0.055;
    r = lerp(r, r * 1.35, sc * 0.35);
    g = lerp(g, g * 1.3, sc * 0.35);
    bl = lerp(bl, bl * 1.28, sc * 0.35);
    // standing water darkens and mirrors
    r = lerp(r, r * 0.66, w);
    g = lerp(g, g * 0.7, w);
    bl = lerp(bl, bl * 0.78, w);
    out[0] = r;
    out[1] = g;
    out[2] = bl;
    out[3] = clamp01(0.5 + s * 0.1 + sc * 0.14 - w * 0.4);
    out[4] = s * 0.5 + b * 0.5;
  });
}

/** Dry outdoor paving: sawn slabs with open joints and a light broom finish. */
export function pavingMaps(size = 384): MapSet {
  const grit = F(size, { seed: 31, baseFreq: 90, octaves: 2 });
  const broad = F(size, { seed: 77, baseFreq: 9, octaves: 3, gain: 0.5 });
  const stain = F(size, { seed: 512, baseFreq: 4, octaves: 3, gain: 0.5 });
  const broom = F(size, { seed: 640, baseFreq: 64, octaves: 2 });
  return bakeMaps(size, 1.9, (_x, _y, u, v, out) => {
    const x = Math.round(u * size);
    const y = Math.round(v * size);
    const g = sampleF(grit, size, x, y);
    const b = sampleF(broad, size, x, y);
    const st = smoothstep(0.72, 0.99, sampleF(stain, size, x, y));
    const br = sampleF(broom, size, x, y);
    // 4 × 4 slabs per tile, joints ~8 mm wide
    const ju = smoothstep(0.012, 0.0, Math.abs(((u * 4) % 1) - 0.5) - 0.485);
    const jv = smoothstep(0.012, 0.0, Math.abs(((v * 4) % 1) - 0.5) - 0.485);
    const joint = Math.max(ju, jv);
    // each slab gets its own slightly different batch colour
    const slab = ((Math.floor(u * 4) * 7 + Math.floor(v * 4) * 13) % 5) / 5;
    let tone = 0.62 + b * 0.035 + g * 0.03 + slab * 0.022 + br * 0.015;
    tone *= 1 - joint * 0.34;
    tone = lerp(tone, tone * 0.94, st);
    out[0] = tone * 1.0;
    out[1] = tone * 0.985;
    out[2] = tone * 0.94;
    out[3] = clamp01(0.86 - g * 0.05 + joint * 0.08);
    out[4] = b * 0.25 + g * 0.4 + br * 0.15 - joint * 0.7;
  });
}

/** Galvanised / powder-coated sheet for ducting and cladding. */
export function galvanisedMaps(size = 192): MapSet {
  const spangle = F(size, { seed: 848, baseFreq: 18, octaves: 3, gain: 0.55 });
  const dust = F(size, { seed: 219, baseFreq: 4, octaves: 3 });
  return bakeMaps(size, 1.6, (x, y, _u, _v, out) => {
    const s = sampleF(spangle, size, x, y);
    const d = sampleF(dust, size, x, y);
    const tone = 0.45 + s * 0.2 - d * 0.08;
    out[0] = tone * 1.0;
    out[1] = tone * 1.01;
    out[2] = tone * 1.04;
    out[3] = clamp01(0.5 + s * 0.22 + d * 0.14);
    out[4] = s;
  });
}

/** Fine ripple normal used for moving water surfaces (scrolled in the shader). */
export function waterNormalMap(size = 256): THREE.CanvasTexture {
  const a = F(size, { seed: 501, baseFreq: 18, octaves: 4, gain: 0.55 });
  const b = F(size, { seed: 622, baseFreq: 34, octaves: 3, gain: 0.5, stretchV: 2.2 });
  const data = new ImageData(size, size);
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) h[y * size + x] = sampleF(a, size, x, y) * 0.6 + sampleF(b, size, x, y) * 0.4;
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 2.6;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 2.6;
      const len = Math.hypot(-dx, -dy, 1);
      const i = (y * size + x) * 4;
      data.data[i] = (-dx / len) * 127.5 + 127.5;
      data.data[i + 1] = (-dy / len) * 127.5 + 127.5;
      data.data[i + 2] = (1 / len) * 127.5 + 127.5;
      data.data[i + 3] = 255;
    }
  }
  return canvasTexture(data, THREE.NoColorSpace);
}
