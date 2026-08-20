/**
 * One finger. That is the whole control scheme.
 *
 *   put a finger down  -> the poi comes off the rim and follows it, sinking
 *                         to just under the surface
 *   slide              -> the poi slides under the fish
 *   drag upward, or
 *   simply let go      -> the poi rises out of the water
 *
 * Letting go is the important one: lifting your finger lifts the poi. A
 * four-year-old finds that by accident on the first try, and it is the same
 * gesture as the real thing.
 *
 * Depth is never controlled directly. The finger addresses a point on the
 * water plane; how deep the paper sits is decided by `lift`, which this class
 * derives from the gesture.
 */

import { clamp } from './Rng.js';

const LIFT_VELOCITY_THRESHOLD = 85; // px/s of upward travel before it counts
const LIFT_GAIN = 1 / 240; // px/s of upward travel -> lift units per second
const LIFT_SINK = 1.55; // how fast the poi settles back down when held still
const RELEASE_LIFT = 1 / 0.42; // releasing completes the lift in ~0.42s

export class Input {
  /** @param {HTMLElement} el */
  constructor(el) {
    this.el = el;
    this.active = false;
    this.pointerId = null;

    /** CSS pixels, relative to the canvas */
    this.x = 0;
    this.y = 0;
    this.prevX = 0;
    this.prevY = 0;
    /** normalised device coords for raycasting */
    this.ndcX = 0;
    this.ndcY = 0;

    /** smoothed screen velocity, px/s */
    this.vx = 0;
    this.vy = 0;

    /** 0 = paper fully in the water, 1 = paper clear of the surface */
    this.lift = 1;
    this.everTouched = false;
    this.justPressed = false;
    this.justReleased = false;
    this.holdTime = 0;

    this._pendingPress = false;
    this._pendingRelease = false;
    this._scripted = null;

    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onGesture = (e) => e.preventDefault();

    const opts = { passive: false };
    el.addEventListener('pointerdown', this._onDown, opts);
    window.addEventListener('pointermove', this._onMove, opts);
    window.addEventListener('pointerup', this._onUp, opts);
    window.addEventListener('pointercancel', this._onUp, opts);
    // iOS Safari pinch-zoom lives outside pointer events.
    el.addEventListener('gesturestart', this._onGesture, opts);
    el.addEventListener('gesturechange', this._onGesture, opts);
    el.addEventListener('touchmove', this._onGesture, opts);
    el.addEventListener('contextmenu', this._onGesture, opts);
  }

  dispose() {
    const el = this.el;
    el.removeEventListener('pointerdown', this._onDown);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointercancel', this._onUp);
    el.removeEventListener('gesturestart', this._onGesture);
    el.removeEventListener('gesturechange', this._onGesture);
    el.removeEventListener('touchmove', this._onGesture);
    el.removeEventListener('contextmenu', this._onGesture);
  }

  _local(e) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  }

  _onDown(e) {
    if (this.active) return;
    e.preventDefault();
    this.active = true;
    this.pointerId = e.pointerId;
    const p = this._local(e);
    this.x = this.prevX = p.x;
    this.y = this.prevY = p.y;
    this._setNdc(p);
    this.vx = this.vy = 0;
    this.holdTime = 0;
    this._pendingPress = true;
    this.everTouched = true;
    if (this.el.setPointerCapture) {
      try {
        this.el.setPointerCapture(e.pointerId);
      } catch {
        /* Safari occasionally refuses capture on a released pointer */
      }
    }
  }

  _onMove(e) {
    if (!this.active || e.pointerId !== this.pointerId) return;
    e.preventDefault();
    const p = this._local(e);
    this.x = p.x;
    this.y = p.y;
    this._setNdc(p);
  }

  _onUp(e) {
    if (!this.active || e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.active = false;
    this.pointerId = null;
    this._pendingRelease = true;
  }

  _setNdc(p) {
    this.ndcX = (p.x / Math.max(p.w, 1)) * 2 - 1;
    this.ndcY = -((p.y / Math.max(p.h, 1)) * 2 - 1);
  }

  /** Scripted input for automated tests: {x, y, down} in CSS pixels. */
  script(cmd) {
    this._scripted = cmd;
    if (cmd) {
      const r = this.el.getBoundingClientRect();
      const p = { x: cmd.x, y: cmd.y, w: r.width || 1, h: r.height || 1 };
      if (cmd.down && !this.active) {
        this.active = true;
        this.pointerId = -1;
        this.x = this.prevX = cmd.x;
        this.y = this.prevY = cmd.y;
        this._pendingPress = true;
        this.everTouched = true;
      } else if (!cmd.down && this.active) {
        this.active = false;
        this.pointerId = null;
        this._pendingRelease = true;
      }
      if (cmd.down) {
        this.x = cmd.x;
        this.y = cmd.y;
      }
      this._setNdc(p);
    }
  }

  /** @param {number} dt seconds */
  update(dt) {
    this.justPressed = this._pendingPress;
    this.justReleased = this._pendingRelease;
    this._pendingPress = false;
    this._pendingRelease = false;

    const inv = dt > 1e-4 ? 1 / dt : 0;
    const rawVx = (this.x - this.prevX) * inv;
    const rawVy = (this.y - this.prevY) * inv;
    // Heavy smoothing: a small hand is shaky, and a shaky poi tears paper.
    const k = 1 - Math.exp(-14 * dt);
    this.vx += (rawVx - this.vx) * k;
    this.vy += (rawVy - this.vy) * k;
    this.prevX = this.x;
    this.prevY = this.y;

    if (this.active) {
      this.holdTime += dt;
      if (this.justPressed) this.lift = Math.min(this.lift, 0.85);
      const up = -this.vy; // positive when the finger travels up the screen
      if (up > LIFT_VELOCITY_THRESHOLD) {
        this.lift += (up - LIFT_VELOCITY_THRESHOLD) * LIFT_GAIN * dt * 3.4;
      } else {
        // A finger that stops, or moves down, lets the paper settle back in.
        const sink = LIFT_SINK * (this.vy > 40 ? 1.8 : 1);
        this.lift -= sink * dt;
      }
    } else {
      this.holdTime = 0;
      this.lift += RELEASE_LIFT * dt;
    }
    this.lift = clamp(this.lift, 0, 1);
    return this.lift;
  }

  /** Screen speed in px/s, used to keep the poi calm when the hand is calm. */
  get speed() {
    return Math.hypot(this.vx, this.vy);
  }
}
