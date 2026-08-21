import type * as THREE from 'three';
import {
  BOARD_COUNT,
  FT,
  IN,
  LANE_LENGTH,
  LANE_WIDTH,
  OIL_LENGTH,
  PIN_DECK_EXTRA,
  pinPositions,
} from '../util/units';
import { uniform, type Rng } from '../util/rng';
import { colorTexture, dataTexture, gray, hsl, makeCanvas, type Ctx2D } from './canvas';

/** レーン面テクスチャ一式（ファウルライン→ピンデッキ後端をカバー） */
export interface LaneMaps {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  /** テクスチャがカバーする全長（m） */
  length: number;
}

export const LANE_FULL_LENGTH = LANE_LENGTH + PIN_DECK_EXTRA;

/** ワールドx(m, 中央0) → キャンバスx(px)。板1はボウラーの右端 = x=-W/2 = px0 */
function xToPx(x: number, w: number): number {
  return ((x + LANE_WIDTH / 2) / LANE_WIDTH) * w;
}
/** 板番号（右端=1）→ 板中心のワールドx */
export function boardToX(board: number): number {
  return -LANE_WIDTH / 2 + (board - 0.5) * (LANE_WIDTH / BOARD_COUNT);
}
/** ワールドz(m, ファウルライン0) → キャンバスy(px) */
function zToPx(z: number, h: number, length: number): number {
  return (z / length) * h;
}

interface BoardSpan {
  x0: number;
  x1: number;
  /** メープル→パイン継ぎ位置（m）。板ごとに互い違い */
  splice1: number;
  /** パイン→メープル（ピンデッキ側）継ぎ位置（m） */
  splice2: number;
}

function layoutBoards(rng: Rng, w: number): BoardSpan[] {
  const spans: BoardSpan[] = [];
  for (let i = 0; i < BOARD_COUNT; i++) {
    const x0 = (i / BOARD_COUNT) * w;
    const x1 = ((i + 1) / BOARD_COUNT) * w;
    // 継ぎは指継ぎ状に板ごとオフセット（左右対称にしない）
    const splice1 = 14 * FT + uniform(rng, -0.35, 0.35);
    const splice2 = LANE_LENGTH - 2.4 * FT + uniform(rng, -0.25, 0.25);
    spans.push({ x0, x1, splice1, splice2 });
  }
  return spans;
}

function drawBoardBase(c: Ctx2D, rng: Rng, spans: BoardSpan[], length: number): void {
  const { ctx, h } = c;
  for (const s of spans) {
    // 材ごとの個体差: メープルは明るく黄味、パインはやや赤茶で縞が強い
    const mapleL = uniform(rng, 0.6, 0.68);
    const mapleH = uniform(rng, 34, 40);
    const pineL = uniform(rng, 0.52, 0.6);
    const pineH = uniform(rng, 27, 33);
    const y1 = zToPx(s.splice1, h, length);
    const y2 = zToPx(s.splice2, h, length);
    ctx.fillStyle = hsl(mapleH, 0.32, mapleL);
    ctx.fillRect(s.x0, 0, s.x1 - s.x0, y1);
    ctx.fillStyle = hsl(pineH, 0.34, pineL);
    ctx.fillRect(s.x0, y1, s.x1 - s.x0, y2 - y1);
    ctx.fillStyle = hsl(mapleH + 1, 0.3, mapleL - 0.02);
    ctx.fillRect(s.x0, y2, s.x1 - s.x0, h - y2);
    // 継ぎ目の暗線（うっすら）
    ctx.fillStyle = 'rgba(40,26,14,0.35)';
    ctx.fillRect(s.x0, y1 - 1, s.x1 - s.x0, 2);
    ctx.fillRect(s.x0, y2 - 1, s.x1 - s.x0, 2);
  }
}

