// All textures in the shop are baked procedurally at boot: nothing is fetched.
// The detail budget is deliberately lopsided -- the hero objects (painted metal,
// chrome, ice, shaved ice) get the large maps, the room gets the small ones.

import {
  CanvasTexture, RepeatWrapping, SRGBColorSpace, LinearSRGBColorSpace,
  Data3DTexture, RedFormat, RGFormat, LinearFilter, UnsignedByteType, DataTexture,
} from 'three';
import { fbm, fbm2, worley, mulberry32, clamp, smoothstep, mix } from './rand.js';

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function tex(cv, { srgb = false, repeat = 1, aniso = 4 } = {}) {
  const t = new CanvasTexture(cv);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = srgb ? SRGBColorSpace : LinearSRGBColorSpace;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  return t;
}

/**
 * Sobel a height field (Float32Array, size*size, 0..1) into a tangent-space normal
 * map. `strength` is the slope multiplier: 1.0 gives roughly a 45-degree tilt where
 * the height changes by a quarter over one texel.
 */
export function normalFromHeight(height, size, strength = 2.0) {
  const cv = canvas(size);
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const at = (x, y) => height[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 0.5 * strength * 4.0;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 0.5 * strength * 4.0;
      let nx = -dx, ny = -dy, nz = 1.0;
      const l = Math.hypot(nx, ny, nz) || 1;
      const i = (y * size + x) * 4;
      d[i] = (nx / l * 0.5 + 0.5) * 255;
      d[i + 1] = (ny / l * 0.5 + 0.5) * 255;
      d[i + 2] = (nz / l * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return tex(cv);
}

// Values passed to writeRGB with srgb=true are sRGB display values, since that is
// what the canvas byte actually holds; three decodes them back to linear.
function writeRGB(size, fn, srgb) {
  const cv = canvas(size);
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const rgb = [0, 0, 0];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      fn(x / size, y / size, rgb, x, y);
      const i = (y * size + x) * 4;
      d[i] = clamp(rgb[0], 0, 1) * 255;
      d[i + 1] = clamp(rgb[1], 0, 1) * 255;
      d[i + 2] = clamp(rgb[2], 0, 1) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return tex(cv, { srgb });
}

// ---------------------------------------------------------------- wood counter
// Planed keyaki, oiled and worked on for years. The grain runs along U; the
// lattice is stretched hard on that axis so the lines are lines, not ripples.
export function woodMaps(size = 512) {
  const h = new Float32Array(size * size);
  const grain = (u, v) => {
    const warp = (fbm2(u, v, 4, 3, 3, 21) - 0.5) * 1.2;
    const r = v * 34.0 + warp + Math.sin(u * Math.PI * 2.0) * 0.4;
    let g = Math.abs(Math.sin(r * Math.PI));
    g = Math.pow(g, 0.35);
    const fibre = fbm2(u, v, 260, 30, 3, 77);
    return clamp(g * 0.62 + fibre * 0.38, 0, 1);
  };
  // relief is only the open pores and the fine tear-out; rings are flat
  const relief = (u, v) => {
    const pores = smoothstep(0.76, 0.99, fbm2(u, v, 340, 120, 2, 5));
    const fibre = fbm2(u, v, 300, 34, 2, 91);
    return clamp(pores * 0.75 + fibre * 0.25, 0, 1);
  };
  const color = writeRGB(size, (u, v, out) => {
    const g = grain(u, v);
    const wear = fbm2(u, v, 6, 5, 4, 303);
    const t = g * 0.80 + wear * 0.20;
    // warm, light, sun-worn; the dark late-wood only in the ring lines
    out[0] = mix(0.512, 0.252, t) * mix(0.96, 1.05, wear);
    out[1] = mix(0.396, 0.180, t) * mix(0.97, 1.04, wear);
    out[2] = mix(0.283, 0.122, t);
    const stain = smoothstep(0.72, 0.94, fbm2(u, v, 7, 5, 3, 555));
    out[0] *= mix(1, 0.82, stain); out[1] *= mix(1, 0.80, stain); out[2] *= mix(1, 0.84, stain);
  }, true);
  const rough = writeRGB(size, (u, v, out) => {
    const g = grain(u, v);
    const polish = smoothstep(0.22, 0.70, fbm2(u, v, 5, 4, 3, 41));
    out[0] = out[1] = out[2] = clamp(mix(0.70, 0.44, polish) + g * 0.13, 0.2, 1);
  }, false);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = relief(x / size, y / size);
  return { map: color, roughnessMap: rough, normalMap: normalFromHeight(h, size, 1.1) };
}

// ------------------------------------------------------- old enamel-painted iron
// The signature material: thick paint over cast iron, chipped at the corners,
// hazed by decades of sugar water and towels.
export function paintedMetalMaps(size = 1024, base = [0.62, 0.13, 0.12]) {
  const rnd = mulberry32(9182);
  // chip mask: sparse cellular blotches, biased to the map's edges (= object corners)
  const chips = new Float32Array(size * size);
  const scratches = new Float32Array(size * size);
  const orange = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size, i = y * size + x;
      const w = worley(u, v, 22, 13);
      const w2 = worley(u * 1.0, v * 1.0, 46, 71);
      const edgeBias = smoothstep(0.5, 0.02, Math.min(Math.min(u, 1 - u), Math.min(v, 1 - v)));
      const n = fbm(u, v, 7, 4, 17);
      let c = smoothstep(0.20, 0.02, w) * smoothstep(0.52, 0.70, n * 0.6 + edgeBias * 0.7);
      c = Math.max(c, smoothstep(0.07, 0.0, w2) * smoothstep(0.62, 0.86, n + edgeBias * 0.5));
      chips[i] = clamp(c, 0, 1);
      // fine hairline scratches, mostly horizontal from wiping
      const s = fbm2(u, v, 300, 16, 2, 909);
      scratches[i] = smoothstep(0.70, 0.95, s);
      // "orange peel" of thick brush enamel
      orange[i] = fbm(u, v, 40, 3, 4242);
    }
  }
  const color = writeRGB(size, (u, v, out, x, y) => {
    const i = y * size + x;
    const c = chips[i], s = scratches[i];
    const grime = fbm(u, v, 5, 4, 88);
    // enamel
    let r = base[0] * mix(0.86, 1.10, grime);
    let g = base[1] * mix(0.86, 1.10, grime);
    let b = base[2] * mix(0.86, 1.10, grime);
    // sun-bleached on the upper half
    const bleach = smoothstep(0.55, 0.0, v) * 0.22;
    r = mix(r, r * 1.25 + 0.09, bleach); g = mix(g, g * 1.2 + 0.08, bleach); b = mix(b, b * 1.2 + 0.08, bleach);
    // chipped through to grey primer, then to rusty iron in the deepest chips
    const deep = smoothstep(0.55, 1.0, c);
    const prim = smoothstep(0.10, 0.6, c);
    r = mix(r, 0.42, prim); g = mix(g, 0.40, prim); b = mix(b, 0.37, prim);
    r = mix(r, 0.22 + grime * 0.16, deep); g = mix(g, 0.14 + grime * 0.09, deep); b = mix(b, 0.10, deep);
    // rust halo bleeding out of the chips
    const halo = smoothstep(0.02, 0.35, c) * (1 - deep) * 0.5;
    r = mix(r, 0.33, halo); g = mix(g, 0.17, halo); b = mix(b, 0.08, halo);
    out[0] = r * mix(1, 1.18, s * 0.5); out[1] = g * mix(1, 1.18, s * 0.5); out[2] = b * mix(1, 1.18, s * 0.5);
  }, true);
  const rough = writeRGB(size, (u, v, out, x, y) => {
    const i = y * size + x;
    const c = chips[i];
    const haze = fbm(u, v, 6, 3, 611);
    // fresh enamel is glossy; chips and old haze are matte
    let r = mix(0.20, 0.42, haze);
    r = mix(r, 0.86, smoothstep(0.05, 0.55, c));
    r += scratches[i] * 0.12;
    r -= orange[i] * 0.05;
    out[0] = out[1] = out[2] = clamp(r, 0.05, 1);
  }, false);
  // height: paint edge lips around every chip + subtle orange peel
  const h = new Float32Array(size * size);
  for (let i = 0; i < h.length; i++) {
    const c = chips[i];
    h[i] = (1 - smoothstep(0.02, 0.35, c)) * 0.7 + orange[i] * 0.28 + scratches[i] * 0.04;
  }
  // where the enamel is gone the bare iron shows: that has to be metal, not paint
  const metal = writeRGB(size, (u, v, out, x, y) => {
    const c = chips[y * size + x];
    out[0] = out[1] = out[2] = smoothstep(0.30, 0.85, c) * 0.85;
  }, false);
  return { map: color, roughnessMap: rough, metalnessMap: metal, normalMap: normalFromHeight(h, size, 2.2), chipMask: chips };
}

