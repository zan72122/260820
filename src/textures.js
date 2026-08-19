// 手続き的テクスチャ生成 -- 外部バイナリ資産に依存しない
// すべて Canvas2D で焼き、CanvasTexture として three に渡す。
import * as THREE from '../vendor/three.module.js';

/* ---------- 決定論的ノイズ ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeValueNoise(seed) {
  const rnd = mulberry32(seed);
  const S = 256;
  const grid = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) grid[i] = rnd();
  const smooth = (t) => t * t * (3 - 2 * t);
  const at = (x, y) => grid[(y & (S - 1)) * S + (x & (S - 1))];
  return function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return (a * (1 - xf) + b * xf) * (1 - yf) + (c * (1 - xf) + d * xf) * yf;
  };
}

function fbm(noise, x, y, octaves = 5, lac = 2.0, gain = 0.5) {
  let sum = 0, amp = 0.5, norm = 0, f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * f, y * f);
    norm += amp; amp *= gain; f *= lac;
  }
  return sum / norm;
}

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function finish(c, repeat = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* 高さ場 (Float32Array) から法線マップを作る */
function heightToNormal(height, size, strength = 2.0) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const H = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function grayTexture(size, fn, repeat = 1) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.max(0, Math.min(1, fn(x / size, y / size))) * 255;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

/* ---------- 木 (欅の臼・樫の杵) ---------- */
// 年輪 + 導管の縞。stretch で木目の伸び方向を変える。
export function woodMaps(opts = {}) {
  const {
    size = 512, seed = 7, base = [0.44, 0.30, 0.19], light = [0.68, 0.50, 0.33],
    ringScale = 26, stretch = 7.0, knots = 0.0,
  } = opts;
  const noise = makeValueNoise(seed);
  const height = new Float32Array(size * size);
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      // 木目を縦に引き伸ばす
      const warp = fbm(noise, u * 3.0, v * 3.0 / stretch, 4) - 0.5;
      const d = (u + warp * 0.55 + knots * Math.sin(v * 9.0) * 0.05);
      let rings = Math.sin(d * ringScale * Math.PI);
      rings = Math.pow(Math.abs(rings), 0.55) * Math.sign(rings);
      const fine = fbm(noise, u * 90.0, v * 12.0, 3) - 0.5; // 導管
      let t = 0.5 + rings * 0.34 + fine * 0.30;
      t = Math.max(0, Math.min(1, t));
      const shade = 0.86 + fbm(noise, u * 2.0, v * 2.0, 3) * 0.28; // 大きな色ムラ
      const i = (y * size + x) * 4;
      img.data[i] = (base[0] + (light[0] - base[0]) * t) * shade * 255;
      img.data[i + 1] = (base[1] + (light[1] - base[1]) * t) * shade * 255;
      img.data[i + 2] = (base[2] + (light[2] - base[2]) * t) * shade * 255;
      img.data[i + 3] = 255;
      height[y * size + x] = t * 0.7 + fine * 0.3;
    }
  }
  ctx.putImageData(img, 0, 0);
  return {
    map: finish(c),
    normalMap: heightToNormal(height, size, 1.6),
    roughnessMap: grayTexture(256, (u, v) => 0.62 + (fbm(noise, u * 40, v * 6, 3) - 0.5) * 0.34),
  };
}

/* ---------- 土間 (三和土) ---------- */
export function domaMaps(size = 512) {
  const noise = makeValueNoise(21);
  const height = new Float32Array(size * size);
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const grain = fbm(noise, u * 26, v * 26, 5);
      const blot = fbm(noise, u * 4, v * 4, 4);
      const peb = Math.pow(fbm(noise, u * 150, v * 150, 2), 9) * 0.75; // まばらな小石
      const t = 0.46 + (blot - 0.5) * 0.30 + (grain - 0.5) * 0.14 + peb * 0.22;
      const i = (y * size + x) * 4;
      img.data[i] = (0.30 + t * 0.30) * 255;
      img.data[i + 1] = (0.25 + t * 0.26) * 255;
      img.data[i + 2] = (0.20 + t * 0.21) * 255;
      img.data[i + 3] = 255;
      height[y * size + x] = grain * 0.26 + peb * 0.55 + blot * 0.12;
    }
  }
  ctx.putImageData(img, 0, 0);
  return {
    map: finish(c, 3),
    normalMap: heightToNormal(height, size, 1.15),
    roughnessMap: grayTexture(256, (u, v) => 0.88 + (fbm(noise, u * 22, v * 22, 3) - 0.5) * 0.12, 3),
  };
}

/* ---------- 漆喰 / 板壁 ---------- */
export function plasterMaps(size = 512) {
  const noise = makeValueNoise(53);
  const height = new Float32Array(size * size);
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const coarse = fbm(noise, u * 6, v * 6, 4);
      const fine = fbm(noise, u * 46, v * 46, 4);
      const straw = Math.max(0, fbm(noise, u * 130, v * 26, 2) - 0.56) * 2.2; // 藁すさ
      const t = coarse * 0.45 + fine * 0.40 + straw * 0.15;
      const soot = Math.pow(Math.max(0, 1.0 - v * 1.30), 2.4) * 0.20;
      const i = (y * size + x) * 4;
      const base = 0.66 + (t - 0.5) * 0.28 - soot;
      img.data[i] = base * 255 * 1.03;
      img.data[i + 1] = base * 255 * 0.985;
      img.data[i + 2] = base * 255 * 0.895;
      img.data[i + 3] = 255;
      height[y * size + x] = fine * 0.55 + straw * 0.45;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { map: finish(c, 1), normalMap: heightToNormal(height, size, 1.5) };
}

