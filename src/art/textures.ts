import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three/webgpu';
import { clamp01, fbm2, valueNoise2 } from '../core/mathx';

/**
 * Every texture in the game is painted here at boot. That keeps the download to
 * the JS bundle alone (no KTX2/Basis payload to ship or decode on a phone), and
 * the budget goes where the eye goes: the four hero materials.
 */

function canvas(size: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  return { c, g };
}

function finish(c: HTMLCanvasElement, srgb: boolean, repeat = 1): Texture {
  const t = new CanvasTexture(c);
  t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** Sobel a height field into a tangent-space normal map. */
function heightToNormal(height: Float32Array, size: number, strength: number): HTMLCanvasElement {
  const { c, g } = canvas(size);
  const img = g.createImageData(size, size);
  const at = (x: number, y: number): number =>
    height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx =
        at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy =
        at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      let nx = -dx * strength;
      let ny = -dy * strength;
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
  g.putImageData(img, 0, 0);
  return c;
}

function grayCanvas(values: Float32Array, size: number): HTMLCanvasElement {
  const { c, g } = canvas(size);
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = clamp01(values[i]) * 255;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export interface MaterialMaps {
  map: Texture;
  roughnessMap: Texture;
  normalMap: Texture;
}

// --------------------------------------------------------------- hero 1: velvet

/**
 * Heavy red stage velvet: a vertical warp, hand-sewn seams every ~90cm, worn
 * fuzz along the hem, and a nap that changes brightness with the weave.
 */
export function makeCurtainMaps(size: number, hue = 0): MaterialMaps {
  const { c, g } = canvas(size);
  const img = g.createImageData(size, size);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  // Two hand-sewn seams per tile; a tile covers ~1.8m of cloth.
  const seamAt = [0.24, 0.74];
  // Thread counts are kept well under Nyquist for this map size: at real
  // viewing distance a velvet weave is felt through the normal map, not seen
  // in the albedo, and putting it in the albedo just buys shimmer.
  const warpFreq = Math.PI * 2 * 64;
  const weftFreq = Math.PI * 2 * 78;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const i = y * size + x;

      const warp = Math.sin(u * warpFreq) * 0.5 + 0.5;
      const weft = Math.sin(v * weftFreq + warp * 0.6) * 0.5 + 0.5;
      const fuzz = fbm2(u * 46, v * 46, 3);
      // The nap: broad, soft brightness drifts, which is what velvet actually
      // looks like from two metres away.
      const nap = fbm2(u * 7, v * 3.5, 4);
      const drape = fbm2(u * 2.4 + 5, v * 1.6, 3);

      let h = warp * 0.11 + weft * 0.06 + fuzz * 0.22 + nap * 0.4;

      let seam = 0;
      for (const s of seamAt) {
        const d = Math.abs(u - s);
        if (d < 0.014) seam = Math.max(seam, 1 - d / 0.014);
      }
      h += seam * 0.5;

      // Worn, slightly bleached hem at the very bottom of the cloth.
      const hem = clamp01((v - 0.93) / 0.07);

      let shade = 0.74 + nap * 0.36 + drape * 0.2 + fuzz * 0.05;
      shade *= 1 - seam * 0.16;
      shade *= 1 - hem * 0.1;

      // Deep, slightly cool-shadowed crimson; hue lets later rounds re-dress it.
      const r = clamp01((0.3 + hue * 0.025) * shade + 0.022);
      const gg = clamp01(0.038 * shade + 0.006);
      const b = clamp01((0.05 - hue * 0.006) * shade + 0.01);

      const o = i * 4;
      img.data[o] = Math.pow(r, 1 / 2.2) * 255;
      img.data[o + 1] = Math.pow(gg, 1 / 2.2) * 255;
      img.data[o + 2] = Math.pow(b, 1 / 2.2) * 255;
      img.data[o + 3] = 255;

      height[i] = h;
      // Velvet is uniformly matte; the seams and the fuzz break it up a little.
      rough[i] = clamp01(0.84 - nap * 0.08 + fuzz * 0.05 - seam * 0.06);
    }
  }
  g.putImageData(img, 0, 0);

  return {
    map: finish(c, true),
    roughnessMap: finish(grayCanvas(rough, size), false),
    normalMap: finish(heightToNormal(height, size, 0.5), false),
  };
}

