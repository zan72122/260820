import * as THREE from 'three';
import { Rng, fbm2 } from './math';

const cache = new Map<string, THREE.Texture>();

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

/**
 * Textures whose `repeat` is set by the caller must not be shared instances, or
 * the last caller silently rescales everyone else. Clones share the GPU source.
 */
function instance(t: THREE.Texture): THREE.Texture {
  const c = t.clone();
  c.needsUpdate = true;
  return c;
}

function finish(c: HTMLCanvasElement, repeat = 1, aniso = 4): THREE.Texture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function finishData(c: HTMLCanvasElement, repeat = 1): THREE.Texture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Gritty soil / gravel albedo. */
export function soilTexture(size = 512, base: [number, number, number] = [104, 84, 62]): THREE.Texture {
  const key = `soil${size}${base.join(',')}`;
  if (cache.has(key)) return instance(cache.get(key)!);
  const [c, ctx] = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const n = fbm2(x / 22, y / 22, 4, 7);
      const g = fbm2(x / 4.5, y / 4.5, 2, 31);
      const v = 0.72 + n * 0.42 + (g - 0.5) * 0.3;
      d[i] = Math.min(255, base[0] * v);
      d[i + 1] = Math.min(255, base[1] * v);
      d[i + 2] = Math.min(255, base[2] * v);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // scattered small stones
  const rng = new Rng(4242);
  for (let i = 0; i < size * 1.3; i++) {
    const x = rng.range(0, size);
    const y = rng.range(0, size);
    const r = rng.range(0.7, 3.0);
    const l = rng.range(0.75, 1.35);
    ctx.fillStyle = `rgba(${Math.min(255, base[0] * l + 26)},${Math.min(255, base[1] * l + 24)},${Math.min(
      255,
      base[2] * l + 20
    )},0.85)`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * rng.range(0.6, 1.0), rng.range(0, 6.28), 0, 6.283);
    ctx.fill();
  }
  const t = finish(c, 1);
  cache.set(key, t);
  return instance(t);
}

/** Matching bump/rough map for soil (data texture, no color space). */
export function soilRough(size = 256): THREE.Texture {
  const key = `soilrough${size}`;
  if (cache.has(key)) return instance(cache.get(key)!);
  const [c, ctx] = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const v = 0.72 + fbm2(x / 8, y / 8, 3, 13) * 0.28;
      const p = Math.min(255, v * 255);
      d[i] = d[i + 1] = d[i + 2] = p;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = finishData(c, 1);
  cache.set(key, t);
  return instance(t);
}

/** Worn asphalt for the closed road. */
export function asphaltTexture(size = 512): THREE.Texture {
  const key = `asph${size}`;
  if (cache.has(key)) return instance(cache.get(key)!);
  const [c, ctx] = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const n = fbm2(x / 30, y / 30, 3, 3) * 0.24 + fbm2(x / 3, y / 3, 2, 9) * 0.3;
      const v = 46 + n * 62;
      d[i] = v * 1.02;
      d[i + 1] = v;
      d[i + 2] = v * 1.05;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const rng = new Rng(9182);
  for (let i = 0; i < 240; i++) {
    ctx.fillStyle = `rgba(120,118,116,${rng.range(0.05, 0.2)})`;
    ctx.fillRect(rng.range(0, size), rng.range(0, size), rng.range(1, 3), rng.range(1, 3));
  }
  const t = finish(c, 1);
  cache.set(key, t);
  return instance(t);
}

/** Concrete / kerb. */
export function concreteTexture(size = 256): THREE.Texture {
  const key = `conc${size}`;
  if (cache.has(key)) return instance(cache.get(key)!);
  const [c, ctx] = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const v = 104 + fbm2(x / 18, y / 18, 3, 21) * 40 + fbm2(x / 3, y / 3, 1, 5) * 16;
      d[i] = v;
      d[i + 1] = v * 0.99;
      d[i + 2] = v * 0.95;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = finish(c, 1);
  cache.set(key, t);
  return instance(t);
}