function drawGrain(c: Ctx2D, rng: Rng, spans: BoardSpan[], length: number): void {
  const { ctx, h } = c;
  ctx.lineCap = 'round';
  for (const s of spans) {
    const bw = s.x1 - s.x0;
    const y1 = zToPx(s.splice1, h, length);
    // 縦方向の木目線。パイン領域は本数・コントラスト強め
    const lines = Math.round(uniform(rng, 4, 7));
    for (let li = 0; li < lines; li++) {
      const baseX = s.x0 + uniform(rng, 0.12, 0.88) * bw;
      const amp = uniform(rng, 0.4, 1.6);
      const wl = uniform(rng, 260, 700);
      const phase = uniform(rng, 0, Math.PI * 2);
      const darkMaple = uniform(rng, 0.05, 0.1);
      const darkPine = uniform(rng, 0.1, 0.18);
      ctx.lineWidth = uniform(rng, 0.6, 1.6);
      ctx.beginPath();
      const step = 24;
      for (let y = 0; y <= h; y += step) {
        const x = baseX + Math.sin(y / wl + phase) * amp + Math.sin(y / 61 + phase * 2) * 0.35;
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      // 上下（メープル/パイン）で濃さを変えるため2回に分けて描く
      ctx.save();
      ctx.strokeStyle = `rgba(58,38,20,${darkMaple})`;
      ctx.beginPath();
      for (let y = 0; y <= y1; y += step) {
        const x = baseX + Math.sin(y / wl + phase) * amp + Math.sin(y / 61 + phase * 2) * 0.35;
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = `rgba(70,40,22,${darkPine})`;
      ctx.beginPath();
      for (let y = y1; y <= h; y += step) {
        const x = baseX + Math.sin(y / wl + phase) * amp + Math.sin(y / 61 + phase * 2) * 0.35;
        if (y === y1) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }
    // まれにカテドラル杢（楕円弧）をパイン部に
    if (rng() < 0.3) {
      const cy = zToPx(uniform(rng, s.splice1 + 1, s.splice2 - 1), h, length);
      const cx = s.x0 + bw * uniform(rng, 0.3, 0.7);
      ctx.strokeStyle = 'rgba(84,50,26,0.12)';
      ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, bw * (0.18 + k * 0.11), uniform(rng, 60, 160) + k * 34, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  // 板間の目地
  ctx.fillStyle = 'rgba(30,20,12,0.5)';
  for (const s of spans) ctx.fillRect(s.x1 - 0.7, 0, 1.2, h);
}

/** 右投げのボールトラック中心（板8〜12帯→ポケットへ）: z(m)→x(m) */
export function trackCenterX(z: number): number {
  const startX = boardToX(10.5);
  const pocketX = boardToX(17.5);
  const breakZ = 12.5;
  if (z <= breakZ) return startX - (z / breakZ) * 0.02;
  const t = Math.min(1, (z - breakZ) / (LANE_LENGTH - breakZ));
  return startX + (pocketX - startX) * t * t;
}

function drawWear(c: Ctx2D, rng: Rng, length: number): void {
  const { ctx, w, h } = c;
  // ボールトラック帯: 使用に由来する非対称な艶引け＋うっすら黒ずみ
  for (let z = 0.15; z < LANE_LENGTH; z += 0.045) {
    const x = trackCenterX(z) + uniform(rng, -0.02, 0.02);
    const px = xToPx(x, w);
    const py = zToPx(z, h, length);
    const r = uniform(rng, 0.035, 0.075) * (w / LANE_WIDTH);
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    const a = 0.028 * (z < 3 ? 0.6 : 1);
    g.addColorStop(0, `rgba(52,38,26,${a})`);
    g.addColorStop(1, 'rgba(52,38,26,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px - r, py - r, r * 2, r * 2);
  }
  // レーン端（板1・39）の埃だまり。左右で量を変える
  const edgeA = [uniform(rng, 0.05, 0.1), uniform(rng, 0.03, 0.07)] as const;
  for (const [i, a] of edgeA.entries()) {
    const grad = ctx.createLinearGradient(i === 0 ? 0 : w, 0, i === 0 ? w * 0.035 : w * 0.965, 0);
    grad.addColorStop(0, `rgba(38,30,20,${a})`);
    grad.addColorStop(1, 'rgba(38,30,20,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(i === 0 ? 0 : w * 0.965, 0, w * 0.035, h);
  }
  // ファウルライン直後のこすれ
  for (let i = 0; i < 60; i++) {
    const px = uniform(rng, 0.1, 0.9) * w;
    const py = zToPx(uniform(rng, 0.02, 0.5), h, length);
    ctx.strokeStyle = `rgba(40,32,24,${uniform(rng, 0.03, 0.08)})`;
    ctx.lineWidth = uniform(rng, 0.5, 1.5);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + uniform(rng, -6, 6), py + uniform(rng, 8, 30));
    ctx.stroke();
  }
}

function drawMarkings(c: Ctx2D, length: number): void {
  const { ctx, w, h } = c;
  const bw = w / BOARD_COUNT;
  const ink = 'rgba(46,26,18,0.9)';
  // ファウルライン（黒、幅1in）
  ctx.fillStyle = 'rgba(16,14,12,0.95)';
  ctx.fillRect(0, 0, w, zToPx(1 * IN, h, length));
  // ターゲットアロー: 板5,10,15,20,25,30,35。外側ほど手前
  ctx.fillStyle = ink;
  for (let i = 0; i < 7; i++) {
    const board = 5 + i * 5;
    const px = (board - 0.5) * bw;
    const z = 15.5 * FT - Math.abs(i - 3) * 0.85 * FT;
    const tipY = zToPx(z + 12 * IN, h, length);
    const baseY = zToPx(z, h, length);
    ctx.beginPath();
    ctx.moveTo(px, tipY);
    ctx.lineTo(px - bw * 0.42, baseY);
    ctx.lineTo(px + bw * 0.42, baseY);
    ctx.closePath();
    ctx.fill();
  }
  // ガイドドット（約7ft）: 板3,5,8,11,14 とその鏡映
  const dotBoards = [3, 5, 8, 11, 14, 26, 29, 32, 35, 37];
  const dotY = zToPx(7 * FT, h, length);
  const dotR = ((0.75 * IN) / LANE_WIDTH) * w;
  for (const b of dotBoards) {
    const px = (b - 0.5) * bw;
    ctx.beginPath();
    ctx.arc(px, dotY, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPinDeck(c: Ctx2D, rng: Rng, length: number): void {
  const { ctx, w, h } = c;
  // ピンスポット（2.25in）
  ctx.fillStyle = 'rgba(30,24,20,0.85)';
  const r = ((2.25 / 2) * IN * w) / LANE_WIDTH;
  for (const p of pinPositions()) {
    const px = xToPx(p.x, w);
    const py = zToPx(p.z, h, length);
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // デッキのスカッフ（ポケット周辺に集中、方向はz方向に伸びる）
  const deckY0 = LANE_LENGTH - 0.5;
  for (let i = 0; i < 250; i++) {
    const towardPocket = rng() < 0.6;
    const x = towardPocket ? uniform(rng, -0.12, 0.25) : uniform(rng, -0.5, 0.5);
    const z = uniform(rng, deckY0, length - 0.05);
    const px = xToPx(x, w);
    const py = zToPx(z, h, length);
    const dark = rng() < 0.5;
    ctx.strokeStyle = dark
      ? `rgba(30,26,22,${uniform(rng, 0.06, 0.16)})`
      : `rgba(210,205,196,${uniform(rng, 0.04, 0.1)})`;
    ctx.lineWidth = uniform(rng, 0.6, 2.2);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + uniform(rng, -4, 4), py + uniform(rng, 6, 40));
    ctx.stroke();
  }
}

function drawRoughness(c: Ctx2D, rng: Rng, length: number): void {
  const { ctx, w, h } = c;
  // ベース: 仕上げ済みウッド
  ctx.fillStyle = gray(0.4);
  ctx.fillRect(0, 0, w, h);
  // オイルパターン（〜40ft）: 中央濃く、外板薄く。奥へ向けテーパー
  const oilEndY = zToPx(OIL_LENGTH, h, length);
  const taperY = zToPx(OIL_LENGTH - 8 * FT, h, length);
  const cross = ctx.createLinearGradient(0, 0, w, 0);
  cross.addColorStop(0, gray(0.34));
  cross.addColorStop(0.2, gray(0.2));
  cross.addColorStop(0.35, gray(0.14));
  cross.addColorStop(0.65, gray(0.14));
  cross.addColorStop(0.8, gray(0.2));
  cross.addColorStop(1, gray(0.34));
  ctx.fillStyle = cross;
  ctx.fillRect(0, 0, w, taperY);
  // テーパー部: オイル→ドライへ
  const taper = ctx.createLinearGradient(0, taperY, 0, oilEndY);
  taper.addColorStop(0, 'rgba(0,0,0,0)');
  taper.addColorStop(1, gray(0.44, 1));
  ctx.save();
  ctx.fillStyle = taper;
  ctx.fillRect(0, taperY, w, oilEndY - taperY);
  ctx.restore();
  // バックエンド（ドライ）
  ctx.fillStyle = gray(0.44);
  ctx.fillRect(0, oilEndY, w, h - oilEndY);
  // オイルマシンの筋（縦の艶ムラ）
  for (let i = 0; i < 30; i++) {
    const px = uniform(rng, 0, 1) * w;
    ctx.fillStyle = rng() < 0.5 ? `rgba(255,255,255,${uniform(rng, 0.015, 0.04)})` : `rgba(0,0,0,${uniform(rng, 0.015, 0.04)})`;
    ctx.fillRect(px, 0, uniform(rng, 1, 3), oilEndY);
  }
  // トラック帯は艶が引けて粗くなる
  for (let z = 0.15; z < LANE_LENGTH; z += 0.06) {
    const x = trackCenterX(z) + uniform(rng, -0.018, 0.018);
    const px = xToPx(x, w);
    const py = zToPx(z, h, length);
    const r = uniform(rng, 0.03, 0.06) * (w / LANE_WIDTH);
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,0.05)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px - r, py - r, r * 2, r * 2);
  }
  // ピンデッキはやや粗い＋スカッフ
  const deckY = zToPx(LANE_LENGTH - 0.55, h, length);
  ctx.fillStyle = gray(0.5, 0.9);
  ctx.fillRect(0, deckY, w, h - deckY);
}

export function buildLaneMaps(rng: Rng, fast: boolean): LaneMaps {
  const length = LANE_FULL_LENGTH;
  const cw = fast ? 192 : 768;
  const ch = fast ? 1024 : 6144;
  const color = makeCanvas(cw, ch);
  const spans = layoutBoards(rng, cw);
  drawBoardBase(color, rng, spans, length);
  drawGrain(color, rng, spans, length);
  drawWear(color, rng, length);
  drawMarkings(color, length);
  drawPinDeck(color, rng, length);

  const rough = makeCanvas(fast ? 96 : 384, fast ? 512 : 3072);
  drawRoughness(rough, rng, length);

  return { map: colorTexture(color), roughnessMap: dataTexture(rough), length };
}
