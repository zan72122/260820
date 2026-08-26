/**
 * 材質テクスチャは全て手続き生成する。色ではなく材質として読めることを狙い、
 * 色・粗さ・法線を同じ高さ場から一貫して作る。
 */
import * as THREE from 'three';
import { fbm, heightToNormal, makeValueNoise } from '../util/noise';
import { clamp, makeRng, smoothstep } from '../util/math';

export interface MatMaps {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

interface Sample {
  r: number;
  g: number;
  b: number;
  rough: number;
  h: number;
}

function buildMaps(
  w: number,
  h: number,
  repeat: [number, number],
  normalStrength: number,
  fn: (u: number, v: number, x: number, y: number) => Sample,
): MatMaps {
  const color = new ImageData(w, h);
  const rough = new ImageData(w, h);
  const height = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = fn(x / w, y / h, x, y);
      const i = (y * w + x) * 4;
      color.data[i] = clamp(s.r, 0, 1) * 255;
      color.data[i + 1] = clamp(s.g, 0, 1) * 255;
      color.data[i + 2] = clamp(s.b, 0, 1) * 255;
      color.data[i + 3] = 255;
      const rr = clamp(s.rough, 0, 1) * 255;
      rough.data[i] = rr;
      rough.data[i + 1] = rr;
      rough.data[i + 2] = rr;
      rough.data[i + 3] = 255;
      height[y * w + x] = s.h;
    }
  }
  const normal = heightToNormal(height, w, h, normalStrength);
  const mk = (img: ImageData, srgb: boolean): THREE.Texture => {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    cv.getContext('2d')!.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 4;
    return t;
  };
  return { map: mk(color, true), normalMap: mk(normal, false), roughnessMap: mk(rough, false) };
}

/* ── 竹 ─────────────────────────────────
   節、肉厚、縦方向の繊維、濡れ境界、支点付近の摩耗。
   v が管の長さ方向、u が周方向。 */
export function bambooMaps(seed: number, nodes: number[], wearV: number): MatMaps {
  const n1 = makeValueNoise(64, seed);
  const n2 = makeValueNoise(256, seed + 17);
  const fiber = makeValueNoise(512, seed + 41);
  return buildMaps(256, 512, [1, 1], 2.6, (u, v) => {
    // 地の色：黄緑から枯れた飴色まで、長さ方向でゆっくり変わる
    const age = fbm(n1, v * 3.1, u * 2.0, 3);
    let r = 0.62 + age * 0.16;
    let g = 0.60 + age * 0.10;
    let b = 0.36 + age * 0.06;
    // 縦の繊維（周方向に細かく、長さ方向へ伸びる）
    const fib = fiber(u * 190, v * 5) * 0.5 + fiber(u * 380, v * 2) * 0.5;
    const fibLine = (fib - 0.5) * 0.14;
    r += fibLine;
    g += fibLine * 0.95;
    b += fibLine * 0.6;
    let hgt = fib * 0.12;
    let rough = 0.62 + fib * 0.1;

    // 節：帯状のふくらみと、その上下の色差
    for (const nv of nodes) {
      const d = Math.abs(v - nv);
      const band = Math.exp(-(d * d) / (0.0009));
      const ridge = Math.exp(-(d * d) / (0.00016));
      hgt += ridge * 0.85;
      const dark = band * 0.16;
      r -= dark * 0.7;
      g -= dark * 0.75;
      b -= dark * 0.4;
      rough += band * 0.12;
      // 節の直下にある枝跡
      if (d < 0.02 && Math.abs(u - 0.32) < 0.03) {
        r -= 0.1;
        g -= 0.12;
        b -= 0.08;
      }
    }

    // 斑・傷・地衣
    const blotch = fbm(n2, v * 9, u * 5, 4);
    if (blotch > 0.66) {
      const k = (blotch - 0.66) * 2.1;
      r -= k * 0.16;
      g -= k * 0.12;
      b -= k * 0.06;
      rough += k * 0.12;
    }

    // 濡れ境界：水が通る内側〜口側は濡れて暗く滑らか
    const wet = smoothstep(0.42, 0.72, v) * (0.55 + 0.45 * fbm(n1, v * 6, u * 4, 3));
    r -= wet * 0.2;
    g -= wet * 0.19;
    b -= wet * 0.12;
    rough -= wet * 0.34;

    // 支点付近の摩耗（軸が当たり続けた跡）
    const wear = Math.exp(-Math.pow((v - wearV) / 0.045, 2));
    r -= wear * 0.14;
    g -= wear * 0.15;
    b -= wear * 0.1;
    rough += wear * 0.16;
    hgt -= wear * 0.35;

    return { r, g, b, rough: clamp(rough, 0.12, 0.95), h: hgt };
  });
}

