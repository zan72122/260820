// ---------------------------------------------------------------------------
// 手続き生成テクスチャ。外部ファイルを一切ダウンロードしないので初期表示が速い。
// すべて Canvas2D で作り、CanvasTexture として返す。
// ---------------------------------------------------------------------------
import * as THREE from '../vendor/three/three.module.min.js';

export function makeRng(seed) {
  let s = (seed | 0) || 1;
  return () => {
    s ^= s << 13; s |= 0;
    s ^= s >>> 17;
    s ^= s << 5; s |= 0;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** 値ノイズ（フラクタル） */
function fbm(rng, w, h, octaves, base) {
  const out = new Float32Array(w * h);
  let amp = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    const gw = Math.max(2, Math.round(base * Math.pow(2, o)));
    const gh = Math.max(2, Math.round((base * h / w) * Math.pow(2, o)));
    const grid = new Float32Array(gw * gh);
    for (let i = 0; i < grid.length; i++) grid[i] = rng();
    for (let y = 0; y < h; y++) {
      const fy = (y / h) * gh, y0 = Math.floor(fy) % gh, y1 = (y0 + 1) % gh, ty = fy - Math.floor(fy);
      for (let x = 0; x < w; x++) {
        const fx = (x / w) * gw, x0 = Math.floor(fx) % gw, x1 = (x0 + 1) % gw, tx = fx - Math.floor(fx);
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const a = grid[y0 * gw + x0] * (1 - sx) + grid[y0 * gw + x1] * sx;
        const b = grid[y1 * gw + x0] * (1 - sx) + grid[y1 * gw + x1] * sx;
        out[y * w + x] += (a * (1 - sy) + b * sy) * amp;
      }
    }
    norm += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

/** 濡れた古い木の縁台 */
export function makeWood(seed = 7) {
  const w = 512, h = 512;
  const rng = makeRng(seed);
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const grain = fbm(rng, w, h, 4, 3);
  const blotch = fbm(makeRng(seed + 91), w, h, 3, 2);
  const img = ctx.createImageData(w, h);
  const plankH = h / 4;
  for (let y = 0; y < h; y++) {
    const plank = Math.floor(y / plankH);
    const plankTint = 0.88 + ((plank * 37) % 10) / 40;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      // 木目: x 方向へ引き伸ばしたノイズ + 年輪状のうねり
      const wave = Math.sin((y * 0.35 + grain[i] * 26 + plank * 13) * 1.0) * 0.5 + 0.5;
      const g = wave * 0.45 + grain[i] * 0.55;
      const line = Math.pow(g, 3.0);
      let r = 146, gg = 108, b = 72;
      const dark = 0.62 + 0.38 * (1 - line);
      const wet = Math.pow(blotch[i], 2.2) * 0.55; // 濡れて濃くなった部分
      const k = dark * plankTint * (1 - wet * 0.45);
      r *= k; gg *= k * 0.99; b *= k * 0.95;
      // 板の継ぎ目
      const edge = Math.min(y % plankH, plankH - (y % plankH));
      if (edge < 2.5) { const e = 0.35 + edge / 8; r *= e; gg *= e; b *= e; }
      const o = i * 4;
      img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;

  // ラフネス: 濡れた部分をつるつるに
  const c2 = canvas(w, h);
  const ctx2 = c2.getContext('2d');
  const img2 = ctx2.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const wet = Math.pow(blotch[i], 2.2);
    const v = (0.92 - wet * 0.62 + grain[i] * 0.08) * 255;
    const o = i * 4;
    img2.data[o] = img2.data[o + 1] = img2.data[o + 2] = v;
    img2.data[o + 3] = 255;
  }
  ctx2.putImageData(img2, 0, 0);
  const rough = new THREE.CanvasTexture(c2);
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  return { map, rough };
}

/** 瓶表面の結露（ラフネスの揺らぎとして使う。個体ごとに模様が変わる） */
export function makeCondensation(seed = 3) {
  const w = 256, h = 256;
  const rng = makeRng(seed);
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(0, 0, w, h);
  // 細かい曇り
  const n = fbm(rng, w, h, 4, 6);
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < w * h; i++) {
    const v = (0.55 + n[i] * 0.45) * 255;
    const o = i * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  // 大きめの水滴が流れた跡（つるつる = 暗い）
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 26; i++) {
    const x = rng() * w, y = rng() * h * 0.9;
    const len = 8 + rng() * 60, wd = 1.5 + rng() * 3.5;
    const g = ctx.createLinearGradient(x, y, x, y + len);
    g.addColorStop(0, 'rgba(40,40,40,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y + len / 2, wd, len / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** 炭酸の泡スプライト（縁が明るい小球） */
export function makeBubbleSprite() {
  const s = 64;
  const c = canvas(s, s);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s * 0.42, s * 0.38, s * 0.04, s * 0.5, s * 0.5, s * 0.5);
  g.addColorStop(0.00, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, 'rgba(235,255,252,0.30)');
  g.addColorStop(0.72, 'rgba(210,248,244,0.10)');
  g.addColorStop(0.88, 'rgba(255,255,255,0.72)');
  g.addColorStop(1.00, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  return t;
}

/** 泡（フォーム）のアルファ */
export function makeFoam(seed = 11) {
  const s = 128;
  const rng = makeRng(seed);
  const c = canvas(s, s);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, s, s);
  for (let i = 0; i < 260; i++) {
    const a = rng() * Math.PI * 2, rr = Math.pow(rng(), 0.6) * s * 0.47;
    const x = s / 2 + Math.cos(a) * rr, y = s / 2 + Math.sin(a) * rr;
    const r = 2 + rng() * 7 * (1 - rr / (s * 0.5));
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.7, 'rgba(248,255,254,0.55)');
    g.addColorStop(1, 'rgba(230,250,248,0.0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}

/** ふわっと光るリング（ヒント用。文字を使わない誘導） */
export function makeGlow() {
  const s = 128;
  const c = canvas(s, s);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.18, s / 2, s / 2, s * 0.5);
  g.addColorStop(0.0, 'rgba(255,255,255,0.0)');
  g.addColorStop(0.55, 'rgba(255,252,225,0.55)');
  g.addColorStop(0.75, 'rgba(255,245,200,0.28)');
  g.addColorStop(1.0, 'rgba(255,245,200,0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(c);
}

/** 遠景（夏空・木々・暖簾）。低解像度で描いて拡大することで自然にボケる。 */
export function makeBackdrop(seed = 5) {
  const sw = 128, sh = 72;
  const rng = makeRng(seed);
  const small = canvas(sw, sh);
  const sc = small.getContext('2d');
  // 上 1/3 が空、真ん中に地平、下は地面。カメラの目線が v=0.42 あたりに来る。
  const sky = sc.createLinearGradient(0, 0, 0, sh * 0.46);
  sky.addColorStop(0.00, '#2e79cf');
  sky.addColorStop(0.55, '#8dc4ea');
  sky.addColorStop(1.00, '#e2ecdf');
  sc.fillStyle = sky; sc.fillRect(0, 0, sw, sh * 0.47);
  // 入道雲
  for (let i = 0; i < 34; i++) {
    const x = rng() * sw, y = sh * (0.03 + rng() * 0.26), r = 2 + rng() * 7;
    sc.fillStyle = `rgba(255,255,255,${0.30 + rng() * 0.55})`;
    sc.beginPath(); sc.arc(x, y, r, 0, Math.PI * 2); sc.fill();
  }
  // 地面（日に灼けた土）
  const gr = sc.createLinearGradient(0, sh * 0.44, 0, sh);
  gr.addColorStop(0, '#b8a982');
  gr.addColorStop(1, '#8d7f5f');
  sc.fillStyle = gr; sc.fillRect(0, sh * 0.44, sw, sh * 0.56);
  // 木々（地平線の帯として低く）
  for (let i = 0; i < 90; i++) {
    const x = rng() * sw;
    const y = sh * (0.36 + rng() * 0.10);
    const r = 2.5 + rng() * 7;
    const g = 108 + rng() * 46;
    sc.fillStyle = `rgba(${72 + rng() * 26},${g},${76 + rng() * 24},0.85)`;
    sc.beginPath(); sc.arc(x, y, r, 0, Math.PI * 2); sc.fill();
  }
  // 屋台の暖簾と提灯
  sc.fillStyle = 'rgba(186,58,48,0.92)';
  sc.fillRect(sw * 0.04, sh * 0.36, sw * 0.26, sh * 0.09);
  sc.fillStyle = 'rgba(242,238,228,0.92)';
  sc.fillRect(sw * 0.04, sh * 0.405, sw * 0.26, sh * 0.02);
  sc.fillStyle = 'rgba(52,74,140,0.8)';
  sc.fillRect(sw * 0.74, sh * 0.37, sw * 0.22, sh * 0.075);
  for (let i = 0; i < 5; i++) {
    sc.fillStyle = 'rgba(238,204,124,0.95)';
    sc.beginPath(); sc.ellipse(sw * (0.40 + i * 0.05), sh * 0.335, 1.4, 2.0, 0, 0, Math.PI * 2); sc.fill();
  }

  // 低解像度 → 拡大 を 2 段かけて自然なボケにする
  const mid = canvas(sw * 3, sh * 3);
  const mc = mid.getContext('2d');
  mc.imageSmoothingEnabled = true; mc.imageSmoothingQuality = 'high';
  mc.drawImage(small, 0, 0, sw * 3, sh * 3);
  const w = 1024, h = 576;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mid, 0, 0, w, h);
  // 夏の光のにじみ
  // 夏の空気の靄（遠景を後ろへ下げる）
  ctx.fillStyle = 'rgba(226,236,238,0.30)';
  ctx.fillRect(0, 0, w, h);
  const sun = ctx.createRadialGradient(w * 0.74, h * 0.10, 4, w * 0.74, h * 0.10, h * 0.7);
  sun.addColorStop(0, 'rgba(255,251,228,0.9)');
  sun.addColorStop(0.35, 'rgba(255,247,214,0.24)');
  sun.addColorStop(1, 'rgba(255,242,205,0.0)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 接地感を出すための柔らかい影 */
export function makeContactShadow() {
  const s = 128;
  const c = canvas(s, s);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s * 0.5);
  g.addColorStop(0.0, 'rgba(30,26,20,0.62)');
  g.addColorStop(0.45, 'rgba(30,26,20,0.34)');
  g.addColorStop(1.0, 'rgba(30,26,20,0.0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(c);
}

/** 氷用のわずかな凹凸（ラフネス） */
export function makeIceRough(seed = 21) {
  const w = 128, h = 128;
  const rng = makeRng(seed);
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const n = fbm(rng, w, h, 3, 5);
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = (0.06 + Math.pow(n[i], 1.6) * 0.5) * 255;
    const o = i * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/**
 * ビー玉用の matcap。
 * ガラス球の見え方は「視線から見た法線」でほぼ決まるので、matcap 1 枚で
 * 屈折を計算せずに厚いガラス玉らしさが出る。周囲を反射する成分は
 * この上に重ねる MeshPhysical の殻が担当する。
 */
export function makeMarbleMatcap(tint = '#dff0ee') {
  const s = 256, h = s / 2;
  const c = canvas(s, s);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, s, s);
  ctx.save();
  ctx.beginPath(); ctx.arc(h, h, h, 0, Math.PI * 2); ctx.clip();

  // 芯: 中央は向こう側が縮んで映るので暗い
  const base = ctx.createRadialGradient(h, h, 2, h, h, h);
  // 透明なガラス玉は、真ん中に向こう側が縮んで映って明るく、
  // 縁の少し内側に全反射の暗い輪、いちばん外に細い明るい縁が出る。
  base.addColorStop(0.00, '#d8ecea');
  base.addColorStop(0.26, '#b6d8d6');
  base.addColorStop(0.50, '#7ba9aa');
  base.addColorStop(0.70, '#2f5257');
  base.addColorStop(0.84, '#0a1c20');
  base.addColorStop(0.92, '#173238');
  base.addColorStop(0.96, '#9fd6dc');
  base.addColorStop(0.99, '#f8ffff');
  base.addColorStop(1.00, '#cfe9e8');
  ctx.fillStyle = base; ctx.fillRect(0, 0, s, s);

  // 反転して映り込む地面と空
  const flip = ctx.createLinearGradient(0, s, 0, 0);
  flip.addColorStop(0.00, 'rgba(255,248,222,0.72)');
  flip.addColorStop(0.26, 'rgba(150,170,145,0.22)');
  flip.addColorStop(0.55, 'rgba(10,25,30,0.0)');
  flip.addColorStop(1.00, 'rgba(120,170,190,0.22)');
  ctx.fillStyle = flip; ctx.fillRect(0, 0, s, s);

  // 太陽のハイライト（左上）と、その反対側の小さな抜け
  const sp = ctx.createRadialGradient(s * 0.33, s * 0.28, 1, s * 0.33, s * 0.28, s * 0.20);
  sp.addColorStop(0, 'rgba(255,255,252,1)');
  sp.addColorStop(0.25, 'rgba(255,255,245,0.7)');
  sp.addColorStop(1, 'rgba(255,255,240,0)');
  ctx.fillStyle = sp; ctx.fillRect(0, 0, s, s);
  const sp2 = ctx.createRadialGradient(s * 0.66, s * 0.72, 1, s * 0.66, s * 0.72, s * 0.12);
  sp2.addColorStop(0, 'rgba(255,255,255,0.75)');
  sp2.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sp2; ctx.fillRect(0, 0, s, s);

  // ガラスの色味
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, s, s);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
