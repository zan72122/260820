import * as THREE from 'three';
import { Config } from './config';

export interface PointerSample {
  x: number;
  y: number;
  t: number;
}

/**
 * One pointer, touch or mouse, with the tool tip lifted above the finger so a
 * small hand never covers the petal being made.
 */
export class PointerInput {
  down = false;
  /** Raw CSS pixel position of the finger. */
  readonly raw = new THREE.Vector2();
  /** Where the piping tip is drawn: `tipLiftPx` above the finger. */
  readonly lifted = new THREE.Vector2();
  /** Normalised device coords of the lifted point, for raycasting. */
  readonly ndc = new THREE.Vector2();
  /** CSS px/second, smoothed. */
  speed = 0;
  downTime = 0;
  private activeId: number | null = null;
  private history: PointerSample[] = [];
  private listeners: Array<(kind: 'down' | 'move' | 'up' | 'cancel') => void> = [];

  constructor(private el: HTMLElement) {
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', this.onDown, { passive: false });
    el.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onCancel);
    window.addEventListener('blur', this.onCancel);
    document.addEventListener('visibilitychange', this.onVisibility);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  on(fn: (kind: 'down' | 'move' | 'up' | 'cancel') => void) {
    this.listeners.push(fn);
  }

  private emit(kind: 'down' | 'move' | 'up' | 'cancel') {
    for (const fn of this.listeners) fn(kind);
  }

  private setFrom(e: PointerEvent) {
    const now = performance.now();
    this.raw.set(e.clientX, e.clientY);
    this.lifted.set(e.clientX, e.clientY - Config.tipLiftPx);
    this.ndc.set(
      (this.lifted.x / window.innerWidth) * 2 - 1,
      -(this.lifted.y / window.innerHeight) * 2 + 1,
    );
    this.history.push({ x: e.clientX, y: e.clientY, t: now });
    while (this.history.length > 6) this.history.shift();
    const first = this.history[0];
    const last = this.history[this.history.length - 1];
    const dt = (last.t - first.t) / 1000;
    this.speed = dt > 1e-4 ? Math.hypot(last.x - first.x, last.y - first.y) / dt : 0;
  }

  private onDown = (e: PointerEvent) => {
    if (this.activeId !== null) return;
    e.preventDefault();
    this.activeId = e.pointerId;
    this.el.setPointerCapture?.(e.pointerId);
    this.history.length = 0;
    this.setFrom(e);
    this.down = true;
    this.downTime = performance.now();
    this.speed = 0;
    this.emit('down');
  };

  private onMove = (e: PointerEvent) => {
    if (this.activeId !== null && e.pointerId !== this.activeId) return;
    e.preventDefault();
    this.setFrom(e);
    if (this.down) this.emit('move');
  };

  private onUp = (e: PointerEvent) => {
    if (this.activeId === null || e.pointerId !== this.activeId) return;
    this.activeId = null;
    if (!this.down) return;
    this.down = false;
    this.emit('up');
  };

  private onCancel = () => {
    this.activeId = null;
    if (!this.down) return;
    this.down = false;
    this.emit('cancel');
  };

  /** Backgrounding the tab must never leave the bag extruding. */
  private onVisibility = () => {
    if (document.visibilityState === 'hidden') this.onCancel();
  };

  /** Test hook: drive the game without real pointer hardware. */
  simulate(kind: 'down' | 'move' | 'up', x: number, y: number) {
    const ev = { clientX: x, clientY: y, pointerId: -1, preventDefault() {} } as unknown as PointerEvent;
    if (kind === 'down') {
      this.activeId = null;
      this.onDown(ev);
    } else if (kind === 'move') {
      this.activeId = -1;
      this.onMove(ev);
    } else {
      this.activeId = -1;
      this.onUp(ev);
    }
  }
}
