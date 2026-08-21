import type * as THREE from 'three';
import { uniform, type Rng } from '../util/rng';
import { colorTexture, dataTexture, gray, makeCanvas } from './canvas';

export interface MaskingMaps {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

/**
 * マスキングユニット前面（塗装鋼板）。
 * 装飾は実在物に即して最小限: 塗り分けバンド＋レーン番号＋使用による当たり傷。
 */
export function buildMaskingMaps(rng: Rng, fast: boolean, laneNo = 7): MaskingMaps {
  const w = fast ? 256 : 1024;
  const h = fast ? 64 : 256;
  const c = makeCanvas(w, h);
  const { ctx } = c;

  // 基調: 彩度を抑えた青灰の塗装
  ctx.fillStyle = '#39434c';
  ctx.fillRect(0, 0, w, h);
  // 下側1/3をより暗い帯に塗り分け（実際の視線誘導帯）
  ctx.fillStyle = '#242b31';
  ctx.fillRect(0, h * 0.66, w, h * 0.34);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, h * 0.66 - 1, w, 2);

  // 塗装ムラ（横方向の淡い刷毛ムラ）
  for (let i = 0; i < 60; i++) {
    const y = uniform(rng, 0, h);
    ctx.fillStyle =
      rng() < 0.5 ? `rgba(255,255,255,${uniform(rng, 0.01, 0.03)})` : `rgba(0,0,0,${uniform(rng, 0.01, 0.04)})`;
    ctx.fillRect(0, y, w, uniform(rng, 1, 4));
  }

  // 下端の当たり傷・チップ（ピンや機械整備による、非対称）
  for (let i = 0; i < 46; i++) {
    const x = uniform(rng, 0, 1) ** 1.6 * w; // 左寄りに多め
    const y = h - uniform(rng, 1, h * 0.2);
    ctx.fillStyle = rng() < 0.6 ? `rgba(180,178,170,${uniform(rng, 0.2, 0.5)})` : 'rgba(20,20,20,0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y, uniform(rng, 0.8, 3), uniform(rng, 0.5, 1.6), uniform(rng, 0, 3), 0, Math.PI * 2);
    ctx.fill();
  }

  // レーン番号プレート（左上、控えめ）
  const plateW = w * 0.06;
  const plateH = h * 0.3;
  ctx.fillStyle = '#e8e4da';
  ctx.fillRect(w * 0.035, h * 0.14, plateW, plateH);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(w * 0.035, h * 0.14, plateW, plateH);
  ctx.fillStyle = '#1d232b';
  ctx.font = `bold ${Math.round(plateH * 0.74)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(laneNo), w * 0.035 + plateW / 2, h * 0.14 + plateH * 0.55);

  // ラフネス: 半艶塗装。傷部はやや粗い
  const r = makeCanvas(fast ? 128 : 256, fast ? 32 : 64);
  r.ctx.fillStyle = gray(0.45);
  r.ctx.fillRect(0, 0, r.w, r.h);
  for (let i = 0; i < 40; i++) {
    r.ctx.fillStyle = gray(uniform(rng, 0.4, 0.55), 0.5);
    r.ctx.fillRect(uniform(rng, 0, r.w), uniform(rng, 0, r.h), uniform(rng, 2, 8), uniform(rng, 1, 3));
  }

  return { map: colorTexture(c), roughnessMap: dataTexture(r) };
}