// ------------------------------------------------------- hero 2: waxed wood deck

/**
 * A kindergarten stage deck: narrow varnished boards, decades of shoe scuff,
 * and enough wax left for the spotlights to smear across it.
 */
export function makeStageFloorMaps(size: number): MaterialMaps {
  const { c, g } = canvas(size);
  const img = g.createImageData(size, size);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  const planks = 9; // one tile == 1.35m, so boards land near 15cm
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const i = y * size + x;

      const pf = u * planks;
      const plank = Math.floor(pf);
      const inPlank = pf - plank;
      const jitter = valueNoise2(plank * 7.3, 3.1);

      // Long grain running down the board, with the odd knot.
      const grain =
        fbm2(u * planks * 3.1 + jitter * 40, v * 26 + jitter * 12, 4) * 0.75 +
        Math.sin(v * 90 + jitter * 20 + fbm2(u * 60, v * 6, 2) * 9) * 0.12;

      // Groove between boards.
      const edge = Math.min(inPlank, 1 - inPlank);
      const groove = clamp01(1 - edge / 0.035);

      // End joints, staggered per board.
      const seg = Math.floor(v * 2.5 + jitter * 3);
      const segLocal = (v * 2.5 + jitter * 3) - seg;
      const joint = clamp01(1 - Math.min(segLocal, 1 - segLocal) / 0.02);

      // Traffic: scuffed arcs where a hundred children have turned.
      const scuff = clamp01(fbm2(u * 6 + 11, v * 6 + 4, 3) * 1.6 - 0.72);

      const base = 0.235 + grain * 0.17 + jitter * 0.05;
      let shade = base * (1 - groove * 0.55) * (1 - joint * 0.4);
      shade = clamp01(shade + scuff * 0.05);

      const r = clamp01(shade * 1.16 + 0.035);
      const gg = clamp01(shade * 0.80 + 0.022);
      const b = clamp01(shade * 0.47 + 0.014);

      const o = i * 4;
      img.data[o] = Math.pow(r, 1 / 2.2) * 255;
      img.data[o + 1] = Math.pow(gg, 1 / 2.2) * 255;
      img.data[o + 2] = Math.pow(b, 1 / 2.2) * 255;
      img.data[o + 3] = 255;

      height[i] = grain * 0.18 - groove * 0.9 - joint * 0.6;
      // Wax is glossy; scuffed lanes and the grooves are not.
      rough[i] = clamp01(0.2 + scuff * 0.45 + groove * 0.35 + joint * 0.2 + grain * 0.06);
    }
  }
  g.putImageData(img, 0, 0);

  return {
    map: finish(c, true),
    roughnessMap: finish(grayCanvas(rough, size), false),
    normalMap: finish(heightToNormal(height, size, 0.9), false),
  };
}

// --------------------------------------------------- hero 3: costume fabrics

/** Shiny satin: the cape/skirt half of a home-made kindergarten costume. */
export function makeSatinMaps(size: number, rgb: [number, number, number]): MaterialMaps {
  const { c, g } = canvas(size);
  const img = g.createImageData(size, size);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const i = y * size + x;
      // Fine diagonal satin float plus soft drape folds.
      const float = Math.sin((u * 0.7 + v * 1.3) * 170) * 0.5 + 0.5;
      const fold = fbm2(u * 5, v * 3.5, 3);
      const shade = 0.72 + float * 0.16 + fold * 0.34;

      const o = i * 4;
      img.data[o] = Math.pow(clamp01(rgb[0] * shade), 1 / 2.2) * 255;
      img.data[o + 1] = Math.pow(clamp01(rgb[1] * shade), 1 / 2.2) * 255;
      img.data[o + 2] = Math.pow(clamp01(rgb[2] * shade), 1 / 2.2) * 255;
      img.data[o + 3] = 255;

      height[i] = float * 0.05 + fold * 0.95;
      rough[i] = clamp01(0.26 + fold * 0.16 - float * 0.08);
    }
  }
  g.putImageData(img, 0, 0);
  return {
    map: finish(c, true),
    roughnessMap: finish(grayCanvas(rough, size), false),
    normalMap: finish(heightToNormal(height, size, 0.35), false),
  };
}

