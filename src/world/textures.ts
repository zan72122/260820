import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { Rng } from '../core/rng';

const cache = new Map<string, Texture>();

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function finish(c: HTMLCanvasElement, repeat: number, srgb: boolean): CanvasTexture {
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Value-noise field used as the base for every procedural surface here. */
function noiseField(size: number, octaves: number, seed: number): Float32Array {
  const out = new Float32Array(size * size);
  const rng = new Rng(seed);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const cells = 2 << o;
    const grid = new Float32Array(cells * cells);
    for (let i = 0; i < grid.length; i++) grid[i] = rng.next();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * cells;
        const fy = (y / size) * cells;
        const x0 = Math.floor(fx) % cells;
        const y0 = Math.floor(fy) % cells;
        const x1 = (x0 + 1) % cells;
        const y1 = (y0 + 1) % cells;
        let tx = fx - Math.floor(fx);
        let ty = fy - Math.floor(fy);
        tx = tx * tx * (3 - 2 * tx);
        ty = ty * ty * (3 - 2 * ty);
        const a = grid[y0 * cells + x0] * (1 - tx) + grid[y0 * cells + x1] * tx;
        const b = grid[y1 * cells + x0] * (1 - tx) + grid[y1 * cells + x1] * tx;
        out[y * size + x] += (a * (1 - ty) + b * ty) * amp;
      }
    }
    total += amp;
    amp *= 0.52;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/** Damp, trodden earth: dark, uneven, with grit and darker moisture patches. */
