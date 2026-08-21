import { clamp } from './util';

export interface Touch2D {
  /** Finger position in CSS pixels. */
  px: number;
  py: number;
  /** Work point: lifted above the finger so the hand never covers the seam. */
  wx: number;
  wy: number;
  /** Work point in normalised device coordinates, ready for a raycaster. */
  nx: number;
  ny: number;
  /** Movement of the work point since the previous sample, in CSS pixels. */
  dx: number;
  dy: number;
  dt: number;
  /** CSS pixels per second. */
  speed: number;
  /** Accumulated path length of this drag. */
  travel: number;
  /** Seconds since this drag started. */
  age: number;
}

type Handler = (t: Touch2D) => void;

/**
 * One primary-pointer gesture stream for the 3D stage.
 *
 * Additional fingers are ignored on purpose: a four year old rests a palm on the
 * screen constantly, and a second contact must never hijack a stroke in progress.
 */
export class InputRouter {
  onDown: Handler | null = null;
  onMove: Handler | null = null;
  onUp: Handler | null = null;

  enabled = true;
  /** Vertical lift of the work point from the fingertip, in CSS pixels. */
  liftPx = 74;

  private el: HTMLElement;
  private id: number | null = null;
  private last: Touch2D | null = null;
  private travel = 0;
  private startTime = 0;
  private lastTime = 0;

  constructor(el: HTMLElement) {
    this.el = el;
    el.addEventListener('pointerdown', this.down, { passive: false });
    el.addEventListener('pointermove', this.move, { passive: false });
    el.addEventListener('pointerup', this.up, { passive: false });
    el.addEventListener('pointercancel', this.up, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // iOS Safari still fires these for double tap zoom on some builds
    el.addEventListener('gesturestart', (e) => e.preventDefault() as unknown as void);
    el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  setLiftForViewport(minEdge: number): void {
    this.liftPx = clamp(minEdge * 0.11, 46, 96);
  }

  private make(e: PointerEvent, now: number): Touch2D {
    const rect = this.el.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const wx = px;
    const wy = clamp(py - this.liftPx, 0, rect.height);
    const dt = this.last ? Math.max(1 / 240, (now - this.lastTime) / 1000) : 1 / 60;
    const dx = this.last ? wx - this.last.wx : 0;
    const dy = this.last ? wy - this.last.wy : 0;
    this.travel += Math.hypot(dx, dy);
    return {
      px,
      py,
      wx,
      wy,
      nx: (wx / rect.width) * 2 - 1,
      ny: -(wy / rect.height) * 2 + 1,
      dx,
      dy,
      dt,
      speed: Math.hypot(dx, dy) / dt,
      travel: this.travel,
      age: (now - this.startTime) / 1000,
    };
  }

  private down = (e: PointerEvent): void => {
    if (!this.enabled || this.id !== null) return;
    e.preventDefault();
    this.id = e.pointerId;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best effort */
    }
    const now = performance.now();
    this.travel = 0;
    this.startTime = now;
    this.lastTime = now;
    this.last = null;
    const t = this.make(e, now);
    this.last = t;
    this.onDown?.(t);
  };

  private move = (e: PointerEvent): void => {
    if (this.id !== e.pointerId) return;
    e.preventDefault();
    const now = performance.now();
    const t = this.make(e, now);
    this.last = t;
    this.lastTime = now;
    this.onMove?.(t);
  };

  private up = (e: PointerEvent): void => {
    if (this.id !== e.pointerId) return;
    e.preventDefault();
    const now = performance.now();
    const t = this.make(e, now);
    this.id = null;
    this.last = null;
    this.onUp?.(t);
  };

  /** Drops any stroke in progress, e.g. when a cinematic takes the controls back. */
  cancel(): void {
    this.id = null;
    this.last = null;
  }
}
