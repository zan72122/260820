/** 一指のタップとスワイプだけ。掴む対象は木製水門と、二本目が出たあとの仕切り板。 */
import { clamp } from '../util/math';
import type { GateInput } from '../sim/physics';

export interface PointerHooks {
  /** 画面座標(px)。無いときは null */
  gateScreen(): { x: number; y: number } | null;
  splitterScreen(): { x: number; y: number } | null;
  currentGate(): number;
  currentSplit(): number;
  onFirstTouch(): void;
}

export class TouchControl {
  readonly gate: GateInput = { grabbed: false, target: 0, velocity: 0 };
  splitTarget: number | null = null;
  private id: number | null = null;
  private mode: 'gate' | 'split' = 'gate';
  private startX = 0;
  private startVal = 0;
  private lastX = 0;
  private lastT = 0;
  private hooks: PointerHooks;
  private el: HTMLElement;
  private touched = false;

  constructor(el: HTMLElement, hooks: PointerHooks) {
    this.el = el;
    this.hooks = hooks;
    el.addEventListener('pointerdown', this.onDown, { passive: false });
    el.addEventListener('pointermove', this.onMove, { passive: false });
    el.addEventListener('pointerup', this.onUp, { passive: false });
    el.addEventListener('pointercancel', this.onUp, { passive: false });
    el.addEventListener('lostpointercapture', this.onUp, { passive: false });
  }

  private span(): number {
    return Math.min(window.innerWidth, window.innerHeight);
  }

  private onDown = (e: PointerEvent): void => {
    if (this.id !== null) return;
    e.preventDefault();
    if (!this.touched) {
      this.touched = true;
      this.hooks.onFirstTouch();
    }
    const g = this.hooks.gateScreen();
    const s = this.hooks.splitterScreen();
    const dg = g ? Math.hypot(e.clientX - g.x, e.clientY - g.y) : Infinity;
    const ds = s ? Math.hypot(e.clientX - s.x, e.clientY - s.y) : Infinity;
    this.mode = ds < dg && ds < this.span() * 0.3 ? 'split' : 'gate';
    this.id = e.pointerId;
    this.startX = e.clientX;
    this.lastX = e.clientX;
    this.lastT = performance.now();
    if (this.mode === 'gate') {
      this.startVal = this.hooks.currentGate();
      this.gate.grabbed = true;
      this.gate.target = this.startVal;
      this.gate.velocity = 0;
    } else {
      this.startVal = this.hooks.currentSplit();
      this.splitTarget = this.startVal;
    }
    this.el.setPointerCapture?.(e.pointerId);
  };

  private onMove = (e: PointerEvent): void => {
    if (this.id !== e.pointerId) return;
    e.preventDefault();
    const now = performance.now();
    const dt = Math.max(1, now - this.lastT) / 1000;
    const travel = this.span() * 0.44; // 画面の44%を引ききると全開
    const delta = (e.clientX - this.startX) / travel;
    if (this.mode === 'gate') {
      this.gate.target = clamp(this.startVal + delta, 0, 1);
      this.gate.velocity = ((e.clientX - this.lastX) / travel) / dt;
    } else {
      this.splitTarget = clamp(this.startVal + delta * 0.8, 0.12, 0.88);
    }
    this.lastX = e.clientX;
    this.lastT = now;
  };

  private onUp = (e: PointerEvent): void => {
    if (this.id !== e.pointerId) return;
    this.id = null;
    this.gate.grabbed = false;
    this.gate.velocity = 0;
  };

  dispose(): void {
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointercancel', this.onUp);
  }
}