// -------------------------------------------------------------------- cast iron
export function castIronMaps(size = 512) {
  const h = new Float32Array(size * size);
  const color = writeRGB(size, (u, v, out, x, y) => {
    const pit = worley(u, v, 60, 5);
    const n = fbm(u, v, 9, 4, 31);
    const grit = fbm(u, v, 90, 2, 12);
    const k = mix(0.315, 0.430, n) + grit * 0.05 - smoothstep(0.25, 0.0, pit) * 0.05;
    const rust = smoothstep(0.68, 0.95, fbm(u, v, 6, 4, 707));
    out[0] = mix(k, 0.46, rust); out[1] = mix(k * 0.965, 0.295, rust); out[2] = mix(k * 0.935, 0.205, rust);
    h[y * size + x] = grit * 0.5 + (1 - smoothstep(0.3, 0.0, pit)) * 0.5;
  }, true);
  const rough = writeRGB(size, (u, v, out) => {
    const n = fbm(u, v, 14, 3, 99);
    out[0] = out[1] = out[2] = mix(0.72, 0.94, n);
  }, false);
  return { map: color, roughnessMap: rough, normalMap: normalFromHeight(h, size, 1.6) };
}

// ------------------------------------------------------------------ chrome wear
export function chromeMaps(size = 512) {
  const h = new Float32Array(size * size);
  const rough = writeRGB(size, (u, v, out, x, y) => {
    // circular buffing marks plus the odd deep scuff
    const ang = Math.atan2(v - 0.5, u - 0.5);
    const rad = Math.hypot(v - 0.5, u - 0.5);
    const buff = fbm2((ang / (Math.PI * 2)) + 0.5, rad, 6, 150, 2, 55);
    const scuff = smoothstep(0.86, 0.99, fbm2(u, v, 260, 12, 2, 313));
    const dull = smoothstep(0.45, 0.90, fbm(u, v, 5, 3, 12));
    let r = 0.028 + buff * 0.028 + scuff * 0.20 + dull * 0.055;
    out[0] = out[1] = out[2] = clamp(r, 0.02, 1);
    h[y * size + x] = scuff * 0.6 + buff * 0.4;
  }, false);
  const metal = writeRGB(size, (u, v, out) => {
    // pinholes where the plating has lifted
    const pit = smoothstep(0.035, 0.0, worley(u, v, 60, 91));
    out[0] = out[1] = out[2] = 1 - pit * 0.30;
  }, false);
  return { roughnessMap: rough, metalnessMap: metal, normalMap: normalFromHeight(h, size, 0.5) };
}

