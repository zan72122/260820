import * as THREE from 'three';

export type GestureMode = 'none' | 'insert' | 'rotate' | 'insert-or-rotate' | 'door';

export interface GestureHost {
  /** current interpretation of a drag, decided by game state */
  getMode(): GestureMode;
  /** screen-space direction (unit px vector) that means "deeper into the lock" */
  getInsertAxis(): THREE.Vector2;
  /** screen-space position of the plug center, for arc gestures */
  getPlugCenter(): THREE.Vector2;
  onInsertDelta(px: number): void;
  onRotateDelta(rad: number): void;
  onDoorDelta(px: number): void;
  onDragEnd(): void;
  onTap(): void;
}

/**
 * Pointer gesture layer. One finger does everything:
 * - swipes are projected onto the insertion axis, so diagonal swipes still
 *   insert cleanly;
 * - when the key is fully home, arc-like motion around the plug center is
 *   recognised as rotation even when the arc is sloppy;
 * - a short press-and-release is a tap.
 */
export class Gestures {
  private el: HTMLElement;
  private host: GestureHost;
  private active = false;
  private pointerId = -1;
  private last = new THREE.Vector2();
  private start = new THREE.Vector2();
  private travelled = 0;
  private lockedMode: 'insert' | 'rotate' | 'door' | null = null;

  constructor(el: HTMLElement, host: GestureHost) {
    this.el = el;
    this.host = host;
    el.addEventListener('pointerdown', this.onDown, { passive: false });
    el.addEventListener('pointermove', this.onMove, { passive: false });
    el.addEventListener('pointerup', this.onUp, { passive: false });
    el.addEventListener('pointercancel', this.onUp, { passive: false });
  }

  dispose(): void {
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointercancel', this.onUp);
  }

  private onDown = (e: PointerEvent): void => {
    if (this.active) return;
    e.preventDefault();
    this.active = true;
    this.pointerId = e.pointerId;
    this.last.set(e.clientX, e.clientY);
    this.start.copy(this.last);
    this.travelled = 0;
    this.lockedMode = null;
    this.el.setPointerCapture(e.pointerId);
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.active || e.pointerId !== this.pointerId) return;
    e.preventDefault();
    const now = new THREE.Vector2(e.clientX, e.clientY);
    const delta = now.clone().sub(this.last);
    if (delta.lengthSq() === 0) return;
    this.travelled += delta.length();

    const mode = this.host.getMode();
    if (mode === 'none') {
      this.last.copy(now);
      return;
    }

    if (!this.lockedMode && this.travelled > 10) {
      if (mode === 'insert') this.lockedMode = 'insert';
      else if (mode === 'rotate') this.lockedMode = 'rotate';
      else if (mode === 'door') this.lockedMode = 'door';
      else {
        // insert-or-rotate: compare axial motion with arc motion
        const axis = this.host.getInsertAxis();
        const total = now.clone().sub(this.start);
        const axial = Math.abs(total.dot(axis));
        const center = this.host.getPlugCenter();
        const v0 = this.start.clone().sub(center);
        const v1 = now.clone().sub(center);
        const arc = Math.abs(angleBetween(v0, v1)) * Math.max(v0.length(), 60);
        this.lockedMode = axial >= arc ? 'insert' : 'rotate';
      }
    }

    if (this.lockedMode === 'insert') {
      const axis = this.host.getInsertAxis();
      this.host.onInsertDelta(delta.dot(axis));
    } else if (this.lockedMode === 'rotate') {
      const center = this.host.getPlugCenter();
      const v0 = this.last.clone().sub(center);
      const v1 = now.clone().sub(center);
      if (v0.length() > 24 && v1.length() > 24) {
        this.host.onRotateDelta(angleBetween(v0, v1));
      }
    } else if (this.lockedMode === 'door') {
      // pulling right or down opens the door
      this.host.onDoorDelta(delta.x + delta.y * 0.5);
    }
    this.last.copy(now);
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.active || e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.active = false;
    if (this.travelled < 9) this.host.onTap();
    this.host.onDragEnd();
    this.lockedMode = null;
  };
}

/** signed angle from v0 to v1 (screen coords, y down → invert for math sense) */
function angleBetween(v0: THREE.Vector2, v1: THREE.Vector2): number {
  const a = Math.atan2(v0.y, v0.x);
  const b = Math.atan2(v1.y, v1.x);
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
