// 竹林のマテリアルはすべて canvas で手続き的に生成する。
// 外部アセットが無いのでオフラインでも確実に起動し、iOS でも読み込み待ちが出ない。
import * as THREE from 'three';
import { fbmTile, noise2, clamp, smoothstep, makeRng } from '../core/rng.js';

const cache = new Map();
function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

function canvas(size, h = size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = h;
  return c;
}

function toTexture(c, { repeat = 1, srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

const mix = (a, b, t) => a + (b - a) * t;

/** 高さマップ canvas から法線マップを作る */
function normalFromHeight(heightCanvas, strength = 2.0) {
  const s = heightCanvas.width;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, s, s).data;
  const out = canvas(s);
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(s, s);
  const at = (x, y) => src[((((y + s) % s) * s + ((x + s) % s)) << 2)] / 255;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx;
      let ny = -dy;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len;
      const i = (y * s + x) << 2;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz / len) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/** 湿った黒土。高さマップも一緒に返す */
function soilCanvases(size = 512) {
  const c = canvas(size);
  const h = canvas(size);
  const ctx = c.getContext('2d');
  const hctx = h.getContext('2d');
  const img = ctx.createImageData(size, size);
  const himg = hctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const U = x / size;
      const V = y / size;
      const grain = fbmTile(U, V, 32, 3) * 0.5 + 0.5;
      const clumps = fbmTile(U + 1.7, V + 0.9, 8, 3) * 0.5 + 0.5;
      const damp = smoothstep(0.35, 0.72, fbmTile(U + 3.1, V + 2.3, 4, 2) * 0.5 + 0.5);
      // 濡れた黒土 -> やや乾いた茶
      let r = mix(26, 74, clumps) + grain * 26;
      let g = mix(19, 55, clumps) + grain * 20;
      let b = mix(13, 38, clumps) + grain * 14;
      // 湿り気の強いところは暗く沈む
      r = mix(r, r * 0.52, damp);
      g = mix(g, g * 0.5, damp);
      b = mix(b, b * 0.55, damp);
      // 小石
      const peb = fbmTile(U + 0.3, V + 0.5, 64, 2) * 0.5 + 0.5;
      if (peb > 0.78) {
        const k = (peb - 0.78) / 0.22;
        r = mix(r, 118, k * 0.75);
        g = mix(g, 110, k * 0.75);
        b = mix(b, 99, k * 0.75);
      }
      const i = (y * size + x) << 2;
      img.data[i] = clamp(r, 0, 255);
      img.data[i + 1] = clamp(g, 0, 255);
      img.data[i + 2] = clamp(b, 0, 255);
      img.data[i + 3] = 255;
      const hv = clamp((grain * 0.45 + clumps * 0.4 + (peb > 0.78 ? 0.35 : 0)) * 255, 0, 255);
      himg.data[i] = himg.data[i + 1] = himg.data[i + 2] = hv;
      himg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  hctx.putImageData(himg, 0, 0);
  return { color: c, height: h };
}

export function soilTexture() {
  return cached('soil', () => toTexture(soilCanvases().color, { repeat: 1 }));
}

export function soilNormalTexture() {
  return cached('soilN', () => {
    const t = toTexture(normalFromHeight(soilCanvases().height, 2.4), { srgb: false });
    return t;
  });
}

/** 地面: 土 + 苔 + こまかい落ち葉の破片 が混ざったマスターテクスチャ */
export function groundCanvases(size = 1024) {
  const c = canvas(size);
  const h = canvas(size);
  const ctx = c.getContext('2d');
  const hctx = h.getContext('2d');
  const img = ctx.createImageData(size, size);
  const himg = hctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const U = x / size;
      const V = y / size;
      const grain = fbmTile(U, V, 32, 3) * 0.5 + 0.5;
      const clumps = fbmTile(U + 1.4, V + 0.8, 8, 3) * 0.5 + 0.5;
      const damp = smoothstep(0.38, 0.75, fbmTile(U + 3.9, V + 2.4, 4, 2) * 0.5 + 0.5);
      let r = mix(28, 70, clumps) + grain * 22;
      let g = mix(21, 53, clumps) + grain * 17;
      let b = mix(14, 35, clumps) + grain * 12;
      r = mix(r, r * 0.5, damp); g = mix(g, g * 0.48, damp); b = mix(b, b * 0.54, damp);
      // 苔: 湿った窪みに、控えめに
      const moss = smoothstep(0.66, 0.94, (fbmTile(U + 7.6, V + 5.4, 16, 3) * 0.5 + 0.5) * 0.7 + damp * 0.42);
      if (moss > 0) {
        const mg = fbmTile(U + 0.2, V + 0.7, 32, 2) * 0.5 + 0.5;
        r = mix(r, 62 + mg * 26, moss * 0.85);
        g = mix(g, 82 + mg * 32, moss * 0.85);
        b = mix(b, 44 + mg * 20, moss * 0.85);
      }
      // 落ち葉のじゅうたん。細長い葉なので横に伸ばした模様にする
      const lf = fbmTile(U * 3 + 2.1, V + 1.3, 8, 4) * 0.5 + 0.5;
      const lf2 = fbmTile(U * 2 + 5.5, V + 4.4, 16, 3) * 0.5 + 0.5;
      const leafMask = Math.min(0.92, (smoothstep(0.36, 0.70, lf) * 0.62 + smoothstep(0.50, 0.80, lf2) * 0.42)) *
        (1 - moss * 0.75) * (1 - damp * 0.5);
      if (leafMask > 0) {
        const tone = fbmTile(U + 0.9, V + 0.4, 32, 2) * 0.5 + 0.5;
        const streak = fbmTile(U * 4 + 0.6, V, 8, 2) * 0.5 + 0.5;
        // 乾いた葉と、湿って黒ずんだ葉が入りまじる
        const wetLeaf = smoothstep(0.45, 0.85, damp + (tone - 0.5) * 0.4);
        r = mix(r, mix(112 + tone * 48 + streak * 16, 62 + tone * 22, wetLeaf), leafMask);
        g = mix(g, mix(87 + tone * 40 + streak * 12, 47 + tone * 17, wetLeaf), leafMask);
        b = mix(b, mix(52 + tone * 27 + streak * 8, 28 + tone * 11, wetLeaf), leafMask);
      }
      const i = (y * size + x) << 2;
      img.data[i] = clamp(r, 0, 255);
      img.data[i + 1] = clamp(g, 0, 255);
      img.data[i + 2] = clamp(b, 0, 255);
      img.data[i + 3] = 255;
      const hv = clamp((grain * 0.4 + clumps * 0.35 + leafMask * 0.5 + moss * 0.25) * 255, 0, 255);
      himg.data[i] = himg.data[i + 1] = himg.data[i + 2] = hv;
      himg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  hctx.putImageData(himg, 0, 0);
  return { color: c, height: h };
}

export function groundTexture(repeat = 10) {
  return cached('ground' + repeat, () => toTexture(groundCanvases().color, { repeat, aniso: 8 }));
}
export function groundNormalTexture(repeat = 10) {
  return cached('groundN' + repeat, () => {
    const t = toTexture(normalFromHeight(groundCanvases().height, 1.8), { repeat, srgb: false, aniso: 8 });
    return t;
  });
}

/** 竹の葉 1枚(アルファ付き)。落ち葉と樹冠の両方に使う */
export function leafTexture(kind = 'dry') {
  return cached('leaf' + kind, () => {
    const s = 128;
    const c = canvas(s, s);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, s, s);
    const palettes = {
      dry: ['#a68a56', '#8b6d41', '#6d5330'],
      wet: ['#5c482b', '#46341a', '#33260d'],
      green: ['#6f9243', '#5b7d35', '#496a2b'],
    };
    const pal = palettes[kind] || palettes.dry;
    // 細長い笹の葉
    const grad = ctx.createLinearGradient(0, 0, s, s);
    grad.addColorStop(0, pal[0]);
    grad.addColorStop(0.5, pal[1]);
    grad.addColorStop(1, pal[2]);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(s * 0.06, s * 0.5);
    ctx.quadraticCurveTo(s * 0.5, s * 0.13, s * 0.96, s * 0.44);
    ctx.quadraticCurveTo(s * 0.5, s * 0.87, s * 0.06, s * 0.5);
    ctx.fill();
    // 主脈
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(s * 0.08, s * 0.5);
    ctx.quadraticCurveTo(s * 0.5, s * 0.5, s * 0.94, s * 0.45);
    ctx.stroke();
    // 側脈と傷み
    ctx.strokeStyle = 'rgba(0,0,0,0.13)';
    ctx.lineWidth = 0.9;
    for (let i = 1; i < 9; i++) {
      const t = i / 9;
      const x = mix(s * 0.1, s * 0.9, t);
      ctx.beginPath();
      ctx.moveTo(x, s * 0.5);
      ctx.lineTo(x + s * 0.06, s * (0.5 - 0.13 * (1 - Math.abs(t - 0.5) * 1.4)));
      ctx.moveTo(x, s * 0.5);
      ctx.lineTo(x + s * 0.06, s * (0.5 + 0.13 * (1 - Math.abs(t - 0.5) * 1.4)));
      ctx.stroke();
    }
    // 汚れ
    const rng = makeRng(kind.length * 977 + 3);
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = rng() < 0.5 ? '#3a2c17' : '#d8c493';
      const r = rng.range(1, 4.5);
      ctx.beginPath();
      ctx.arc(rng.range(s * 0.1, s * 0.9), rng.range(s * 0.32, s * 0.68), r, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  });
}

/** 樹冠用の葉のかたまり */
export function canopyTexture() {
  return cached('canopy', () => {
    const s = 256;
    const c = canvas(s);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, s, s);
    const rng = makeRng(4242);
    for (let i = 0; i < 130; i++) {
      const cx = rng.range(0, s);
      const cy = rng.range(0, s);
      const len = rng.range(18, 52);
      const wid = rng.range(3.5, 7.5);
      const ang = rng.range(-Math.PI, Math.PI);
      const g = rng.range(0, 1);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = `rgba(${Math.floor(mix(72, 132, g))},${Math.floor(mix(104, 158, g))},${Math.floor(mix(46, 74, g))},${rng.range(0.72, 1)})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, len / 2, wid / 2, 0, 0, 7);
      ctx.fill();
      ctx.restore();
    }
    // 端をやわらかく
    const img = ctx.getImageData(0, 0, s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const d = Math.hypot(x / s - 0.5, y / s - 0.5) * 2;
        const f = 1 - smoothstep(0.72, 1.0, d);
        const i = (y * s + x) << 2;
        img.data[i + 3] *= f;
      }
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  });
}

/** 下草の笹。樹冠より明るく、細長い葉のかたまり */
export function sasaTexture() {
  return cached('sasa', () => {
    const s = 256;
    const c = canvas(s);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, s, s);
    const rng = makeRng(7331);
    for (let i = 0; i < 46; i++) {
      const baseX = rng.range(s * 0.15, s * 0.85);
      const ang = rng.range(-1.5, 1.5) * 0.55 - Math.PI / 2;
      const len = rng.range(s * 0.34, s * 0.72);
      const wid = rng.range(7, 14);
      const g = rng.range(0, 1);
      ctx.save();
      ctx.translate(baseX, s * 0.97);
      ctx.rotate(ang + Math.PI / 2);
      const grad = ctx.createLinearGradient(0, 0, len, 0);
      grad.addColorStop(0, `rgb(${Math.floor(mix(78, 104, g))},${Math.floor(mix(112, 146, g))},${Math.floor(mix(52, 70, g))})`);
      grad.addColorStop(1, `rgb(${Math.floor(mix(126, 168, g))},${Math.floor(mix(160, 196, g))},${Math.floor(mix(86, 116, g))})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(len * 0.5, -wid, len, rng.range(-6, 6));
      ctx.quadraticCurveTo(len * 0.5, wid * 0.55, 0, 0);
      ctx.fill();
      ctx.restore();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  });
}

/** 竹の稈(かん) */
export function bambooTexture() {
  return cached('bamboo', () => {
    const w = 128;
    const hgt = 512;
    const c = canvas(w, hgt);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, hgt);
    for (let y = 0; y < hgt; y++) {
      for (let x = 0; x < w; x++) {
        const U = x / w;
        const V = y / hgt;
        // 縦すじが出るよう、縦方向だけ細かく
        const streak = fbmTile(U * 2 + 0.4, V * 16, 4, 3) * 0.5 + 0.5;
        const patina = fbmTile(U + 2.6, V * 2 + 0.6, 4, 3) * 0.5 + 0.5;
        // 若い竹の緑 <-> 数年たった黄緑
        let r = mix(104, 152, patina) + streak * 16;
        let g = mix(126, 160, patina) + streak * 14;
        let b = mix(72, 96, patina) + streak * 10;
        // 白い粉(ろう質)
        const bloom = smoothstep(0.62, 0.9, fbmTile(U + 8.8, V * 3 + 1.6, 8, 2) * 0.5 + 0.5);
        r = mix(r, 196, bloom * 0.42);
        g = mix(g, 199, bloom * 0.42);
        b = mix(b, 172, bloom * 0.42);
        // 地衣類のしみ
        const lichen = smoothstep(0.72, 0.9, fbmTile(U + 16.3, V * 4 + 11.3, 16, 2) * 0.5 + 0.5);
        r = mix(r, 176, lichen * 0.6);
        g = mix(g, 180, lichen * 0.6);
        b = mix(b, 160, lichen * 0.6);
        const i = (y * w + x) << 2;
        img.data[i] = clamp(r, 0, 255);
        img.data[i + 1] = clamp(g, 0, 255);
        img.data[i + 2] = clamp(b, 0, 255);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  });
}

/** たけのこの皮 */
export function huskTexture() {
  return cached('husk', () => {
    const w = 256;
    const hgt = 512;
    const c = canvas(w, hgt);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, hgt);
    for (let y = 0; y < hgt; y++) {
      for (let x = 0; x < w; x++) {
        const U = x / w;
        const V = y / hgt;
        const t = y / hgt; // 0 = 先端側, 1 = 根元側
        // 皮の繊維は縦に流れる
        const fiber = fbmTile(U * 3 + 0.2, V * 24, 8, 3) * 0.5 + 0.5;
        const blotch = fbmTile(U * 2 + 2.1, V * 2 + 4.1, 8, 3) * 0.5 + 0.5;
        // 先端の濃い茶 -> 根元の黄土色
        const base = smoothstep(0.06, 0.92, t);
        let r = mix(58, 228, base) + (fiber - 0.5) * 38 + (blotch - 0.5) * 25;
        let g = mix(48, 200, base) + (fiber - 0.5) * 30 + (blotch - 0.5) * 20;
        let b = mix(26, 146, base) + (fiber - 0.5) * 18 + (blotch - 0.5) * 13;
        // いちばん先はさらに濃い緑茶色
        const capK = 1 - smoothstep(0.0, 0.16, t);
        r = mix(r, 44, capK * 0.8); g = mix(g, 46, capK * 0.8); b = mix(b, 24, capK * 0.8);
        // 濃い斑点
        const spot = smoothstep(0.76, 0.93, fbmTile(U * 2 + 0.4, V * 4 + 7.6, 16, 2) * 0.5 + 0.5);
        r = mix(r, 62, spot * 0.7); g = mix(g, 40, spot * 0.7); b = mix(b, 22, spot * 0.7);
        const i = (y * w + x) << 2;
        img.data[i] = clamp(r, 0, 255);
        img.data[i + 1] = clamp(g, 0, 255);
        img.data[i + 2] = clamp(b, 0, 255);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // 根元の赤いぶつぶつ(たけのこらしさが出る)
    const rng = makeRng(8181);
    for (let i = 0; i < 90; i++) {
      const y = hgt * rng.range(0.80, 0.995);
      const x = rng.range(0, w);
      const rr = rng.range(1.6, 4.2);
      ctx.fillStyle = `rgba(${Math.floor(rng.range(150, 196))},${Math.floor(rng.range(58, 92))},${Math.floor(rng.range(40, 62))},${rng.range(0.4, 0.8)})`;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, 7);
      ctx.fill();
    }
    // 皮の毛
    ctx.strokeStyle = 'rgba(48,32,16,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 420; i++) {
      const x = rng.range(0, w);
      const y = rng.range(0, hgt);
      const len = rng.range(3, 11);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + rng.range(-2, 2), y - len);
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  });
}

/** 掘った断面に見える土の層 */
export function strataTexture() {
  return cached('strata', () => {
    const size = 512;
    const c = canvas(size);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const t = y / size; // 0 = 地表, 1 = 深いところ
        const U = x / size;
        const V = y / size;
        const n = fbmTile(U, V, 32, 3) * 0.5 + 0.5;
        const wob = fbmTile(U + 1.1, V + 0.4, 8, 2) * 0.06;
        const layer = clamp(t + wob, 0, 1);
        let r, g, b;
        if (layer < 0.10) { r = 104; g = 84; b = 52; }        // 落ち葉のたまった層
        else if (layer < 0.17) { r = 74; g = 56; b = 34; }    // 腐葉土
        else if (layer < 0.46) { r = 52; g = 37; b = 24; }    // 黒くしめった土
        else { const k = (layer - 0.46) / 0.54; r = mix(78, 122, k); g = mix(58, 94, k); b = mix(38, 62, k); }
        r += (n - 0.5) * 30; g += (n - 0.5) * 23; b += (n - 0.5) * 16;
        const peb = fbmTile(U + 0.9, V + 0.2, 48, 2) * 0.5 + 0.5;
        if (peb > 0.8) { const k = (peb - 0.8) / 0.2; r = mix(r, 124, k * 0.8); g = mix(g, 116, k * 0.8); b = mix(b, 104, k * 0.8); }
        const i = (y * size + x) << 2;
        img.data[i] = clamp(r, 0, 255);
        img.data[i + 1] = clamp(g, 0, 255);
        img.data[i + 2] = clamp(b, 0, 255);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // 根
    // 竹の根。細くて、ゆるやかに曲がる
    const rng = makeRng(313);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = `rgba(${Math.floor(rng.range(96, 134))},${Math.floor(rng.range(74, 102))},${Math.floor(rng.range(46, 66))},${rng.range(0.25, 0.5)})`;
      ctx.lineWidth = rng.range(0.9, 2.4);
      let x = rng.range(0, size);
      let y = rng.range(size * 0.12, size);
      let a = rng.range(-0.5, 0.5);
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 9; k++) {
        a += rng.range(-0.35, 0.35);
        const len = rng.range(10, 26);
        x += Math.cos(a) * len;
        y += Math.sin(a) * len * 0.5 + rng.range(0, 5);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    return toTexture(c, { repeat: 1 });
  });
}

/** 地面のひび割れ(あやしい場所のヒント) */
export function crackTexture() {
  return cached('crack', () => {
    const s = 256;
    const c = canvas(s);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, s, s);
    const rng = makeRng(9099);
    ctx.lineCap = 'round';
    const cx = s / 2;
    const cy = s / 2;
    for (let i = 0; i < 9; i++) {
      const a0 = (i / 9) * Math.PI * 2 + rng.range(-0.3, 0.3);
      let x = cx + Math.cos(a0) * rng.range(6, 16);
      let y = cy + Math.sin(a0) * rng.range(6, 16);
      let a = a0;
      ctx.strokeStyle = 'rgba(14,9,5,0.85)';
      ctx.lineWidth = rng.range(2.4, 4.6);
      ctx.beginPath();
      ctx.moveTo(x, y);
      const steps = rng.int(4, 7);
      for (let k = 0; k < steps; k++) {
        a += rng.range(-0.45, 0.45);
        const len = rng.range(9, 20);
        x += Math.cos(a) * len;
        y += Math.sin(a) * len;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      // 割れの縁の明るい土
      ctx.strokeStyle = 'rgba(150,124,84,0.30)';
      ctx.lineWidth = rng.range(5, 9);
      ctx.stroke();
    }
    // 外側をフェード
    const img = ctx.getImageData(0, 0, s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const d = Math.hypot(x / s - 0.5, y / s - 0.5) * 2;
        const i = (y * s + x) << 2;
        img.data[i + 3] *= 1 - smoothstep(0.55, 0.98, d);
      }
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  });
}

/** やわらかい円形グラデーション(影・光・ヒントリング) */
export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', power = 1) {
  return cached('radial' + inner + outer + power, () => {
    const s = 128;
    const c = canvas(s);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      g.addColorStop(t, i === 0 ? inner : i === 8 ? outer : mixCss(inner, outer, Math.pow(t, power)));
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  });
}

