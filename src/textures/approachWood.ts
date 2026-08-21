import type * as THREE from 'three';
import { APPROACH_LENGTH, BOARD_COUNT, FT, IN, LANE_WIDTH } from '../util/units';
import { uniform, type Rng } from '../util/rng';
import { colorTexture, dataTexture, gray, hsl, makeCanvas } from './canvas';

export interface ApproachMaps {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

/**
 * アプローチ床。キャンバスy=0がアプローチ後端、y=hがファウルライン。
 * 木はレーンより淡いメープル。滑走痕は中央やや左（右投げのスライド足=左足）に集中。
 */
export function buildApproachMaps(rng: Rng, fast: boolean): ApproachMaps {
  const cw = fast ? 192 : 640;
  const ch = fast ? 256 : 1536;
  const c = makeCanvas(cw, ch);
  const { ctx } = c;

  // 板
  for (let i = 0; i < BOARD_COUNT; i++) {
    const x0 = (i / BOARD_COUNT) * cw;
    const x1 = ((i + 1) / BOARD_COUNT) * cw;
    ctx.fillStyle = hsl(uniform(rng, 36, 42), 0.26, uniform(rng, 0.62, 0.7));
    ctx.fillRect(x0, 0, x1 - x0, ch);
    // 目地と木目
    ctx.fillStyle = 'rgba(35,24,14,0.4)';
    ctx.fillRect(x1 - 0.6, 0, 1, ch);
    const lines = Math.round(uniform(rng, 3, 5));
    for (let li = 0; li < lines; li++) {
      const bx = x0 + uniform(rng, 0.15, 0.85) * (x1 - x0);
      ctx.strokeStyle = `rgba(66,44,24,${uniform(rng, 0.05, 0.1)})`;
      ctx.lineWidth = uniform(rng, 0.5, 1.2);
      ctx.beginPath();
      const wl = uniform(rng, 200, 500);
      const ph = uniform(rng, 0, Math.PI * 2);
      for (let y = 0; y <= ch; y += 24) {
        const x = bx + Math.sin(y / wl + ph) * uniform(rng, 0.5, 1.2);
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // スライド痕: ファウルライン手前0〜1.2m。右投げのスライド足（左足）は
  // 中央よりわずかに左（+x）に落ちる
  const zToPy = (zBehind: number): number => ch - (zBehind / APPROACH_LENGTH) * ch;
  for (let i = 0; i < 140; i++) {
    const xm = uniform(rng, -0.06, 0.16) + (rng() < 0.25 ? uniform(rng, -0.2, -0.05) : 0);
    const px = ((xm + LANE_WIDTH / 2) / LANE_WIDTH) * cw;
    const py = zToPy(uniform(rng, 0.02, 1.3));
    ctx.strokeStyle = `rgba(70,58,44,${uniform(rng, 0.03, 0.09)})`;
    ctx.lineWidth = uniform(rng, 1, 3);
    ctx.beginPath();
    ctx.moveTo(px + uniform(rng, -2, 2), py + uniform(rng, -4, 4));
    ctx.lineTo(px + uniform(rng, -3, 3), py + uniform(rng, 18, 60));
    ctx.stroke();
  }
  // 立ち位置周辺（後方）の靴汚れは散発
  for (let i = 0; i < 60; i++) {
    const px = uniform(rng, 0.15, 0.85) * cw;
    const py = zToPy(uniform(rng, 2.5, 4.4));
    ctx.fillStyle = `rgba(58,48,38,${uniform(rng, 0.02, 0.05)})`;
    ctx.beginPath();
    ctx.ellipse(px, py, uniform(rng, 2, 5), uniform(rng, 4, 9), uniform(rng, 0, 3), 0, Math.PI * 2);
    ctx.fill();
  }

  // ドット列: 12ft(大7個) / 15ft(7個・小)。板5,10,15,20,25,30,35
  const bw = cw / BOARD_COUNT;
  ctx.fillStyle = 'rgba(40,30,24,0.9)';
  for (const [dist, rIn] of [
    [12 * FT, 1.0],
    [15 * FT - 2 * IN, 0.7],
  ] as const) {
    const py = zToPy(dist);
    for (let i = 0; i < 7; i++) {
      const board = 5 + i * 5;
      const px = cw - (board - 0.5) * bw;
      ctx.beginPath();
      ctx.arc(px, py, ((rIn * IN) / LANE_WIDTH) * cw, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ラフネス: マット寄り。スライド帯は磨かれてわずかに艶
  const r = makeCanvas(fast ? 96 : 256, fast ? 128 : 512);
  r.ctx.fillStyle = gray(0.56);
  r.ctx.fillRect(0, 0, r.w, r.h);
  const slidePy = r.h - (1.0 / APPROACH_LENGTH) * r.h;
  const g = r.ctx.createRadialGradient(r.w * 0.46, r.h * 0.97, 0, r.w * 0.46, r.h * 0.97, r.h - slidePy);
  g.addColorStop(0, gray(0.46, 0.8));
  g.addColorStop(1, gray(0.56, 0));
  r.ctx.fillStyle = g;
  r.ctx.fillRect(0, slidePy - 30, r.w, r.h - slidePy + 30);

  return { map: colorTexture(c), roughnessMap: dataTexture(r) };
}
