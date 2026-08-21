import * as THREE from 'three';
import { clamp, fbm, makeValueNoise, Rng } from './util';

const cache = new Map<string, THREE.Texture>();

function canvas(size: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d canvas unavailable');
  return { c, ctx };
}

function finish(c: HTMLCanvasElement, srgb: boolean, repeat = 1): THREE.Texture {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/** Converts a tileable height field into a tangent space normal map. */
export function heightToNormal(
  height: Float32Array,
  size: number,
  strength: number,
): HTMLCanvasElement {
  const { c, ctx } = canvas(size);
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
  return c;
}

/**
 * Gelcoat surface relief: a broad "orange peel" from moulding plus fine drag
 * scratches that run the way riders slide. The scratch direction is what makes
 * the raking inspection light read as a real surface instead of a gradient.
 */
export function frpNormal(): THREE.Texture {
  const key = 'frpNormal';
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 256;
  const n1 = makeValueNoise(11);
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * 22;
      const v = (y / size) * 22;
      h[y * size + x] = fbm(n1, u, v, 3, 0.55) * 0.34;
    }
  }
  const rng = new Rng(23);
  // fine drag scratches along the sliding direction (texture U)
  for (let s = 0; s < 260; s++) {
    const y0 = rng.int(size);
    const x0 = rng.int(size);
    const len = rng.int(size >> 1) + 12;
    const depth = rng.range(0.02, 0.11);
    const drift = rng.range(-0.03, 0.03);
    for (let i = 0; i < len; i++) {
      const x = (x0 + i) % size;
      const y = Math.round(y0 + drift * i + size) % size;
      const fade = Math.sin((i / len) * Math.PI);
      h[y * size + x] -= depth * fade;
    }
  }
  const tex = finish(heightToNormal(h, size, 1.6), false, 1);
  cache.set(key, tex);
  return tex;
}

/** Broad, slow roughness break-up so highlights are never perfectly uniform. */
export function roughnessCloud(base: number, amp: number, seed: number, key: string): THREE.Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 128;
  const { c, ctx } = canvas(size);
  const n = makeValueNoise(seed);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = clamp(base + (fbm(n, (x / size) * 5, (y / size) * 5, 4, 0.5) - 0.5) * amp * 2, 0, 1);
      const i = (y * size + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = v * 255;
      img.data[i + 2] = 0;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = finish(c, false, 1);
  cache.set(key, tex);
  return tex;
}

/** Machined aluminium: satin along one axis, worn brighter at contact edges. */
export function metalRoughness(): THREE.Texture {
  const key = 'metalRough';
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 128;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = '#ff6600';
  ctx.fillRect(0, 0, size, size);
  const rng = new Rng(91);
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 900; i++) {
    const y = rng.int(size);
    const v = Math.round(rng.range(40, 130));
    ctx.strokeStyle = `rgb(255,${v},0)`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + rng.range(-1.5, 1.5));
    ctx.lineWidth = rng.range(0.4, 1.6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const tex = finish(c, false, 1);
  cache.set(key, tex);
  return tex;
}

/** Cured rubber sealant: matt, slightly cratered, never mirror-like. */
export function sealantNormal(): THREE.Texture {
  const key = 'sealantNormal';
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 128;
  const n = makeValueNoise(53);
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      h[y * size + x] = fbm(n, (x / size) * 16, (y / size) * 16, 3, 0.6);
    }
  }
  const tex = finish(heightToNormal(h, size, 14), false, 1);
  cache.set(key, tex);
  return tex;
}

/** Wet, freshly hosed pool deck tiles. */
export function deckTiles(): THREE.Texture {
  const key = 'deckTiles';
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 256;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = '#cfd6d3';
  ctx.fillRect(0, 0, size, size);
  const rng = new Rng(5);
  const cell = size / 4;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const t = rng.range(0.86, 1);
      ctx.fillStyle = `rgb(${Math.round(206 * t)},${Math.round(214 * t)},${Math.round(210 * t)})`;
      ctx.fillRect(x * cell + 1.5, y * cell + 1.5, cell - 3, cell - 3);
    }
  }
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 2400; i++) {
    const v = Math.round(rng.range(120, 220));
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(rng.int(size), rng.int(size), 1, 1);
  }
  ctx.globalAlpha = 1;
  const tex = finish(c, true, 1);
  cache.set(key, tex);
  return tex;
}

/** Soft round shadow used instead of a dynamic shadow map under small props. */
export function contactShadow(): THREE.Texture {
  const key = 'contact';
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 128;
  const { c, ctx } = canvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = finish(c, false, 1);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  cache.set(key, tex);
  return tex;
}

/** Round soft sprite for spray, dust and polish haze particles. */
export function softDot(tint: string): THREE.Texture {
  const key = `dot:${tint}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 64;
  const { c, ctx } = canvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  g.addColorStop(0, tint);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = finish(c, true, 1);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  cache.set(key, tex);
  return tex;
}
