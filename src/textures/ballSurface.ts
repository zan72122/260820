import type * as THREE from 'three';
import { uniform, type Rng } from '../util/rng';
import { colorTexture, dataTexture, gray, hsl, makeCanvas } from './canvas';

export interface BallMaps {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

/**
 * ハウスボール表面（マーブル模様のポリエステル/ウレタン）。
 * 使用感: 全周の微細スクラッチ＋転がり軌道（トラック）の艶引けリング。
 * リングは指穴軸とは無関係な向きに置く（実物どおり非対称）。
 */
export function buildBallMaps(rng: Rng, fast: boolean): BallMaps {
  const w = fast ? 256 : 1024;
  const h = fast ? 128 : 512;
  const c = makeCanvas(w, h);
  const { ctx } = c;

  // 基調: 深い青。マーブルは大きなうねり＋細かい脈
  const baseH = 222;
  ctx.fillStyle = hsl(baseH, 0.5, 0.32);
  ctx.fillRect(0, 0, w, h);

  const swirl = (hue: number, sat: number, light: number, alpha: number, n: number, lw: [number, number]): void => {
    for (let i = 0; i < n; i++) {
      const y0 = uniform(rng, 0, h);
      const x0 = uniform(rng, -w * 0.2, w);
      const len = uniform(rng, w * 0.25, w * 0.7);
      const amp = uniform(rng, 8, 40);
      const wl = uniform(rng, 40, 160);
      const ph = uniform(rng, 0, Math.PI * 2);
      const drift = uniform(rng, -0.35, 0.35);
      ctx.strokeStyle = hsl(hue + uniform(rng, -8, 8), sat, light + uniform(rng, -0.06, 0.06), alpha);
      ctx.lineWidth = uniform(rng, lw[0], lw[1]);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let t = 0; t <= len; t += 8) {
        const x = x0 + t;
        const y = y0 + Math.sin(t / wl + ph) * amp + t * drift;
        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  };
  // 大きな明るいマーブル → 中間 → 暗い脈の順に重ねる
  swirl(baseH + 6, 0.48, 0.52, 0.55, fast ? 8 : 26, [10, 26]);
  swirl(baseH - 12, 0.4, 0.66, 0.4, fast ? 8 : 30, [3, 10]);
  swirl(baseH + 14, 0.58, 0.16, 0.4, fast ? 6 : 22, [2, 8]);

  // 継ぎ目を消すため左右端をブレンド（uラップ対策: 端の内容を反対側へ薄く重ね描き）
  const edge = Math.round(w * 0.06);
  ctx.globalAlpha = 0.7;
  ctx.drawImage(c.canvas, 0, 0, edge, h, w - edge, 0, edge, h);
  ctx.drawImage(c.canvas, w - edge * 2, 0, edge, h, 0, 0, edge, h);
  ctx.globalAlpha = 1;

  // 微細スクラッチ（全周ランダム、ごく薄い明線/暗線）
  const scratches = fast ? 40 : 260;
  for (let i = 0; i < scratches; i++) {
    const x = uniform(rng, 0, w);
    const y = uniform(rng, h * 0.06, h * 0.94);
    const a = uniform(rng, 0, Math.PI);
    const l = uniform(rng, 4, 26);
    ctx.strokeStyle = rng() < 0.5 ? `rgba(255,255,255,${uniform(rng, 0.03, 0.08)})` : `rgba(0,0,0,${uniform(rng, 0.04, 0.1)})`;
    ctx.lineWidth = uniform(rng, 0.4, 0.9);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }

  // 刻印（穴のそばに小さく番号のみ。ロゴや装飾はなし）
  ctx.fillStyle = 'rgba(20,24,40,0.75)';
  ctx.font = `bold ${Math.round(h * 0.075)}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.fillText('11', w * 0.62, h * 0.3);

  // ---- roughness ----
  const r = makeCanvas(fast ? 128 : 512, fast ? 64 : 256);
  r.ctx.fillStyle = gray(0.22);
  r.ctx.fillRect(0, 0, r.w, r.h);
  // 転がりトラックの艶引けリング: uv空間では傾いたサイン帯になる
  const bandPhase = uniform(rng, 0, Math.PI * 2);
  const bandTilt = uniform(rng, 0.12, 0.3) * r.h;
  const bandY = r.h * uniform(rng, 0.45, 0.6);
  for (let x = 0; x < r.w; x++) {
    const yc = bandY + Math.sin((x / r.w) * Math.PI * 2 + bandPhase) * bandTilt;
    const bw2 = r.h * 0.055;
    const g = r.ctx.createLinearGradient(0, yc - bw2, 0, yc + bw2);
    g.addColorStop(0, gray(0.22, 0));
    g.addColorStop(0.5, gray(0.42, 0.85));
    g.addColorStop(1, gray(0.22, 0));
    r.ctx.fillStyle = g;
    r.ctx.fillRect(x, yc - bw2, 1, bw2 * 2);
  }
  // 散発的な艶ムラ
  for (let i = 0; i < 60; i++) {
    r.ctx.fillStyle = gray(uniform(rng, 0.18, 0.34), 0.4);
    r.ctx.beginPath();
    r.ctx.ellipse(uniform(rng, 0, r.w), uniform(rng, 0, r.h), uniform(rng, 2, 9), uniform(rng, 1, 5), uniform(rng, 0, 3), 0, Math.PI * 2);
    r.ctx.fill();
  }

  return { map: colorTexture(c), roughnessMap: dataTexture(r) };
}
