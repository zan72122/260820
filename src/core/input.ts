import { Vector2 } from 'three';

export interface PointerSample {
  /** Normalised device coordinates, -1..1. */
  ndc: Vector2;
  /** CSS pixels. */
  screen: Vector2;
  id: number;
}

export type PointerPhase = 'down' | 'move' | 'up' | 'cancel';

export type PointerHandler = (phase: PointerPhase, p: PointerSample) => void;

/**
 * One-finger pointer plumbing. The game deliberately never needs a second
 * touch: no pinch, no orbit, no two-handed gesture.
 */
export class InputRouter {
  readonly active = new Map<number, PointerSample>();
  private handlers: PointerHandler[] = [];
  private primary: number | null = null;
  private firstGestureFns: (() => void)[] = [];
  private hadGesture = false;

  constructor(private element: HTMLElement) {
    const opts = { passive: false } as AddEventListenerOptions;
    element.addEventListener('pointerdown', this.onDown, opts);
    element.addEventListener('pointermove', this.onMove, opts);
    element.addEventListener('pointerup', this.onUp, opts);
    element.addEventListener('pointercancel', this.onCancel, opts);
    element.addEventListener('contextmenu', (e) => e.preventDefault());
    // Safari still fires these for double-tap zoom on some pages.
    element.addEventListener('gesturestart', (e) => e.preventDefault() as unknown as void);
  }

  onPointer(fn: PointerHandler): void {
    this.handlers.push(fn);
  }

  /** Audio and anything else that must wait for a real user gesture. */
  onFirstGesture(fn: () => void): void {
    if (this.hadGesture) fn();
    else this.firstGestureFns.push(fn);
  }

  private sample(e: PointerEvent): PointerSample {
    const r = this.element.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    return {
      id: e.pointerId,
      screen: new Vector2(x, y),
      ndc: new Vector2((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1),
    };
  }

  private emit(phase: PointerPhase, p: PointerSample): void {
    for (const h of this.handlers) h(phase, p);
  }

  private onDown = (e: PointerEvent): void => {
    e.preventDefault();
    if (!this.hadGesture) {
      this.hadGesture = true;
      for (const fn of this.firstGestureFns) fn();
      this.firstGestureFns.length = 0;
    }
    if (this.primary !== null) return;
    this.primary = e.pointerId;
    const p = this.sample(e);
    this.active.set(e.pointerId, p);
    (this.element as HTMLElement).setPointerCapture?.(e.pointerId);
    this.emit('down', p);
  };

  private onMove = (e: PointerEvent): void => {
    if (this.primary !== e.pointerId) return;
    e.preventDefault();
    const p = this.sample(e);
    this.active.set(e.pointerId, p);
    this.emit('move', p);
  };

  private onUp = (e: PointerEvent): void => {
    if (this.primary !== e.pointerId) return;
    e.preventDefault();
    const p = this.sample(e);
    this.active.delete(e.pointerId);
    this.primary = null;
    this.emit('up', p);
  };

  private onCancel = (e: PointerEvent): void => {
    if (this.primary !== e.pointerId) return;
    const p = this.sample(e);
    this.active.delete(e.pointerId);
    this.primary = null;
    this.emit('cancel', p);
  };
}