function parseCss(s) {
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) return [255, 255, 255, 1];
  const p = m[1].split(',').map((v) => parseFloat(v));
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
}
function mixCss(a, b, t) {
  const A = parseCss(a);
  const B = parseCss(b);
  return `rgba(${Math.round(mix(A[0], B[0], t))},${Math.round(mix(A[1], B[1], t))},${Math.round(mix(A[2], B[2], t))},${mix(A[3], B[3], t).toFixed(3)})`;
}

/** 木漏れ日のすじ */
export function shaftTexture() {
  return cached('shaft', () => {
    const w = 64;
    const h = 256;
    const c = canvas(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const v = y / h;
        const edge = Math.sin(u * Math.PI);
        const fade = (1 - smoothstep(0.35, 1.0, v)) * smoothstep(0.0, 0.16, v);
        const n = noise2(u * 5, v * 9) * 0.5 + 0.5;
        const a = Math.pow(edge, 2.1) * fade * (0.55 + n * 0.45);
        const i = (y * w + x) << 2;
        img.data[i] = 255;
        img.data[i + 1] = 250;
        img.data[i + 2] = 226;
        img.data[i + 3] = clamp(a * 255, 0, 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  });
}

/** 竹かごの編み目 */
export function basketTexture() {
  return cached('basket', () => {
    const s = 256;
    const c = canvas(s);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#a3814c';
    ctx.fillRect(0, 0, s, s);
    const n = 8;
    const step = s / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const over = (i + j) % 2 === 0;
        const x = i * step;
        const y = j * step;
        const g = ctx.createLinearGradient(x, y, x + step, y + step);
        g.addColorStop(0, over ? '#c7a468' : '#8a6a3c');
        g.addColorStop(0.5, over ? '#dcbc80' : '#7a5c32');
        g.addColorStop(1, over ? '#b08a52' : '#6d5029');
        ctx.fillStyle = g;
        if (over) ctx.fillRect(x + 1, y + step * 0.16, step - 2, step * 0.68);
        else ctx.fillRect(x + step * 0.16, y + 1, step * 0.68, step - 2);
      }
    }
    ctx.fillStyle = 'rgba(40,26,12,0.22)';
    for (let i = 0; i < 300; i++) {
      ctx.fillRect(Math.random() * s, Math.random() * s, Math.random() * 3, Math.random() * 3);
    }
    return toTexture(c, { repeat: 1 });
  });
}

export function disposeTextureCache() {
  for (const t of cache.values()) if (t && t.dispose) t.dispose();
  cache.clear();
}