/* ── 石 ─────────────────────────────────
   同じ丸石を並べない。打点には軽い摩耗を持たせる。 */
export function stoneMaps(seed: number, damp: number): MatMaps {
  const base = makeValueNoise(64, seed);
  const fine = makeValueNoise(256, seed + 7);
  const speck = makeValueNoise(512, seed + 23);
  return buildMaps(512, 512, [1, 1], 3.4, (u, v) => {
    const b = fbm(base, u * 4, v * 4, 4);
    const f = fbm(fine, u * 17, v * 17, 4);
    const grey = 0.34 + b * 0.2 + f * 0.12;
    let r = grey * (1.02 + b * 0.05);
    let g = grey * 1.0;
    let bl = grey * (0.96 + f * 0.05);
    // 長石・石英の粒
    const sp = speck(u * 300, v * 300);
    if (sp > 0.86) {
      const k = (sp - 0.86) * 5;
      r += k * 0.24;
      g += k * 0.23;
      bl += k * 0.2;
    }
    // 割れ目
    const crack = Math.abs(fbm(base, u * 6 + 3, v * 6, 3) - 0.5);
    const inCrack = smoothstep(0.05, 0.0, crack);
    r -= inCrack * 0.16;
    g -= inCrack * 0.16;
    bl -= inCrack * 0.15;
    // 湿り（下部・凹部）
    const wet = damp * smoothstep(0.35, 0.95, v) * (0.5 + 0.5 * f);
    r -= wet * 0.13;
    g -= wet * 0.13;
    bl -= wet * 0.11;
    const rough = clamp(0.85 - wet * 0.4 - (sp > 0.86 ? 0.1 : 0), 0.2, 0.98);
    const h = b * 0.7 + f * 0.5 - inCrack * 1.6 + (sp > 0.86 ? 0.3 : 0);
    return { r, g, b: bl, rough, h };
  });
}

/* ── 土 ─────────────────────────────────
   粒径、湿り、落ち葉、踏み固めの差。 */
export function soilMaps(seed: number): MatMaps {
  const grain = makeValueNoise(256, seed);
  const big = makeValueNoise(64, seed + 5);
  const litter = makeValueNoise(128, seed + 11);
  return buildMaps(512, 512, [6, 6], 2.2, (u, v) => {
    const g0 = fbm(grain, u * 40, v * 40, 3);
    const damp = fbm(big, u * 3, v * 3, 3);
    // 踏み固められた場所は滑らかで明るい
    const packed = smoothstep(0.55, 0.85, fbm(big, u * 2 + 9, v * 2, 2));
    let r = 0.23 + g0 * 0.14 + packed * 0.09;
    let g = 0.185 + g0 * 0.115 + packed * 0.075;
    let b = 0.135 + g0 * 0.075 + packed * 0.05;
    const wet = (1 - packed) * damp;
    r -= wet * 0.07;
    g -= wet * 0.055;
    b -= wet * 0.04;
    let rough = 0.95 - packed * 0.15 - wet * 0.2;
    let h = g0 * (1 - packed * 0.7);
    // 落ち葉
    const lf = litter(u * 26, v * 26);
    if (lf > 0.9) {
      const k = (lf - 0.9) * 10;
      r += k * 0.2;
      g += k * 0.12;
      b += k * 0.02;
      rough += k * 0.05;
      h += k * 0.4;
    }
    return { r, g, b, rough: clamp(rough, 0.3, 1), h };
  });
}

/* ── 木（樋・水門・支柱） ─────────────────── */
export function woodMaps(seed: number, tone: number): MatMaps {
  const grain = makeValueNoise(256, seed);
  const knot = makeValueNoise(64, seed + 3);
  return buildMaps(256, 256, [1, 1], 2.4, (u, v) => {
    // 年輪に近い縞を長さ方向へ
    const warp = fbm(grain, u * 3, v * 3, 3) * 0.6;
    const rings = Math.sin((u * 13 + warp * 4) * Math.PI * 2) * 0.5 + 0.5;
    const line = Math.pow(rings, 3);
    let r = 0.34 * tone + line * 0.1;
    let g = 0.27 * tone + line * 0.075;
    let b = 0.2 * tone + line * 0.05;
    // 風化した灰色
    const weather = fbm(knot, u * 5, v * 5, 3);
    r = r * (1 - weather * 0.35) + weather * 0.24;
    g = g * (1 - weather * 0.35) + weather * 0.235;
    b = b * (1 - weather * 0.35) + weather * 0.215;
    // 節
    const kd = Math.hypot(u - 0.72, v - 0.31);
    const kn = smoothstep(0.075, 0.01, kd);
    r -= kn * 0.13;
    g -= kn * 0.11;
    b -= kn * 0.08;
    const rough = clamp(0.82 + line * 0.08 - kn * 0.1, 0.35, 0.98);
    const h = line * 0.5 + weather * 0.3 - kn * 0.8;
    return { r, g, b, rough, h };
  });
}