/** Painted truck body: slightly chalky, with grime toward the bottom. */
export function paintTexture(hex: number, size = 256): THREE.Texture {
  const key = `paint${hex}${size}`;
  if (cache.has(key)) return cache.get(key)!;
  const [c, ctx] = makeCanvas(size);
  const col = new THREE.Color(hex);
  ctx.fillStyle = `rgb(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0})`;
  ctx.fillRect(0, 0, size, size);
  const rng = new Rng(hex | 7);
  for (let i = 0; i < 900; i++) {
    const y = rng.range(0, size);
    const w = 1 - y / size;
    ctx.fillStyle = `rgba(74,62,48,${rng.range(0.02, 0.13) * (0.25 + w * 1.1)})`;
    ctx.fillRect(rng.range(0, size), y, rng.range(2, 22), rng.range(1, 5));
  }
  // low grime band (splash from wheels)
  const grad = ctx.createLinearGradient(0, size * 0.62, 0, size);
  grad.addColorStop(0, 'rgba(58,46,34,0)');
  grad.addColorStop(1, 'rgba(58,46,34,0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const t = finish(c, 1);
  cache.set(key, t);
  return t;
}

/** Reinforced suction hose surface: dark rubber with fabric weave. */
export function hoseTexture(size = 256): THREE.Texture {
  const key = `hose${size}`;
  if (cache.has(key)) return instance(cache.get(key)!);
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = '#22242a';
  ctx.fillRect(0, 0, size, size);
  const rng = new Rng(771);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(${rng.int(48, 78)},${rng.int(48, 76)},${rng.int(52, 82)},${rng.range(0.05, 0.28)})`;
    ctx.fillRect(rng.range(0, size), rng.range(0, size), rng.range(1, 4), rng.range(1, 2));
  }
  for (let x = 0; x < size; x += 7) {
    ctx.fillStyle = 'rgba(12,12,15,0.35)';
    ctx.fillRect(x, 0, 2, size);
  }
  const t = finish(c, 1);
  cache.set(key, t);
  return instance(t);
}

/** Weathered utility marking paint stroke used as a ground decal. */
export function markingTexture(color: string, dashes: boolean, size = 256): THREE.Texture {
  const key = `mark${color}${dashes}${size}`;
  if (cache.has(key)) return instance(cache.get(key)!);
  const [c, ctx] = makeCanvas(size);
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  const rng = new Rng(dashes ? 31 : 17);
  const y = size * 0.5;
  if (dashes) {
    for (let x = 6; x < size - 6; x += 34) {
      ctx.globalAlpha = rng.range(0.28, 0.72);
      ctx.lineWidth = rng.range(6, 10);
      ctx.beginPath();
      ctx.moveTo(x, y + rng.range(-3, 3));
      ctx.lineTo(x + 20, y + rng.range(-3, 3));
      ctx.stroke();
    }
  } else {
    ctx.lineWidth = 8;
    let x = 4;
    while (x < size - 4) {
      const seg = rng.range(10, 40);
      ctx.globalAlpha = rng.range(0.18, 0.66);
      ctx.beginPath();
      ctx.moveTo(x, y + rng.range(-2.5, 2.5));
      ctx.lineTo(x + seg, y + rng.range(-2.5, 2.5));
      ctx.stroke();
      x += seg + rng.range(1, 9);
    }
  }
  ctx.globalAlpha = 1;
  const t = finish(c, 1, 8);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  cache.set(key, t);
  return instance(t);
}

/** Fresh spray-paint cross that the worker draws on the ground. */
export function crossTexture(size = 128): THREE.Texture {
  const key = `cross${size}`;
  if (cache.has(key)) return cache.get(key)!;
  const [c, ctx] = makeCanvas(size);
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = '#e8552c';
  ctx.lineCap = 'round';
  ctx.lineWidth = 11;
  const rng = new Rng(505);
  const half = size / 2;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(half - 40 + rng.range(-3, 3), half + rng.range(-3, 3));
  ctx.lineTo(half + 40 + rng.range(-3, 3), half + rng.range(-3, 3));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(half + rng.range(-3, 3), half - 40 + rng.range(-3, 3));
  ctx.lineTo(half + rng.range(-3, 3), half + 40 + rng.range(-3, 3));
  ctx.stroke();
  // overspray speckle
  for (let i = 0; i < 260; i++) {
    const a = rng.range(0, 6.283);
    const r = Math.abs(rng.range(-1, 1)) * 52;
    ctx.globalAlpha = rng.range(0.04, 0.3);
    ctx.fillStyle = '#e8552c';
    ctx.fillRect(half + Math.cos(a) * r, half + Math.sin(a) * r, 2, 2);
  }
  const t = finish(c, 1, 4);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  cache.set(key, t);
  return t;
}

/** Soft round alpha used by particles / puddles / shadows. */
export function blobTexture(size = 64, hardness = 0.45): THREE.Texture {
  const key = `blob${size}${hardness}`;
  if (cache.has(key)) return cache.get(key)!;
  const [c, ctx] = makeCanvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.04, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(hardness, 'rgba(255,255,255,0.82)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/** Grimy pipe surface: buried utilities are stained, never glowing. */
export function pipeTexture(
  baseHex: number,
  ribbed: boolean,
  size = 256
): THREE.Texture {
  const key = `pipe${baseHex}${ribbed}${size}`;
  if (cache.has(key)) return instance(cache.get(key)!);
  const [c, ctx] = makeCanvas(size);
  const col = new THREE.Color(baseHex);
  ctx.fillStyle = `rgb(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0})`;
  ctx.fillRect(0, 0, size, size);
  const rng = new Rng(baseHex ^ 991);
  if (ribbed) {
    for (let y = 0; y < size; y += 26) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(0, y, size, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(0, y + 5, size, 3);
    }
  }
  // soil staining, heavier at one side
  for (let i = 0; i < 1500; i++) {
    const x = rng.range(0, size);
    const y = rng.range(0, size);
    ctx.fillStyle = `rgba(${rng.int(58, 96)},${rng.int(44, 76)},${rng.int(28, 54)},${rng.range(0.04, 0.4)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rng.range(1, 9), rng.range(1, 6), rng.range(0, 6.28), 0, 6.283);
    ctx.fill();
  }
  const t = finish(c, 1);
  cache.set(key, t);
  return instance(t);
}

