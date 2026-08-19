/* One finger, that is all.  Works with touch, pen and mouse.

   Gesture measurements are accumulated inside the pointer events rather than
   sampled once per frame: a four-year-old scrubbing in fast circles can
   complete a whole turn between two frames, and a per-frame sample would
   read that as no rotation at all. */
import * as THREE from 'three';

const TWO_PI = Math.PI * 2;

export class Pointer {
  constructor(el) {
    this.el = el;
    this.down = false;
    this.x = 0; this.y = 0;         // css px
    this.nx = 0; this.ny = 0;       // -1..1, y up
    this.dx = 0; this.dy = 0;       // movement since last frame, css px
    this.startX = 0; this.startY = 0;
    this.moved = 0;                 // total path length this gesture
    this.speed = 0;                 // smoothed px/s
    this.turn = 0;                  // signed radians accumulated this frame
    this.spin = 0;                  // smoothed |turn| per second
    this.taps = 0;
    this.justDown = false;
    this.justUp = false;

    this.pivotX = null; this.pivotY = null;
    this._prevAngle = null;
    this._accX = 0; this._accY = 0; this._accTurn = 0;
    this._downT = 0;

    const opts = { passive: false };
    el.addEventListener('pointerdown', e => this._down(e), opts);
    el.addEventListener('pointermove', e => this._move(e), opts);
    el.addEventListener('pointerup', e => this._up(e), opts);
    el.addEventListener('pointercancel', e => this._up(e), opts);
    el.addEventListener('pointerleave', e => this._up(e), opts);
    el.addEventListener('touchstart', e => e.preventDefault(), opts);
    el.addEventListener('touchmove', e => e.preventDefault(), opts);
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('gesturestart', e => e.preventDefault());
    el.addEventListener('dblclick', e => e.preventDefault());
  }

  /** screen-space point the game wants rotation measured around (or null) */
  setPivot(x, y) {
    if (x === undefined || x === null) { this.pivotX = this.pivotY = null; this._prevAngle = null; return; }
    this.pivotX = x; this.pivotY = y;
  }

  _pos(e) {
    const r = this.el.getBoundingClientRect();
    this.x = e.clientX - r.left;
    this.y = e.clientY - r.top;
    this.nx = (this.x / r.width) * 2 - 1;
    this.ny = -((this.y / r.height) * 2 - 1);
  }
  _down(e) {
    if (this.down) return;
    this.el.setPointerCapture?.(e.pointerId);
    this._pos(e);
    this.down = true;
    this.startX = this.x; this.startY = this.y;
    this.moved = 0; this.speed = 0;
    this._prevAngle = null;
    this._accX = 0; this._accY = 0; this._accTurn = 0;
    this._downT = performance.now();
    this.justDown = true;
  }
  _move(e) {
    const px = this.x, py = this.y;
    this._pos(e);
    if (!this.down) return;
    const ddx = this.x - px, ddy = this.y - py;
    this._accX += ddx; this._accY += ddy;
    this.moved += Math.hypot(ddx, ddy);

    if (this.pivotX !== null) {
      const vx = this.x - this.pivotX, vy = this.y - this.pivotY;
      if (Math.hypot(vx, vy) > 14) {
        const a = Math.atan2(vy, vx);
        if (this._prevAngle !== null) {
          let d = a - this._prevAngle;
          if (d > Math.PI) d -= TWO_PI;
          else if (d < -Math.PI) d += TWO_PI;
          this._accTurn += d;
        }
        this._prevAngle = a;
      }
    }
  }
  _up() {
    if (!this.down) return;
    this.down = false;
    this.justUp = true;
    if (this.moved < 14 && performance.now() - this._downT < 400) this.taps++;
    this._prevAngle = null;
  }

  /** call once per frame, after setPivot */
  update(dt) {
    this.dx = this._accX; this.dy = this._accY;
    this._accX = 0; this._accY = 0;
    this.turn = this._accTurn; this._accTurn = 0;
    if (!this.down) this._prevAngle = null;

    const inst = dt > 0 ? Math.hypot(this.dx, this.dy) / dt : 0;
    this.speed = THREE.MathUtils.lerp(this.speed, inst, Math.min(1, dt * 12));
    const spinInst = dt > 0 ? Math.abs(this.turn) / dt : 0;
    this.spin = THREE.MathUtils.lerp(this.spin, spinInst, Math.min(1, dt * 8));
  }
  endFrame() { this.justDown = false; this.justUp = false; }
  takeTap() { if (this.taps > 0) { this.taps--; return true; } return false; }
}