// ------------------------------------------------------------ shaved-ice surface
// Not snow, not sugar: a dense mat of translucent shards. The normal map gives
// the grain, the sparkle map drives the individual facet glints.
export function shavedIceMaps(size = 512) {
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const flakes = 1 - worley(u, v, 26, 17);
      const fine = 1 - worley(u, v, 58, 63);
      h[y * size + x] = clamp(flakes * 0.62 + fine * 0.3 + fbm(u, v, 140, 2, 5) * 0.14, 0, 1);
    }
  }
  // low-frequency clumping: the heap is built of handfuls, not a smooth shell
  const clump = writeRGB(size, (u, v, out) => {
    const c1 = 1 - worley(u, v, 7, 41);
    const c2 = 1 - worley(u, v, 15, 88);
    const n = fbm(u, v, 11, 3, 210);
    out[0] = out[1] = out[2] = clamp(c1 * 0.5 + c2 * 0.3 + n * 0.35, 0, 1);
  }, false);
  const sparkle = writeRGB(size, (u, v, out) => {
    const a = smoothstep(0.86, 1.0, fbm(u, v, 200, 1, 3));
    const b = smoothstep(0.90, 1.0, fbm(u, v, 110, 1, 77));
    const c = 1 - smoothstep(0.0, 0.09, worley(u, v, 110, 29));
    out[0] = a; out[1] = b; out[2] = c;
  }, false);
  return { normalMap: normalFromHeight(h, size, 1.5), sparkleMap: sparkle, clumpMap: clump };
}

