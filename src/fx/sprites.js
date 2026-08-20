// 事前レンダリングした発光スプライト。毎フレーム createRadialGradient しないための対策。
const cache = new Map();

function make(size, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [p, col] of stops) grd.addColorStop(p, col);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return c;
}

/**
 * 中心が白く飛び、外へ色が付く「火の粉」型の光。加算合成で使う。
 * 小さく描くときは小さい原版を使う（縮小の負荷を下げるため）。
 */
const cacheS = new Map();
export function glowSmall(r, g, b) {
  const key = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4);
  let s = cacheS.get(key);
  if (s) return s;
  s = make(16, [
    [0.00, `rgba(255,255,255,1)`],
    [0.16, `rgba(${Math.min(255, r * 0.4 + 155)},${Math.min(255, g * 0.4 + 155)},${Math.min(255, b * 0.4 + 155)},0.95)`],
    [0.36, `rgba(${r},${g},${b},0.5)`],
    [0.66, `rgba(${r},${g},${b},0.12)`],
    [1.00, `rgba(${r},${g},${b},0)`],
  ]);
  cacheS.set(key, s);
  return s;
}
export function glow(r, g, b) {
  const key = (r >> 3) << 10 | (g >> 3) << 5 | (b >> 3);
  let s = cache.get(key);
  if (s) return s;
  s = make(48, [
    [0.00, `rgba(255,255,255,1)`],
    [0.14, `rgba(${Math.min(255, r * 0.4 + 155)},${Math.min(255, g * 0.4 + 155)},${Math.min(255, b * 0.4 + 155)},0.95)`],
    [0.32, `rgba(${r},${g},${b},0.55)`],
    [0.62, `rgba(${r},${g},${b},0.14)`],
    [1.00, `rgba(${r},${g},${b},0)`],
  ]);
  cache.set(key, s);
  return s;
}

/** ふわっと広いハロー（水面のにじみ・空気中の散乱用） */
let _halo = null;
export function halo() {
  if (!_halo) _halo = make(128, [
    [0.0, 'rgba(255,255,255,0.55)'],
    [0.25, 'rgba(255,255,255,0.22)'],
    [0.55, 'rgba(255,255,255,0.06)'],
    [1.0, 'rgba(255,255,255,0)'],
  ]);
  return _halo;
}

/** 煙。輪郭を持たない、ごく柔らかい塊を数種類。丸が見えたら負け。 */
const puffs = [];
export function puff(i = 0) {
  if (puffs.length) return puffs[i % puffs.length];
  for (let v = 0; v < 4; v++) {
    const size = 160;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    let seed = 1234 + v * 977;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 26; i++) {
      const a = rnd() * 6.283;
      const rr = (rnd() ** 0.6) * size * 0.24;
      const cx = size / 2 + Math.cos(a) * rr, cy = size / 2 + Math.sin(a) * rr * 0.86;
      const rad = size * (0.16 + 0.20 * rnd());
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
      grd.addColorStop(0, 'rgba(255,255,255,0.055)');
      grd.addColorStop(0.35, 'rgba(255,255,255,0.030)');
      grd.addColorStop(0.7, 'rgba(255,255,255,0.008)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, size, size);
    }
    // 縁を確実に落とす（丸いふちが出ないように）
    const fade = g.createRadialGradient(size / 2, size / 2, size * 0.30, size / 2, size / 2, size * 0.5);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = fade; g.fillRect(0, 0, size, size);
    puffs.push(c);
  }
  return puffs[i % puffs.length];
}

/** 色を焼き込んだ煙。毎フレーム色を重ねるより塗り面積が半分で済む */
const tintCache = new Map();
export function puffTinted(r, g, b, variant) {
  const key = ((r >> 4) << 12 | (g >> 4) << 8 | (b >> 4) << 4 | (variant & 3)) >>> 0;
  let c = tintCache.get(key);
  if (c) return c;
  const src = puff(variant);
  c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g2 = c.getContext('2d');
  g2.drawImage(src, 0, 0);
  g2.globalCompositeOperation = 'source-in';
  g2.fillStyle = `rgb(${r},${g},${b})`;
  g2.fillRect(0, 0, c.width, c.height);
  tintCache.set(key, c);
  if (tintCache.size > 96) { const k = tintCache.keys().next().value; tintCache.delete(k); }
  return c;
}

/** ざらつき（バンディング防止と写真的な粒状感） */
let _grain = null;
export function grain() {
  if (_grain) return _grain;
  const n = 128;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  const img = g.createImageData(n, n);
  let s = 987654321;
  for (let i = 0; i < n * n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const v = 118 + ((s >>> 24) % 26);
    img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  _grain = c;
  return _grain;
}
