// Every texture here is generated at runtime on a 2D canvas.
// No binary assets: the whole game is text in the repo, and it loads instantly offline.
import * as THREE from '../../vendor/three.module.js';
import { fbm2, valueNoise2, hash2, tileFbm, tileNoise } from './rng.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function finish(canvas, { repeat = [1, 1], srgb = false, aniso = 8, renderer = null } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer ? Math.min(aniso, renderer.capabilities.getMaxAnisotropy()) : aniso;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Cast-net twine. Diamond mesh computed analytically so the tile is seamless
 * and the knots sit exactly on the crossings. The alpha channel is the holes.
 */
export function makeNetTexture(renderer, { size = 512 } = {}) {
  const cell = size / 10;
  const thickness = size / 240;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const S = cell;
  const inv = 1 / Math.SQRT2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Twine runs on both diagonals; jitter keeps it from reading as a printed grid.
      const j = (fbm2(x * 0.06, y * 0.06, 3) - 0.5) * 5.5 + (fbm2(x * 0.012, y * 0.012, 2) - 0.5) * 7.0;
      const u = x + y + j;
      const v = x - y + j * 0.8;
      let du = ((u % S) + S) % S; du = Math.abs(du - S * 0.5);
      let dv = ((v % S) + S) % S; dv = Math.abs(dv - S * 0.5);
      const distU = du * inv, distV = dv * inv;
      const dist = Math.min(distU, distV);

      // Knots swell where two strands cross.
      const knot = Math.max(0, 1 - Math.hypot(distU, distV) / (thickness * 3.4));
      const t = thickness * (1 + knot * 0.55) + (valueNoise2(x * 0.35, y * 0.35) - 0.5) * thickness * 0.45;

      let a = 1 - Math.min(1, Math.max(0, (dist - t + 0.9) / 1.8));
      a = Math.min(1, a * 1.05);

      // Fibre tone: twisted cord, never a flat plastic value.
      const fib = fbm2(x * 0.9, y * 0.9, 2);
      const twist = 0.5 + 0.5 * Math.sin((distU < distV ? v : u) * 0.85);
      let l = 0.70 + fib * 0.26 - twist * 0.13 + knot * 0.10;
      l = Math.min(1, Math.max(0, l));

      const i = (y * size + x) * 4;
      d[i] = 255 * l * 0.98;
      d[i + 1] = 255 * l * 0.94;
      d[i + 2] = 255 * l * 0.83;
      d[i + 3] = 255 * a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, { srgb: true, aniso: 8, renderer });
}

/** Twisted three-strand rope with a frayed halo baked into the alpha edges. */
export function makeRopeTexture(renderer, { w = 128, h = 256 } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;               // around the rope
      const v = y / h;               // along the rope
      const phase = (u * 3 + v * 6.0) % 1;
      const groove = Math.abs(phase - 0.5) * 2;
      const strand = 1 - Math.pow(groove, 1.6);
      const fuzz = fbm2(x * 0.5 + 11, y * 0.5, 3);
      const hair = Math.pow(fbm2(x * 2.1, y * 0.9 + 40, 2), 3) * 0.5;
      let l = 0.42 + strand * 0.34 + fuzz * 0.18 + hair;
      l = Math.min(1, Math.max(0, l));
      const i = (y * w + x) * 4;
      d[i] = 255 * l * 0.92;
      d[i + 1] = 255 * l * 0.84;
      d[i + 2] = 255 * l * 0.68;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, { srgb: true, renderer });
}

/** Soft frayed-fibre halo, drawn on an oversized shell around the rope. */
export function makeFuzzTexture(renderer, { size = 128 } = {}) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hair = Math.pow(fbm2(x * 1.7, y * 0.55, 3), 2.4);
      const i = (y * size + x) * 4;
      d[i] = 236; d[i + 1] = 222; d[i + 2] = 190;
      d[i + 3] = 255 * Math.min(1, hair * 2.4);
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, { srgb: true, renderer });
}

/**
 * Weathered decking grain. No plank seams are painted in: the real gaps come
 * from the geometry, so the boards never disagree with the texture.
 */