// ---------------------------------------------------------------- fabric (noren)
export function fabricMaps(size = 256, glyph = '') {
  const h = new Float32Array(size * size);
  // an optional dyed-out character, the way a real shop noren carries one
  let mask = null;
  if (glyph) {
    const gc = canvas(size);
    const gx = gc.getContext('2d');
    gx.fillStyle = '#000'; gx.fillRect(0, 0, size, size);
    gx.fillStyle = '#fff';
    gx.font = `600 ${Math.round(size * 0.62)}px "Hiragino Mincho ProN", "Yu Mincho", serif`;
    gx.textAlign = 'center'; gx.textBaseline = 'middle';
    gx.fillText(glyph, size / 2, size * 0.46);
    mask = gx.getImageData(0, 0, size, size).data;
  }
  const color = writeRGB(size, (u, v, out, x, y) => {
    const weft = Math.sin(u * size * Math.PI) * 0.5 + 0.5;
    const warp = Math.sin(v * size * Math.PI) * 0.5 + 0.5;
    const th = (weft * 0.5 + warp * 0.5);
    const slub = fbm2(u, v, 60, 22, 3, 43);
    const k = 0.82 + th * 0.18 + slub * 0.12;
    out[0] = 0.118 * k; out[1] = 0.172 * k; out[2] = 0.330 * k;
    if (mask) {
      const m = mask[(y * size + x) * 4] / 255;
      // undyed cloth shows through where the character is
      out[0] = mix(out[0], 0.775 * k, m);
      out[1] = mix(out[1], 0.780 * k, m);
      out[2] = mix(out[2], 0.745 * k, m);
    }
    h[y * size + x] = th * 0.7 + slub * 0.3;
  }, true);
  return { map: color, normalMap: normalFromHeight(h, size, 1.2) };
}

// ------------------------------------------------------------- 3D ice interior
// R = milky cloudiness, G = trapped micro-bubbles. Sampled in object space by the
// ice shader so the frozen core swims correctly when the block turns.
export function iceVolume(res = 64) {
  const data = new Uint8Array(res * res * res * 2);
  const rnd = mulberry32(7331);
  // scatter a handful of bubble seeds so the block has real specks, not just noise
  const seeds = [];
  for (let i = 0; i < 90; i++) seeds.push([rnd(), rnd(), rnd(), 0.012 + rnd() * 0.03]);
  for (let z = 0; z < res; z++) {
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const u = x / res, v = y / res, w = z / res;
        // block ice freezes from the outside in, so the cloud sits in the core
        const rx = (u - 0.5) * 2, rz = (w - 0.5) * 2, ry = (v - 0.5) * 2;
        const radial = Math.sqrt(rx * rx + rz * rz);
        // clear where it froze first (the outside), cloudy where the last water
        // was trapped -- a wide feathered core, not a thin column
        const core = smoothstep(1.05, 0.22, radial) * smoothstep(1.02, 0.26, Math.abs(ry));
        const n = fbm(u + w * 0.31, v + w * 0.17, 6, 4, 61);
        // vertical feathering: block ice freezes downward, and it shows
        const feather = fbm2(u + w * 0.22, v, 16, 3, 4, 611);
        const wisp = fbm2(u, v * 0.35 + w * 0.5, 30, 6, 3, 77);
        let cloud = core * (0.30 + n * 1.10) * (0.30 + feather * 1.15);
        cloud = clamp(cloud * (0.65 + wisp * 0.9), 0, 1);
        cloud = Math.pow(cloud, 1.30) * 1.15;
        let bub = 0;
        for (const s of seeds) {
          const d = Math.hypot(u - s[0], v - s[1], w - s[2]);
          if (d < s[3]) bub = Math.max(bub, 1 - d / s[3]);
        }
        bub = Math.max(bub, smoothstep(0.055, 0.0, worley(u + w * 0.5, v, 26, 8)) * core * 0.8);
        const i = ((z * res + y) * res + x) * 2;
        data[i] = cloud * 255;
        data[i + 1] = clamp(bub, 0, 1) * 255;
      }
    }
  }
  const t = new Data3DTexture(data, res, res, res);
  t.format = RGFormat;
  t.type = UnsignedByteType;
  t.minFilter = t.magFilter = LinearFilter;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
}

