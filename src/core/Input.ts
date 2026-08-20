/**
 * One finger, one pointer. Every interaction in the game is expressed as a press, a drag or
 * a tap from this controller, so a four year old can never get into a two-finger state that
 * the game does not understand.
 */

import { Vector2 } from 'three';
import { clamp } from '../util/math';

const _vel = new Vector2();

export interface PointerSample {
  x: number;
  y: number;
  t: number;
}

export class InputController {
  readonly ndc = new Vector2(); // -1..1, y up
  readonly prevNdc = new Vector2();
  readonly ndcDelta = new Vector2();
  readonly css = new Vector2(); // CSS pixels, y down
  readonly cssDelta = new Vector2();
  readonly cssVelocity = new Vector2(); // CSS px / second, smoothed
  readonly pressCss = new Vector2();

  down = false;
  justPressed = false;
  justReleased = false;
  /** True on the frame a short, near-stationary press is released. */
  tapped = false;
  holdTime = 0;
  travel = 0;
  /** Instantaneous drag speed in CSS px/s (smoothed). */
  speed = 0;

  readonly history: PointerSample[] = [];

  private pointerId: number | null = null;
  private pendingDown = false;
  private pendingUp = false;
  private rawX = 0;
  private rawY = 0;
  private lastMoveT = 0;
  private enabled = true;
  private readonly detach: (() => void)[] = [];

  constructor(private readonly el: HTMLElement) {
    const onDown = (e: PointerEvent) => {
      if (!this.enabled || this.pointerId !== null) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.pointerId = e.pointerId;
      this.el.setPointerCapture?.(e.pointerId);
      this.updateRaw(e);
      this.pendingDown = true;
      this.lastMoveT = performance.now();
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      this.updateRaw(e);
      e.preventDefault();
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      this.updateRaw(e);
      this.pointerId = null;
      this.pendingUp = true;
      e.preventDefault();
    };
    const stop = (e: Event) => e.preventDefault();

    this.el.addEventListener('pointerdown', onDown, { passive: false });
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp, { passive: false });
    window.addEventListener('pointercancel', onUp, { passive: false });
    this.el.addEventListener('touchstart', stop, { passive: false });
    this.el.addEventListener('touchmove', stop, { passive: false });
    this.el.addEventListener('contextmenu', stop);
    this.el.addEventListener('gesturestart', stop as EventListener);
    this.el.addEventListener('dblclick', stop);

    this.detach.push(() => {
      this.el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      this.el.removeEventListener('touchstart', stop);
      this.el.removeEventListener('touchmove', stop);
      this.el.removeEventListener('contextmenu', stop);
      this.el.removeEventListener('gesturestart', stop as EventListener);
      this.el.removeEventListener('dblclick', stop);
    });
  }

  private updateRaw(e: PointerEvent): void {
    const r = this.el.getBoundingClientRect();
    this.rawX = e.clientX - r.left;
    this.rawY = e.clientY - r.top;
  }

  /** Called once per frame before stages run. */
  update(dt: number): void {
    const r = this.el.getBoundingClientRect();
    const w = r.width || 1;
    const h = r.height || 1;
    const now = performance.now();

    this.justPressed = false;
    this.justReleased = false;
    this.tapped = false;

    if (this.pendingDown) {
      this.pendingDown = false;
      this.down = true;
      this.justPressed = true;
      this.holdTime = 0;
      this.travel = 0;
      this.css.set(this.rawX, this.rawY);
      this.pressCss.copy(this.css);
      this.cssDelta.set(0, 0);
      this.cssVelocity.set(0, 0);
      this.speed = 0;
      this.history.length = 0;
      this.history.push({ x: this.css.x, y: this.css.y, t: now });
      this.prevNdc.set((this.css.x / w) * 2 - 1, -(this.css.y / h) * 2 + 1);
      this.ndc.copy(this.prevNdc);
      this.ndcDelta.set(0, 0);
      this.lastMoveT = now;
      return;
    }

    if (this.down) {
      const nx = this.rawX;
      const ny = this.rawY;
      this.cssDelta.set(nx - this.css.x, ny - this.css.y);
      this.css.set(nx, ny);
      this.travel += this.cssDelta.length();
      this.holdTime += dt;

      const step = Math.max(dt, 1 / 240);
      const inst = this.cssDelta.length() / step;
      const k = 1 - Math.exp(-16 * dt);
      _vel.set(this.cssDelta.x / step, this.cssDelta.y / step);
      this.cssVelocity.lerp(_vel, k);
      this.speed += (inst - this.speed) * k;

      this.prevNdc.copy(this.ndc);
      this.ndc.set((this.css.x / w) * 2 - 1, -(this.css.y / h) * 2 + 1);
      this.ndcDelta.subVectors(this.ndc, this.prevNdc);

      this.history.push({ x: this.css.x, y: this.css.y, t: now });
      if (this.history.length > 90) this.history.shift();
      this.lastMoveT = now;
    } else {
      this.cssDelta.set(0, 0);
      this.ndcDelta.set(0, 0);
      this.speed *= Math.exp(-6 * dt);
      this.cssVelocity.multiplyScalar(Math.exp(-6 * dt));
    }

    if (this.pendingUp) {
      this.pendingUp = false;
      if (this.down) {
        this.justReleased = true;
        // Generous tap window: small children rarely hold perfectly still.
        this.tapped = this.holdTime < 0.6 && this.travel < 26;
      }
      this.down = false;
    }
  }

  /** Signed CSS-pixel travel over the last `seconds`, used by the rope gestures. */
  recentDelta(seconds: number, out = new Vector2()): Vector2 {
    const now = performance.now();
    const cutoff = now - seconds * 1000;
    let first: PointerSample | null = null;
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].t < cutoff) break;
      first = this.history[i];
    }
    const last = this.history[this.history.length - 1];
    if (!first || !last) return out.set(0, 0);
    return out.set(last.x - first.x, last.y - first.y);
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v) this.forceRelease();
  }

  forceRelease(): void {
    if (this.pointerId !== null) {
      try {
        this.el.releasePointerCapture?.(this.pointerId);
      } catch {
        /* pointer already gone */
      }
    }
    this.pointerId = null;
    this.pendingDown = false;
    if (this.down) this.pendingUp = true;
  }

  /** Seconds since the pointer last physically moved. */
  idleTime(): number {
    return (performance.now() - this.lastMoveT) / 1000;
  }

  /** Screen-space distance to a CSS point, clamped for use as a magnet weight. */
  distanceTo(x: number, y: number): number {
    return clamp(Math.hypot(this.css.x - x, this.css.y - y), 0, 99999);
  }

  dispose(): void {
    for (const d of this.detach) d();
    this.detach.length = 0;
  }
}