export function makeWoodTexture(renderer, { size = 512 } = {}) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Grain runs along +u, which the deck maps to the length of the boards,
      // so the noise is stretched hard in x and tight in y.
      const grain = tileFbm(x, y, size, 0.0013, 0.018, 4);
      // Contour bands that follow the stretched grain: wood figure, not corduroy.
      const rings = 0.5 + 0.5 * Math.sin(grain * 34.0);
      const splinter = Math.pow(tileNoise(x, y, size, 0.013, 0.145), 3) * 0.22;
      // Damp runs *with* the boards: long, soft, never a blob.
      const wear = tileFbm(x, y, size, 0.0022, 0.021, 3);
      const wet = Math.min(1, Math.max(0, (wear - 0.47) * 1.5));

      let l = 0.60;
      l *= 0.84 + grain * 0.30;
      l *= 0.86 + rings * 0.19;
      l *= 1 - splinter;
      l *= 1 - wet * 0.15;

      const i = (y * size + x) * 4;
      d[i] = 255 * Math.min(1, l * 0.94);
      d[i + 1] = 255 * Math.min(1, l * 0.80);
      d[i + 2] = 255 * Math.min(1, l * 0.63 * (1 - wet * 0.06));
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, { srgb: true, renderer });
}

/** Matching roughness for the pier: damp boards are smoother than dry ones. */
export function makeWoodRoughness(renderer, { size = 256 } = {}) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const wear = tileFbm(x, y, size, 0.0044, 0.042, 3);
      const wet = Math.min(1, Math.max(0, (wear - 0.47) * 1.5));
      const micro = tileFbm(x, y, size, 0.009, 0.08, 3);
      const r = 0.94 - wet * 0.52 - micro * 0.10;
      const v = 255 * Math.min(1, Math.max(0, r));
      const i = (y * size + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, { renderer });
}

/** Sea floor: wet sand with ripple bars and scattered shell grit. */
export function makeSandTexture(renderer, { size = 512 } = {}) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const bars = 0.5 + 0.5 * Math.sin(y * (Math.PI * 2 * 9 / size) + tileFbm(x, y, size, 0.02, 0.02, 3) * 7.0);
      const grit = tileNoise(x, y, size, 1 / 3, 1 / 3);
      const patch = tileFbm(x, y, size, 0.017, 0.017, 4);
      let l = 0.34 + bars * 0.10 + grit * 0.09 + patch * 0.15;
      // Occasional dark shell or pebble.
      if (hash2(Math.floor(x / 3) * 1.7, Math.floor(y / 3) * 2.3) > 0.985) l *= 0.55;
      l = Math.min(1, Math.max(0, l));
      const i = (y * size + x) * 4;
      d[i] = 255 * l * 0.96;
      d[i + 1] = 255 * l * 0.90;
      d[i + 2] = 255 * l * 0.74;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, { srgb: true, repeat: [6, 6], renderer });
}

/** Seamless RGB value-noise, three scales in three channels. Used by the water. */
export function makeNoiseTexture(renderer, { size = 256 } = {}) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const per = (x, y, f) => {
    // Tileable value noise by blending four wrapped lookups.
    const s = size * f;
    const fx = x * f, fy = y * f;
    const a = valueNoise2(fx, fy);
    const b = valueNoise2(fx - s, fy);
    const cc = valueNoise2(fx, fy - s);
    const e = valueNoise2(fx - s, fy - s);
    const wx = x / size, wy = y / size;
    return (a * (1 - wx) + b * wx) * (1 - wy) + (cc * (1 - wx) + e * wx) * wy;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      d[i] = 255 * per(x, y, 0.02);
      d[i + 1] = 255 * per(x, y, 0.06);
      d[i + 2] = 255 * per(x, y, 0.17);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, { renderer });
}

/** Round soft sprite for spray, foam and droplet motes. */
export function makeDropletTexture(renderer, { size = 64 } = {}) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(238,248,252,0.72)');
  g.addColorStop(0.75, 'rgba(214,236,244,0.18)');
  g.addColorStop(1.0, 'rgba(214,236,244,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