/** Small equirect sky used for image-based lighting before the shop is captured. */
export function skyEquirect(w = 512) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = w / 2;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(cv.width, cv.height);
  const d = img.data;
  for (let y = 0; y < cv.height; y++) {
    const el = (0.5 - y / cv.height) * Math.PI;      // +pi/2 up
    for (let x = 0; x < cv.width; x++) {
      const az = (x / cv.width) * Math.PI * 2;
      let r, g, b;
      if (el > 0) {
        const t = Math.pow(Math.sin(el), 0.55);
        r = mix(1.05, 0.36, t); g = mix(1.02, 0.55, t); b = mix(0.92, 0.95, t);
        // hazy summer sun, up and to the left-behind
        const sd = Math.acos(clamp(Math.sin(el) * Math.sin(1.02) + Math.cos(el) * Math.cos(1.02) * Math.cos(az - 2.3), -1, 1));
        const sun = Math.exp(-sd * sd * 120) * 14 + Math.exp(-sd * sd * 6) * 0.8;
        r += sun * 1.0; g += sun * 0.93; b += sun * 0.78;
      } else {
        const t = Math.pow(-Math.sin(el), 0.6);
        // sunlit garden gravel and green below the horizon
        const green = smoothstep(0.0, 0.35, -Math.sin(el)) * (0.5 + 0.5 * Math.sin(az * 3));
        r = mix(0.58, 0.30, t) * mix(1, 0.7, green);
        g = mix(0.56, 0.30, t) * mix(1, 0.95, green);
        b = mix(0.48, 0.25, t) * mix(1, 0.55, green);
      }
      const i = (y * cv.width + x) * 4;
      d[i] = clamp(r, 0, 1) * 255; d[i + 1] = clamp(g, 0, 1) * 255; d[i + 2] = clamp(b, 0, 1) * 255; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new CanvasTexture(cv);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export { tex as makeTexture, canvas as makeCanvas };

/**
 * Fake shade on the counter: the eave's soft shadow plus the noren's stripes.
 * A real shadow map wide enough to hold the noren would cost far more resolution
 * than the machine can spare, and the camera never moves enough to give it away.
 */
export function counterShadeTexture(size = 512) {
  const cv = canvas(size);
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      // broad shade under the eave, softest at its leading edge
      const eave = smoothstep(0.64, 0.26, u + v * 0.16 + (fbm(u, v, 5, 3, 12) - 0.5) * 0.10);
      // noren panels: five soft bars running with the light
      const su = (u + v * 0.20) * 6.4 - 0.35;
      const cellf = su - Math.floor(su);
      const bar = smoothstep(0.04, 0.16, cellf) * smoothstep(0.96, 0.84, cellf);
      const barFade = smoothstep(0.02, 0.42, v) * smoothstep(0.95, 0.55, v) * smoothstep(0.72, 0.30, u);
      const stripes = bar * barFade;
      const soft = (fbm(u, v, 9, 3, 99) - 0.5) * 0.16;
      const a = clamp(eave * 0.42 + stripes * 0.40 + soft * eave, 0, 0.70);
      const i = (y * size + x) * 4;
      d[i] = 26; d[i + 1] = 30; d[i + 2] = 42;
      d[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new CanvasTexture(cv);
  t.colorSpace = SRGBColorSpace;
  return t;
}
