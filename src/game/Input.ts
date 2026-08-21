import * as THREE from 'three';

/**
 * One finger, and a deliberately generous reading of what it did.
 *
 * The recogniser never decides that a gesture failed. It accumulates what the
 * finger has done since the last frame in four channels; the phase in progress
 * picks the channel it cares about. A wobbly, slow or crooked swipe still
 * moves the machine, only a little more slowly.
 */
export class Input {
  private el: HTMLElement;
  private activeId: number | null = null;
  private last = new THREE.Vector2();
  private start = new THREE.Vector2();
  private lastDir = new THREE.Vector2();
  private lastMoveTime = 0;

  private down = 0; // downward travel, normalised to the short screen side
  private forward = 0; // upward / away travel
  private lateral = 0; // absolute sideways travel
  private reversals = 0; // direction flips: this is what "shaking" means
  private arc = 0; // accumulated turning * path length
  private lastLateralSign = 0;

  startedOnLever = false;
  isDown = false;
  speed = 0; // recent finger speed, screen fractions per second
  lastActivity = 0;
  pointer = new THREE.Vector2();

  private leverScreen = new THREE.Vector2(-1000, -1000);
  private leverRadius = 90;

  constructor(el: HTMLElement) {
    this.el = el;
    el.addEventListener('pointerdown', this.onDown, { passive: false });
    el.addEventListener('pointermove', this.onMove, { passive: false });
    el.addEventListener('pointerup', this.onUp, { passive: false });
    el.addEventListener('pointercancel', this.onUp, { passive: false });
    el.addEventListener('pointerleave', this.onUp, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.lastActivity = performance.now();
  }

  setLeverHotspot(p: THREE.Vector2, radius: number) {
    this.leverScreen.copy(p);
    this.leverRadius = radius;
  }

  private norm() {
    return Math.min(window.innerWidth, window.innerHeight) || 1;
  }

  private onDown = (e: PointerEvent) => {
    e.preventDefault();
    if (this.activeId !== null) return; // strictly one finger drives the machine
    this.activeId = e.pointerId;
    this.isDown = true;
    this.last.set(e.clientX, e.clientY);
    this.start.copy(this.last);
    this.pointer.copy(this.last);
    this.lastDir.set(0, 0);
    this.lastLateralSign = 0;
    this.lastMoveTime = performance.now();
    this.lastActivity = this.lastMoveTime;
    this.startedOnLever = this.last.distanceTo(this.leverScreen) < this.leverRadius;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety */
    }
  };

  private onMove = (e: PointerEvent) => {
    if (this.activeId !== e.pointerId) return;
    e.preventDefault();
    const now = performance.now();
    const dt = Math.max(0.001, (now - this.lastMoveTime) / 1000);
    this.lastMoveTime = now;
    this.lastActivity = now;
    const x = e.clientX;
    const y = e.clientY;
    const dx = x - this.last.x;
    const dy = y - this.last.y;
    this.last.set(x, y);
    this.pointer.set(x, y);
    const n = this.norm();
    const ndx = dx / n;
    const ndy = dy / n;
    const dist = Math.hypot(ndx, ndy);
    if (dist < 1e-5) return;

    this.speed = dist / dt;
    if (ndy > 0) this.down += ndy;
    else this.forward += -ndy;
    this.lateral += Math.abs(ndx);

    const sign = Math.sign(ndx);
    if (sign !== 0 && this.lastLateralSign !== 0 && sign !== this.lastLateralSign && Math.abs(ndx) > 0.006) {
      this.reversals += 1;
    }
    if (sign !== 0 && Math.abs(ndx) > 0.004) this.lastLateralSign = sign;

    // turning: how much the path bends, times how far it travelled
    const dir = new THREE.Vector2(ndx, ndy).normalize();
    if (this.lastDir.lengthSq() > 0) {
      const cross = Math.abs(this.lastDir.x * dir.y - this.lastDir.y * dir.x);
      const dot = this.lastDir.dot(dir);
      const turn = Math.atan2(cross, dot);
      this.arc += Math.min(turn, 0.8) * dist * 6 + dist * 0.35;
    }
    this.lastDir.copy(dir);
  };

  private onUp = (e: PointerEvent) => {
    if (this.activeId !== e.pointerId) return;
    this.activeId = null;
    this.isDown = false;
    this.startedOnLever = false;
    this.speed = 0;
    this.lastDir.set(0, 0);
    this.lastActivity = performance.now();
    try {
      this.el.releasePointerCapture(e.pointerId);
    } catch {
      /* already gone */
    }
  };

  /** Distance from the touch start, normalised — used for lever hit slop. */
  get travel() {
    return this.last.distanceTo(this.start) / this.norm();
  }

  consumeDown() {
    const v = this.down;
    this.down = 0;
    return v;
  }
  consumeForward() {
    const v = this.forward;
    this.forward = 0;
    return v;
  }
  consumeLateral() {
    const v = { travel: this.lateral, reversals: this.reversals };
    this.lateral = 0;
    this.reversals = 0;
    return v;
  }
  consumeArc() {
    const v = this.arc;
    this.arc = 0;
    return v;
  }

  /** Any motion at all, used only for "has the child touched anything yet". */
  get idleMs() {
    return performance.now() - this.lastActivity;
  }

  dispose() {
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointercancel', this.onUp);
    this.el.removeEventListener('pointerleave', this.onUp);
  }
}