export function wetSoilTexture(): Texture {
  const key = 'soil';
  if (cache.has(key)) return cache.get(key)!;
  const size = 256;
  const [c, ctx] = canvas(size);
  const base = noiseField(size, 5, 1201);
  const wet = noiseField(size, 3, 4402);
  const img = ctx.createImageData(size, size);
  const rng = new Rng(77);
  for (let i = 0; i < size * size; i++) {
    const n = base[i];
    const w = Math.max(0, wet[i] - 0.42) * 1.7;
    const grit = rng.next() < 0.035 ? 0.22 : 0;
    let r = 88 + n * 62 + grit * 120;
    let g = 70 + n * 52 + grit * 110;
    let b = 56 + n * 40 + grit * 96;
    // Water darkens soil and pulls it slightly cooler.
    r *= 1 - w * 0.46;
    g *= 1 - w * 0.42;
    b *= 1 - w * 0.3;
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = finish(c, 5, true);
  cache.set(key, t);
  return t;
}

/** Roughness map that matches the soil: wet patches are smooth, dry crust is not. */
export function wetSoilRoughness(): Texture {
  const key = 'soil-r';
  if (cache.has(key)) return cache.get(key)!;
  const size = 256;
  const [c, ctx] = canvas(size);
  const wet = noiseField(size, 3, 4402);
  const fine = noiseField(size, 5, 909);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const w = Math.max(0, wet[i] - 0.42) * 1.7;
    const v = Math.round(255 * Math.min(1, 0.94 - w * 0.72 + (fine[i] - 0.5) * 0.14));
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = finish(c, 5, false);
  cache.set(key, t);
  return t;
}

/** Short, uneven park turf seen from a metre or two away. */
export function turfTexture(): Texture {
  const key = 'turf';
  if (cache.has(key)) return cache.get(key)!;
  const size = 256;
  const [c, ctx] = canvas(size);
  const n1 = noiseField(size, 5, 313);
  const n2 = noiseField(size, 3, 812);
  const img = ctx.createImageData(size, size);
  const rng = new Rng(4);
  for (let i = 0; i < size * size; i++) {
    const blade = rng.next();
    const shade = 0.62 + n1[i] * 0.5 + (blade - 0.5) * 0.14;
    const dry = Math.max(0, n2[i] - 0.55) * 1.4;
    img.data[i * 4] = Math.min(255, (58 + dry * 74) * shade * 1.5);
    img.data[i * 4 + 1] = Math.min(255, (78 + dry * 46) * shade * 1.5);
    img.data[i * 4 + 2] = Math.min(255, (44 + dry * 20) * shade * 1.5);
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = finish(c, 14, true);
  cache.set(key, t);
  return t;
}

/** Hot-dip galvanised steel: mottled spangle, not a chrome mirror. */
export function galvanisedTexture(): Texture {
  const key = 'galv';
  if (cache.has(key)) return cache.get(key)!;
  const size = 128;
  const [c, ctx] = canvas(size);
  const n = noiseField(size, 4, 5150);
  const img = ctx.createImageData(size, size);
  const rng = new Rng(9);
  for (let i = 0; i < size * size; i++) {
    const spangle = rng.next() < 0.06 ? 0.16 : 0;
    const v = 150 + n[i] * 66 + spangle * 60;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v * 1.01;
    img.data[i * 4 + 2] = v * 1.04;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = finish(c, 2, true);
  cache.set(key, t);
  return t;
}

export function galvanisedRoughness(): Texture {
  const key = 'galv-r';
  if (cache.has(key)) return cache.get(key)!;
  const size = 128;
  const [c, ctx] = canvas(size);
  const n = noiseField(size, 4, 5150);
  const n2 = noiseField(size, 2, 611);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.round(255 * Math.min(1, 0.42 + n[i] * 0.30 + n2[i] * 0.14));
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = finish(c, 2, false);
  cache.set(key, t);
  return t;
}

/** A single soft round particle sprite, used for mist and droplets. */
export function softDot(size = 64, hardness = 0.35): Texture {
  const key = `dot-${size}-${hardness}`;
  if (cache.has(key)) return cache.get(key)!;
  const [c, ctx] = canvas(size);
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(hardness, 'rgba(255,255,255,0.62)');
  grad.addColorStop(0.72, 'rgba(255,255,255,0.16)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const t = new CanvasTexture(c);
  t.needsUpdate = true;
  cache.set(key, t);
  return t;
}

/** Torn, wispy patch used for the drifting mist sheets. */
export function mistPatch(): Texture {
  const key = 'mistpatch';
  if (cache.has(key)) return cache.get(key)!;
  const size = 128;
  const [c, ctx] = canvas(size);
  const n = noiseField(size, 4, 77_11);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const dx = (x / size - 0.5) * 2;
      const dy = (y / size - 0.5) * 2;
      const r = Math.sqrt(dx * dx + dy * dy * 2.6);
      const falloff = Math.max(0, 1 - r);
      const a = Math.max(0, n[i] * 1.35 - 0.42) * falloff * falloff;
      img.data[i * 4] = 255;
      img.data[i * 4 + 1] = 250;
      img.data[i * 4 + 2] = 244;
      img.data[i * 4 + 3] = Math.min(255, a * 320);
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.needsUpdate = true;
  cache.set(key, t);
  return t;
}

/** A leaf card: a couple of overlapping blades with visible midribs. */
export function leafTexture(): Texture {
  const key = 'leaf';
  if (cache.has(key)) return cache.get(key)!;
  const size = 128;
  const [c, ctx] = canvas(size);
  ctx.clearRect(0, 0, size, size);
  const rng = new Rng(31);
  for (let i = 0; i < 9; i++) {
    const cx = rng.range(18, size - 18);
    const cy = rng.range(18, size - 18);
    const rx = rng.range(11, 22);
    const ry = rng.range(20, 40);
    const rot = rng.range(0, Math.PI);
    const g = Math.round(rng.range(78, 132));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${Math.round(g * 0.46)},${g},${Math.round(g * 0.36)})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${Math.round(g * 0.3)},${Math.round(g * 0.7)},${Math.round(g * 0.26)},0.85)`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -ry);
    ctx.lineTo(0, ry);
    ctx.stroke();
    ctx.restore();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  cache.set(key, t);
  return t;
}

/** Dense, opaque foliage: mottled leaf masses for bushes and canopies. */
export function foliageTexture(): Texture {
  const key = 'foliage';
  if (cache.has(key)) return cache.get(key)!;
  const size = 128;
  const [c, ctx] = canvas(size);
  const n1 = noiseField(size, 5, 6161);
  const n2 = noiseField(size, 3, 2929);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const clump = n1[i];
    const sun = Math.max(0, n2[i] - 0.5) * 1.8;
    const shade = 0.55 + clump * 0.8;
    img.data[i * 4] = Math.min(255, (52 + sun * 96) * shade);
    img.data[i * 4 + 1] = Math.min(255, (74 + sun * 78) * shade);
    img.data[i * 4 + 2] = Math.min(255, (34 + sun * 34) * shade);
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = finish(c, 3, true);
  cache.set(key, t);
  return t;
}

/** Fine grass blades on transparent, for instanced turf tufts. */
export function bladeTexture(): Texture {
  const key = 'blade';
  if (cache.has(key)) return cache.get(key)!;
  const size = 64;
  const [c, ctx] = canvas(size);
  ctx.clearRect(0, 0, size, size);
  const rng = new Rng(515);
  for (let i = 0; i < 7; i++) {
    const x = rng.range(6, size - 6);
    const w = rng.range(3.0, 5.5);
    const lean = rng.spread(9);
    const top = rng.range(2, 12);
    const g = Math.round(rng.range(150, 225));
    ctx.beginPath();
    ctx.moveTo(x - w / 2, size);
    ctx.quadraticCurveTo(x - w / 2 + lean * 0.5, (size + top) / 2, x + lean, top);
    ctx.quadraticCurveTo(x + w / 2 + lean * 0.5, (size + top) / 2, x + w / 2, size);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, top, 0, size);
    grad.addColorStop(0, `rgb(${Math.round(g * 0.86)},${Math.round(g * 1.02)},${Math.round(g * 0.42)})`);
    grad.addColorStop(1, `rgb(${Math.round(g * 0.36)},${Math.round(g * 0.70)},${Math.round(g * 0.30)})`);
    ctx.fillStyle = grad;
    ctx.fill();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  cache.set(key, t);
  return t;
}

/** Soft-edged mask so the worn hollow fades into the turf instead of cutting it. */
export function wearAlpha(): Texture {
  const key = 'wear-a';
  if (cache.has(key)) return cache.get(key)!;
  const size = 128;
  const [c, ctx] = canvas(size);
  const n = noiseField(size, 4, 8181);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const dx = x / size - 0.5;
      const dy = y / size - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      const edge = 1 - Math.min(1, Math.max(0, (r - 0.42) / 0.58));
      const a = Math.min(1, Math.max(0, edge * (0.55 + n[i] * 0.9)));
      const v = Math.round(255 * a * a);
      img.data[i * 4] = 255;
      img.data[i * 4 + 1] = 255;
      img.data[i * 4 + 2] = 255;
      img.data[i * 4 + 3] = v;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.needsUpdate = true;
  cache.set(key, t);
  return t;
}

/** Woven cotton for the rider's clothes. */
export function clothTexture(tint: [number, number, number]): Texture {
  const key = `cloth-${tint.join('-')}`;
  if (cache.has(key)) return cache.get(key)!;
  const size = 64;
  const [c, ctx] = canvas(size);
  const img = ctx.createImageData(size, size);
  const n = noiseField(size, 3, 202);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const weave = ((x % 3 === 0 ? 1 : 0) + (y % 3 === 0 ? 1 : 0)) * 0.05;
      const s = 0.86 + n[i] * 0.22 + weave;
      img.data[i * 4] = Math.min(255, tint[0] * s);
      img.data[i * 4 + 1] = Math.min(255, tint[1] * s);
      img.data[i * 4 + 2] = Math.min(255, tint[2] * s);
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = finish(c, 2, true);
  cache.set(key, t);
  return t;
}

export function disposeTextures(): void {
  for (const t of cache.values()) t.dispose();
  cache.clear();
}