/* ---------- 障子紙 ---------- */
export function shojiMap(size = 256) {
  const noise = makeValueNoise(91);
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#efe8d8';
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.10;
  for (let i = 0; i < 900; i++) { // 楮の繊維
    const x = Math.random() * size, y = Math.random() * size, a = Math.random() * Math.PI;
    ctx.strokeStyle = '#b9ad93'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * 18, y + Math.sin(a) * 18); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  void noise;
  return finish(c, 1);
}

/* ---------- 雪面 ---------- */
export function snowMaps(size = 512) {
  const noise = makeValueNoise(133);
  const height = new Float32Array(size * size);
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const h = fbm(noise, u * 7, v * 7, 5) * 0.6 + fbm(noise, u * 55, v * 55, 3) * 0.4;
      const t = 0.90 + (h - 0.5) * 0.16;
      const i = (y * size + x) * 4;
      img.data[i] = t * 250;
      img.data[i + 1] = t * 252;
      img.data[i + 2] = t * 255;
      img.data[i + 3] = 255;
      height[y * size + x] = h;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { map: finish(c, 6), normalMap: heightToNormal(height, size, 1.1) };
}

/* ---------- 蒸気 / 手粉 スプライト ---------- */
export function puffSprite(size = 128, softness = 0.55, seed = 3) {
  const noise = makeValueNoise(seed);
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * 2 - 1, v = (y / size) * 2 - 1;
      const r = Math.hypot(u, v);
      const n = fbm(noise, x / size * 4, y / size * 4, 4);
      let a = 1.0 - Math.min(1, r / 0.98);
      a = Math.pow(a, 1.0 + softness * 2.2);
      a *= 0.45 + n * 0.85;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.max(0, Math.min(1, a)) * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- 餅表面 (もち米 -> つやもち) ---------- */
// 粒感の凹凸を法線マップとして焼き、cohesion で強度を落として使う。
export function riceGrainNormal(size = 512) {
  const rnd = mulberry32(404);
  const height = new Float32Array(size * size);
  const grains = 2600;
  for (let g = 0; g < grains; g++) {
    const cx = rnd() * size, cy = rnd() * size;
    const ang = rnd() * Math.PI;
    const rx = 4.6 + rnd() * 2.2, ry = 2.6 + rnd() * 1.2;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let dy = -8; dy <= 8; dy++) {
      for (let dx = -8; dx <= 8; dx++) {
        const lx = (dx * ca + dy * sa) / rx, ly = (-dx * sa + dy * ca) / ry;
        const d = lx * lx + ly * ly;
        if (d > 1) continue;
        const h = Math.sqrt(1 - d);
        const px = (Math.floor(cx + dx) + size) % size;
        const py = (Math.floor(cy + dy) + size) % size;
        const i = py * size + px;
        if (h > height[i]) height[i] = h;
      }
    }
  }
  const t = heightToNormal(height, size, 2.6);
  t.repeat.set(5, 5);
  return t;
}

/* もち肌の細かな凹凸 */
export function mochiSkinNormal(size = 256) {
  const noise = makeValueNoise(313);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      height[y * size + x] = fbm(noise, u * 14, v * 14, 4) * 0.6 + fbm(noise, u * 52, v * 52, 3) * 0.4;
    }
  }
  const t = heightToNormal(height, size, 0.55);
  t.repeat.set(2, 2);
  return t;
}

export function mochiSurfaceMap(size = 256) {
  const noise = makeValueNoise(777);
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const n = fbm(noise, u * 9, v * 9, 4);
      const i = (y * size + x) * 4;
      img.data[i] = (0.965 + (n - 0.5) * 0.05) * 255;
      img.data[i + 1] = (0.955 + (n - 0.5) * 0.05) * 255;
      img.data[i + 2] = (0.935 + (n - 0.5) * 0.05) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, 2);
}

/* ---------- 藁 / 縄 ---------- */
export function ropeMap(size = 128) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c9ab6d'; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size; i += 6) {
    const g = ctx.createLinearGradient(0, i, 0, i + 6);
    g.addColorStop(0, 'rgba(90,66,30,0.55)');
    g.addColorStop(0.5, 'rgba(255,236,190,0.35)');
    g.addColorStop(1, 'rgba(90,66,30,0.55)');
    ctx.fillStyle = g;
    ctx.save(); ctx.translate(0, i); ctx.transform(1, 0, -0.9, 1, 0, 0);
    ctx.fillRect(-size, 0, size * 3, 6); ctx.restore();
  }
  return finish(c, 1);
}

export { makeValueNoise, fbm, mulberry32 };