/* ── 苔 ─────────────────────────────────
   面を緑で覆わない。湿潤域・日陰・石の凹部にだけ置く。 */
export function mossMaps(seed: number): MatMaps {
  const clump = makeValueNoise(64, seed);
  const fine = makeValueNoise(256, seed + 9);
  return buildMaps(256, 256, [1, 1], 3.0, (u, v) => {
    const c = fbm(clump, u * 5, v * 5, 4);
    const f = fbm(fine, u * 30, v * 30, 3);
    const lum = 0.5 + c * 0.45 + f * 0.3;
    const r = 0.115 * lum + f * 0.045;
    const g = 0.2 * lum + f * 0.07;
    const b = 0.075 * lum + f * 0.025;
    return { r, g, b, rough: clamp(0.93 - f * 0.1, 0.5, 1), h: f * 0.8 + c * 0.4 };
  });
}

/** 苔の生える範囲を決めるアルファ（不規則、左右対称にしない） */
export function mossAlpha(seed: number): THREE.Texture {
  const w = 256;
  const n = makeValueNoise(64, seed);
  const fine = makeValueNoise(128, seed + 3);
  const img = new ImageData(w, w);
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / w;
      // 下側・凹部ほど生えやすい、という偏りを持たせる
      let a = fbm(n, u * 3.4 + 1.7, v * 3.4, 4) * 1.35 - 0.45;
      a *= smoothstep(0.0, 0.55, v);
      a -= fbm(fine, u * 12, v * 12, 3) * 0.25;
      const k = clamp(a * 2.2, 0, 1);
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = k * 255;
    }
  }
  const cv = document.createElement('canvas');
  cv.width = cv.height = w;
  cv.getContext('2d')!.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* ── 葉（前景の薄い葉に透過光を出す） ────────── */
export function leafTexture(seed: number): { map: THREE.Texture; alpha: THREE.Texture } {
  const w = 128;
  const h = 128;
  const rng = makeRng(seed);
  const n = makeValueNoise(64, seed + 2);
  const color = new ImageData(w, h);
  const alpha = new ImageData(w, h);
  const tint = 0.85 + rng() * 0.3;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      // 単葉の形（先が尖った楕円）
      const cx = 0.5;
      const width = 0.34 * Math.sin(Math.PI * Math.pow(v, 0.75)) * (1 - Math.pow(v, 3) * 0.4);
      const d = Math.abs(u - cx);
      const inside = d < width;
      const i = (y * w + x) * 4;
      const vein = Math.exp(-Math.pow((d % 0.09) / 0.012, 2)) * 0.5 + Math.exp(-Math.pow(d / 0.008, 2));
      const shade = 0.75 + fbm(n, u * 6, v * 6, 3) * 0.45;
      color.data[i] = (0.15 * shade * tint + vein * 0.06) * 255;
      color.data[i + 1] = (0.27 * shade * tint + vein * 0.09) * 255;
      color.data[i + 2] = (0.11 * shade * tint + vein * 0.04) * 255;
      color.data[i + 3] = 255;
      const a = inside ? clamp((width - d) / 0.04, 0, 1) : 0;
      alpha.data[i] = alpha.data[i + 1] = alpha.data[i + 2] = a * 255;
      alpha.data[i + 3] = 255;
    }
  }
  const mk = (img: ImageData, srgb: boolean): THREE.Texture => {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    cv.getContext('2d')!.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return t;
  };
  return { map: mk(color, true), alpha: mk(alpha, false) };
}

/* ── 樹皮 ───────────────────────────────── */
export function barkMaps(seed: number): MatMaps {
  const n = makeValueNoise(128, seed);
  const f = makeValueNoise(256, seed + 4);
  return buildMaps(256, 256, [2, 3], 2.8, (u, v) => {
    const ridge = Math.abs(fbm(n, u * 9, v * 2.4, 4) - 0.5) * 2;
    const grit = fbm(f, u * 30, v * 18, 3);
    const lum = 0.24 + ridge * 0.18 + grit * 0.1;
    return {
      r: lum * 1.03,
      g: lum * 0.97,
      b: lum * 0.88,
      rough: clamp(0.9 - grit * 0.1, 0.5, 1),
      h: (1 - ridge) * 0.9 + grit * 0.3,
    };
  });
}