/** Non-woven (不織布) - the crinkly craft fabric every 発表会 costume is made of. */
export function makeNonwovenMaps(size: number, rgb: [number, number, number]): MaterialMaps {
  const { c, g } = canvas(size);
  const img = g.createImageData(size, size);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const i = y * size + x;
      const fibre = fbm2(u * 120, v * 120, 3);
      const emboss = (Math.sin(u * 150) * 0.5 + 0.5) * (Math.sin(v * 150) * 0.5 + 0.5);
      const crinkle = fbm2(u * 14, v * 14, 3);
      const shade = 0.78 + fibre * 0.18 + emboss * 0.1 + crinkle * 0.16;

      const o = i * 4;
      img.data[o] = Math.pow(clamp01(rgb[0] * shade), 1 / 2.2) * 255;
      img.data[o + 1] = Math.pow(clamp01(rgb[1] * shade), 1 / 2.2) * 255;
      img.data[o + 2] = Math.pow(clamp01(rgb[2] * shade), 1 / 2.2) * 255;
      img.data[o + 3] = 255;

      height[i] = fibre * 0.28 + emboss * 0.22 + crinkle * 0.4;
      rough[i] = clamp01(0.82 + fibre * 0.1 - emboss * 0.05);
    }
  }
  g.putImageData(img, 0, 0);
  return {
    map: finish(c, true),
    roughnessMap: finish(grayCanvas(rough, size), false),
    normalMap: finish(heightToNormal(height, size, 0.45), false),
  };
}

// -------------------------------------------------------------- support maps

/** Painted plywood / lauan flats and hall walls. */
export function makeWallMaps(size: number, rgb: [number, number, number]): MaterialMaps {
  const { c, g } = canvas(size);
  const img = g.createImageData(size, size);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const i = y * size + x;
      const stipple = fbm2(u * 80, v * 80, 3);
      const patch = fbm2(u * 4, v * 4, 3);
      const shade = 0.8 + stipple * 0.18 + patch * 0.16;
      const o = i * 4;
      img.data[o] = Math.pow(clamp01(rgb[0] * shade), 1 / 2.2) * 255;
      img.data[o + 1] = Math.pow(clamp01(rgb[1] * shade), 1 / 2.2) * 255;
      img.data[o + 2] = Math.pow(clamp01(rgb[2] * shade), 1 / 2.2) * 255;
      img.data[o + 3] = 255;
      height[i] = stipple * 0.6 + patch * 0.4;
      rough[i] = clamp01(0.85 + stipple * 0.1);
    }
  }
  g.putImageData(img, 0, 0);
  return {
    map: finish(c, true),
    roughnessMap: finish(grayCanvas(rough, size), false),
    normalMap: finish(heightToNormal(height, size, 0.35), false),
  };
}

/** Brushed, slightly greasy metal for the lighting bars and fixtures. */
export function makeMetalMaps(size: number): { roughnessMap: Texture; normalMap: Texture } {
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const i = y * size + x;
      const brush = fbm2(u * 260, v * 8, 3);
      const dirt = fbm2(u * 7, v * 7, 3);
      height[i] = brush * 0.7 + dirt * 0.3;
      rough[i] = clamp01(0.26 + brush * 0.22 + dirt * 0.3);
    }
  }
  return {
    roughnessMap: finish(grayCanvas(rough, size), false),
    normalMap: finish(heightToNormal(height, size, 0.5), false),
  };
}

/** Radial falloff sprite, reused for dust motes and lamp glows. */
export function makeGlowTexture(size = 128, softness = 2.2): Texture {
  const { c, g } = canvas(size);
  const img = g.createImageData(size, size);
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - half + 0.5, y - half + 0.5) / half;
      const a = Math.pow(clamp01(1 - d), softness);
      const i = (y * size + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = a * 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Soft-edged vertical gradient used by the fake light shafts. */
export function makeShaftTexture(size = 64): Texture {
  const { c, g } = canvas(size);
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const v = y / (size - 1);
      const radial = Math.pow(1 - Math.abs(u * 2 - 1), 1.6);
      const fall = Math.pow(1 - v, 1.25);
      const i = (y * size + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 244;
      img.data[i + 2] = 222;
      img.data[i + 3] = clamp01(radial * fall) * 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
