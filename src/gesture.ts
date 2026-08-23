// One-finger circular gesture around a screen-space anchor.
// We measure signed angular velocity around the anchor plus the circle
// radius. The child draws AROUND the loop, so the finger never hides it.

import { clamp, damp } from './util';

export interface GestureState {
  down: boolean;
  engaged: boolean;         // circling around the current anchor
  x: number;                // pointer, css px
  y: number;
  angVel: number;           // rad/s, signed (+ = counter-clockwise on screen)
  smoothAngVel: number;
  radius: number;           // px distance from anchor
  totalAngle: number;       // accumulated |angle| this touch
  dragDX: number;           // horizontal drag (free-steer)
}

export class Gesture {
  state: GestureState = {
    down: false, engaged: false, x: 0, y: 0,
    angVel: 0, smoothAngVel: 0, radius: 0, totalAngle: 0, dragDX: 0,
  };
  anchorX = 0;
  anchorY = 0;
  private lastAngle = 0;
  private lastX = 0;
  private lastT = 0;
  private el: HTMLElement;
  onDown?: (x: number, y: number) => void;
  onUp?: () => void;

  constructor(el: HTMLElement) {
    this.el = el;
    el.addEventListener('pointerdown', this.down, { passive: false });
    el.addEventListener('pointermove', this.move, { passive: false });
    el.addEventListener('pointerup', this.up, { passive: false });
    el.addEventListener('pointercancel', this.up, { passive: false });
    // never let Safari scroll/zoom fight the game
    el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  setAnchor(x: number, y: number) {
    this.anchorX = x;
    this.anchorY = y;
  }

  private down = (e: PointerEvent) => {
    if (this.state.down) return; // single-touch game: ignore extra fingers
    e.preventDefault();
    this.el.setPointerCapture?.(e.pointerId);
    const s = this.state;
    s.down = true;
    s.x = e.clientX; s.y = e.clientY;
    s.totalAngle = 0;
    s.angVel = 0; s.smoothAngVel = 0; s.dragDX = 0;
    this.lastX = e.clientX;
    this.lastAngle = Math.atan2(e.clientY - this.anchorY, e.clientX - this.anchorX);
    this.lastT = performance.now();
    this.onDown?.(e.clientX, e.clientY);
  };

  private move = (e: PointerEvent) => {
    const s = this.state;
    if (!s.down) return;
    e.preventDefault();
    const now = performance.now();
    const dt = Math.max((now - this.lastT) / 1000, 1e-3);
    this.lastT = now;
    s.x = e.clientX; s.y = e.clientY;
    s.dragDX = (e.clientX - this.lastX) / dt;
    this.lastX = e.clientX;
    const dx = e.clientX - this.anchorX;
    const dy = e.clientY - this.anchorY;
    s.radius = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    let d = ang - this.lastAngle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.lastAngle = ang;
    // screen y grows downward: negative d = counter-clockwise visually
    const av = -d / dt;
    s.angVel = clamp(av, -14, 14);
    s.totalAngle += Math.abs(d);
    s.engaged = s.radius > 18;
  };

  private up = (_e: PointerEvent) => {
    const s = this.state;
    s.down = false;
    s.engaged = false;
    s.angVel = 0;
    s.dragDX = 0;
    this.onUp?.();
  };

  update(dt: number) {
    const s = this.state;
    s.smoothAngVel = damp(s.smoothAngVel, s.down ? s.angVel : 0, 8, dt);
    if (!s.down) s.angVel = 0;
  }
}
