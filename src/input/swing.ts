import type { ThrowParams } from '../physics/world';
import { LANE_WIDTH } from '../util/units';

export interface SwingSample {
  /** 秒 */
  t: number;
  /** 画面幅で正規化した座標（0..1） */
  x: number;
  /** 画面高さで正規化した座標（0..1, 下が1） */
  y: number;
}

/** 実投球域: 初速とフック回転の上限 */
export const MIN_SPEED = 3.0;
export const MAX_SPEED = 9.5;
export const MAX_REV = 30;
export const MAX_AXIS = 42;
export const MAX_ANGLE = 7;

/**
 * ドラッグ軌跡 → 投球パラメータ。
 * - リリース速度(上方向) → 球速
 * - リリース方向の横成分 → 投球角
 * - ストローク中の横速度の変化（軌跡の湾曲） → 回転（フック）
 * サンプル不足・後ろ向きリリースは null（投球不成立）。
 */
export function computeThrow(samples: SwingSample[], ballX: number): ThrowParams | null {
  if (samples.length < 3) return null;
  const end = samples[samples.length - 1]!;
  // リリース直前 ~120ms の窓で速度を推定
  const windowStart = end.t - 0.12;
  let i0 = samples.length - 2;
  while (i0 > 0 && samples[i0]!.t > windowStart) i0--;
  const start = samples[i0]!;
  const dt = end.t - start.t;
  if (dt < 0.016) return null;
  const vyUp = (start.y - end.y) / dt; // 上向きが正
  const vx = (end.x - start.x) / dt;
  if (vyUp < 0.25) return null; // 前方への振りがない

  // 球速: 画面高さの約1.5倍/秒のフリックで最大
  const speed = Math.min(MAX_SPEED, MIN_SPEED + (MAX_SPEED - MIN_SPEED) * (vyUp / 1.5));

  // 投球角: リリース横速度。右へ振れば右へ（-角）
  const angleDeg = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, (-vx / Math.max(vyUp, 0.001)) * 28));

  // フック: ストローク前半と後半の横速度差（湾曲）
  const mid = samples[Math.max(0, Math.floor((i0 + samples.length - 1) / 2))]!;
  const dtA = mid.t - samples[0]!.t;
  const dtB = end.t - mid.t;
  let curl = 0;
  if (dtA > 0.02 && dtB > 0.02) {
    const vxA = (mid.x - samples[0]!.x) / dtA;
    const vxB = (end.x - mid.x) / dtB;
    curl = vxA - vxB; // 右→左へ曲げるストロークで正
  }
  const hook = Math.max(-1, Math.min(1, curl / 0.9));
  const revRate = 6 + Math.abs(hook) * (MAX_REV - 6);
  const axisDeg = Math.sign(hook) * (8 + Math.abs(hook) * (MAX_AXIS - 8));

  return {
    x: Math.max(-LANE_WIDTH / 2 + 0.11, Math.min(LANE_WIDTH / 2 - 0.11, ballX)),
    speed,
    angleDeg,
    revRate,
    axisDeg,
  };
}

export type SwingPhase = 'idle' | 'dragging';

/**
 * ポインタ入力の追跡。座標を正規化して蓄積し、
 * リリース時に computeThrow へ渡す。
 */
export class SwingInput {
  private samples: SwingSample[] = [];
  private el: HTMLElement;
  phase: SwingPhase = 'idle';
  /** ドラッグ中の現在位置（構えのボール移動に使う） */
  currentX = 0.5;
  currentY = 0.5;
  onRelease: (samples: SwingSample[]) => void = () => {};
  enabled = false;

  constructor(el: HTMLElement) {
    this.el = el;
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', () => this.cancel());
  }

  private norm(e: PointerEvent): { x: number; y: number } {
    const r = this.el.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }

  private down(e: PointerEvent): void {
    if (!this.enabled) return;
    this.el.setPointerCapture(e.pointerId);
    this.phase = 'dragging';
    this.samples = [];
    this.push(e);
  }

  private move(e: PointerEvent): void {
    if (this.phase !== 'dragging') return;
    this.push(e);
  }

  private up(e: PointerEvent): void {
    if (this.phase !== 'dragging') return;
    this.push(e);
    this.phase = 'idle';
    const s = this.samples;
    this.samples = [];
    this.onRelease(s);
  }

  private cancel(): void {
    this.phase = 'idle';
    this.samples = [];
  }

  private push(e: PointerEvent): void {
    const { x, y } = this.norm(e);
    this.currentX = x;
    this.currentY = y;
    this.samples.push({ t: performance.now() / 1000, x, y });
    if (this.samples.length > 240) this.samples.shift();
  }
}
