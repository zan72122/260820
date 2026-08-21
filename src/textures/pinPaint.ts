import type * as THREE from 'three';
import { uniform, type Rng } from '../util/rng';
import { colorTexture, dataTexture, gray, makeCanvas } from './canvas';

export interface PinMaps {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

/**
 * ピン表面。v=0が底、v=1が頭頂（ジオメトリ側で高さ線形にUV化する前提）。
 * 摩耗は「使われ方」由来: 腹の被弾帯に集中、円周方向に非対称、赤帯は縁が欠ける。
 */
export function buildPinMaps(rng: Rng, fast: boolean): PinMaps {
  const w = fast ? 128 : 512;
  const h = fast ? 256 : 1024;
  const c = makeCanvas(w, h);
  const { ctx } = c;
  const vToY = (v: number): number => h * (1 - v);
  const hInToY = (hin: number): number => vToY(hin / 15);

  // 基調: 表面素材（サーリン）のわずかに暖かい白
  const grad = ctx.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0, '#ddd4c2'); // 底は経年の黄ばみ＋汚れ
  grad.addColorStop(0.12, '#efe9dc');
  grad.addColorStop(0.4, '#f4f0e6');
  grad.addColorStop(1, '#f2eee4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 成形時のごく薄い縦ムラ
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = rng() < 0.5 ? `rgba(255,255,255,${uniform(rng, 0.02, 0.05)})` : `rgba(120,110,90,${uniform(rng, 0.015, 0.04)})`;
    ctx.fillRect(uniform(rng, 0, w), 0, uniform(rng, 1, 4), h);
  }

  // 赤帯2本（ネック下）: 太11.0-11.7in / 細12.0-12.25in
  const stripe = (y0in: number, y1in: number): void => {
    const y1 = hInToY(y0in);
    const y0 = hInToY(y1in);
    ctx.fillStyle = '#a8232b';
    ctx.fillRect(0, y0, w, y1 - y0);
    // 帯の縁欠け・かすれ
    for (let i = 0; i < (fast ? 20 : 90); i++) {
      const x = uniform(rng, 0, w);
      const nearTop = rng() < 0.5;
      const y = nearTop ? y0 + uniform(rng, -1.5, 2.5) : y1 + uniform(rng, -2.5, 1.5);
      ctx.fillStyle = `rgba(244,240,230,${uniform(rng, 0.25, 0.7)})`;
      ctx.beginPath();
      ctx.ellipse(x, y, uniform(rng, 0.6, 2.4), uniform(rng, 0.4, 1.2), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // 帯上の水平すり傷
    for (let i = 0; i < (fast ? 6 : 26); i++) {
      const y = uniform(rng, y0, y1);
      ctx.strokeStyle = `rgba(240,236,226,${uniform(rng, 0.1, 0.35)})`;
      ctx.lineWidth = uniform(rng, 0.4, 1);
      const x = uniform(rng, 0, w);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + uniform(rng, 6, 30), y + uniform(rng, -1, 1));
      ctx.stroke();
    }
  };
  stripe(11.0, 11.7);
  stripe(12.0, 12.25);

  // 腹の被弾帯（2〜6in）: ボール・ピン同士の当たり傷。円周の一部に偏らせる
  const hotCenter = uniform(rng, 0, w);
  const marks = fast ? 40 : 200;
  for (let i = 0; i < marks; i++) {
    // 60%はホットゾーン周辺、残りは全周
    const biased = rng() < 0.6;
    let x = biased ? hotCenter + uniform(rng, -w * 0.22, w * 0.22) : uniform(rng, 0, w);
    x = ((x % w) + w) % w;
    const y = hInToY(uniform(rng, 2, 6.2) + (rng() < 0.15 ? uniform(rng, 1, 3) : 0));
    const dark = rng() < 0.7;
    ctx.strokeStyle = dark
      ? `rgba(72,62,52,${uniform(rng, 0.08, 0.28)})`
      : `rgba(140,128,110,${uniform(rng, 0.1, 0.25)})`;
    ctx.lineWidth = uniform(rng, 0.5, 2.2);
    ctx.beginPath();
    const len = uniform(rng, 4, 22);
    const ang = uniform(rng, -0.35, 0.35); // ほぼ水平の擦過
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }
  // 点状の打痕
  for (let i = 0; i < (fast ? 12 : 70); i++) {
    const x = uniform(rng, 0, w);
    const y = hInToY(uniform(rng, 1.2, 7));
    ctx.fillStyle = `rgba(60,52,44,${uniform(rng, 0.08, 0.2)})`;
    ctx.beginPath();
    ctx.arc(x, y, uniform(rng, 0.5, 1.8), 0, Math.PI * 2);
    ctx.fill();
  }
  // 底の汚れリング
  ctx.fillStyle = 'rgba(70,60,48,0.35)';
  ctx.fillRect(0, hInToY(0.35), w, h - hInToY(0.35));

  // ---- roughness: 高グロス地＋傷部の艶引け ----
  const r = makeCanvas(fast ? 64 : 256, fast ? 128 : 512);
  const rGrad = r.ctx.createLinearGradient(0, r.h, 0, 0);
  rGrad.addColorStop(0, gray(0.5)); // 底は摩耗でマット
  rGrad.addColorStop(0.1, gray(0.24));
  rGrad.addColorStop(1, gray(0.17));
  r.ctx.fillStyle = rGrad;
  r.ctx.fillRect(0, 0, r.w, r.h);
  const rHotCenter = (hotCenter / w) * r.w;
  for (let i = 0; i < (fast ? 30 : 130); i++) {
    const biased = rng() < 0.6;
    let x = biased ? rHotCenter + uniform(rng, -r.w * 0.22, r.w * 0.22) : uniform(rng, 0, r.w);
    x = ((x % r.w) + r.w) % r.w;
    const y = r.h * (1 - uniform(rng, 2, 6.5) / 15);
    r.ctx.strokeStyle = gray(uniform(rng, 0.4, 0.6), uniform(rng, 0.3, 0.7));
    r.ctx.lineWidth = uniform(rng, 0.6, 2.4);
    r.ctx.beginPath();
    r.ctx.moveTo(x, y);
    r.ctx.lineTo(x + uniform(rng, 3, 14), y + uniform(rng, -1.5, 1.5));
    r.ctx.stroke();
  }

  return { map: colorTexture(c), roughnessMap: dataTexture(r) };
}