export function disposeTextureCache() {
  cache.forEach((t) => t.dispose());
  cache.clear();
}

/** Traffic cone: worn orange plastic with two retro-reflective sleeves. */
export function coneTexture(size = 128): THREE.Texture {
  const key = `cone${size}`;
  if (cache.has(key)) return cache.get(key)!;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = '#c0491f';
  ctx.fillRect(0, 0, size, size);
  // v is 0 at the tip for a ConeGeometry, so the sleeves sit up the body
  ctx.fillStyle = '#dfe0dc';
  ctx.fillRect(0, size * 0.3, size, size * 0.13);
  ctx.fillRect(0, size * 0.56, size, size * 0.1);
  const rng = new Rng(618);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${rng.int(40, 90)},${rng.int(30, 60)},${rng.int(20, 45)},${rng.range(0.03, 0.18)})`;
    ctx.fillRect(rng.range(0, size), rng.range(0, size), rng.range(1, 5), rng.range(1, 3));
  }
  const grad = ctx.createLinearGradient(0, size * 0.72, 0, size);
  grad.addColorStop(0, 'rgba(60,48,34,0)');
  grad.addColorStop(1, 'rgba(60,48,34,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const t = finish(c, 1);
  cache.set(key, t);
  return t;
}

/** Analogue meter face for the locator: an arc of ticks, no numerals. */
export function gaugeTexture(size = 128): THREE.Texture {
  const key = `gauge${size}`;
  if (cache.has(key)) return cache.get(key)!;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = '#ddd9cc';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#2c2e32';
  ctx.lineCap = 'round';
  const cx = size / 2;
  const cy = size * 0.88;
  const r = size * 0.62;
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * (1.12 + (i / 12) * 0.76);
    const inner = i % 3 === 0 ? r * 0.78 : r * 0.86;
    ctx.lineWidth = i % 3 === 0 ? size * 0.026 : size * 0.014;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }
  // the strong-signal end of the scale
  ctx.strokeStyle = '#b8391d';
  ctx.lineWidth = size * 0.05;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.93, Math.PI * 1.66, Math.PI * 1.88);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(40,40,44,0.35)';
  ctx.lineWidth = size * 0.05;
  ctx.strokeRect(size * 0.025, size * 0.025, size * 0.95, size * 0.95);
  const t = finish(c, 1, 4);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  cache.set(key, t);
  return t;
}

/** Red/white hatched barrier panel. */
export function barrierTexture(size = 256): THREE.Texture {
  const key = `barrier${size}`;
  if (cache.has(key)) return cache.get(key)!;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = '#e6e2d8';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#c0451f';
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(-Math.PI / 4);
  for (let i = -size; i < size; i += size / 5) {
    ctx.fillRect(i, -size, size / 10, size * 2);
  }
  ctx.restore();
  const rng = new Rng(2233);
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = `rgba(${rng.int(50, 90)},${rng.int(42, 70)},${rng.int(28, 50)},${rng.range(0.02, 0.14)})`;
    ctx.fillRect(rng.range(0, size), rng.range(0, size), rng.range(1, 6), rng.range(1, 3));
  }
  const t = finish(c, 1);
  cache.set(key, t);
  return t;
}
