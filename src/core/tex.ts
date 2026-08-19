import * as THREE from 'three';

function canvas(size: number, h = size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = h;
  return c;
}

function hash(x: number, y: number, s = 0) {
  let n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function vnoise(x: number, y: number, s = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s);
  const b = hash(xi + 1, yi, s);
  const c = hash(xi, yi + 1, s);
  const d = hash(xi + 1, yi + 1, s);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm(x: number, y: number, oct = 4, s = 0) {
  let f = 0;
  let amp = 0.5;
  let sum = 0;
  for (let i = 0; i < oct; i++) {
    f += amp * vnoise(x, y, s + i * 13);
    sum += amp;
    x *= 2.03;
    y *= 2.03;
    amp *= 0.5;
  }
  return f / sum;
}

function finish(c: HTMLCanvasElement, srgb: boolean, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** Fine circular-brushed stainless: used as a roughness map. */
export function brushedSteel(size = 512, base = 0.24, streak = 0.16) {
  const c = canvas(size);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n =
        vnoise(x * 0.9, y * 0.05, 3) * 0.6 +
        vnoise(x * 4.5, y * 0.02, 9) * 0.4;
      let r = base + (n - 0.5) * streak;
      // occasional deeper scuff
      const sc = fbm(x * 0.012, y * 0.012, 3, 21);
      r += (sc - 0.5) * 0.1;
      const v = Math.max(0, Math.min(255, r * 255)) | 0;
      const o = (y * size + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, false);
}

/** Worked stone bench top: gentle veins, wipe marks, a dusting of flour. */
export function benchStone(size = 512) {
  const c = canvas(size);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const vein = Math.abs(
        Math.sin((u * 3.1 + fbm(u * 4, v * 4, 4, 5) * 2.4) * Math.PI)
      );
      const grain = fbm(x * 0.09, y * 0.09, 4, 11);
      const dust = Math.max(0, fbm(x * 0.02, y * 0.02, 3, 33) - 0.56) * 1.7;
      let l = 0.53 + grain * 0.11 + (1 - vein) * 0.08 + dust * 0.18;
      const wipe = Math.max(0, fbm(x * 0.006, y * 0.05, 2, 41) - 0.5) * 0.16;
      l += wipe;
      const o = (y * size + x) * 4;
      img.data[o] = Math.min(255, l * 255 * 1.02) | 0;
      img.data[o + 1] = Math.min(255, l * 255 * 0.99) | 0;
      img.data[o + 2] = Math.min(255, l * 255 * 0.97) | 0;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, true, 1);
}

export function benchRough(size = 256) {
  const c = canvas(size);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x * 0.05, y * 0.05, 4, 7);
      const wipe = Math.max(0, fbm(x * 0.01, y * 0.08, 2, 17) - 0.45) * 0.5;
      const v = (0.42 + n * 0.22 - wipe * 0.25) * 255;
      const o = (y * size + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = Math.max(0, Math.min(255, v)) | 0;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, false);
}

/** Frozen entremet: micro frost crystals, slightly heavier near the rim. */
export function frostMaps(size = 512) {
  const rough = canvas(size);
  const rctx = rough.getContext('2d')!;
  const rimg = rctx.createImageData(size, size);
  const col = canvas(size);
  const cctx = col.getContext('2d')!;
  const cimg = cctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const fine = fbm(x * 0.55, y * 0.55, 3, 2);
      const patch = fbm(x * 0.05, y * 0.05, 3, 8);
      const rimBias = 0.25 + v * 0.5;
      const frost = Math.max(0, fine * 0.65 + patch * 0.5 - 0.45) * (0.6 + rimBias);
      const r = 0.4 + frost * 0.4 + patch * 0.06;
      const o = (y * size + x) * 4;
      const rv = Math.max(0, Math.min(255, r * 255)) | 0;
      rimg.data[o] = rimg.data[o + 1] = rimg.data[o + 2] = rv;
      rimg.data[o + 3] = 255;
      const l = 0.86 + frost * 0.24;
      cimg.data[o] = Math.min(255, l * 238) | 0;
      cimg.data[o + 1] = Math.min(255, l * 243) | 0;
      cimg.data[o + 2] = Math.min(255, l * 250) | 0;
      cimg.data[o + 3] = 255;
    }
  }
  rctx.putImageData(rimg, 0, 0);
  cctx.putImageData(cimg, 0, 0);
  return { roughness: finish(rough, false), color: finish(col, true) };
}

/** Soft radial blob used for contact shadows and the tray puddle. */
export function radialAlpha(size = 128, power = 2.2) {
  const c = canvas(size);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - half, y - half) / half;
      const a = Math.pow(Math.max(0, 1 - d), power);
      const o = (y * size + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
      img.data[o + 3] = (a * 255) | 0;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Tray: scratch rings, dried droplet marks, a little glaze staining. */
export function trayGrime(size = 512) {
  const c = canvas(size);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#3d3d3f';
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.075;
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 10 + Math.random() * 90;
    const a = Math.random() * Math.PI;
    ctx.strokeStyle = Math.random() > 0.5 ? '#6a6a6c' : '#2a2a2c';
    ctx.lineWidth = 0.6 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 3 + Math.random() * 14;
    ctx.strokeStyle = '#8d8d90';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return finish(c, true);
}
