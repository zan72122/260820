import * as THREE from 'three';
import { StrokeRecorder } from './gestures';

export interface Pointer {
  id: number;
  /** Normalised device coords, -1..1. */
  ndc: THREE.Vector2;
  ndcPrev: THREE.Vector2;
  /** CSS pixels relative to the canvas. */
  x: number;
  y: number;
  dx: number;
  dy: number;
  downX: number;
  downY: number;
  downTime: number;
  /** Set true once the pointer has moved past the tap threshold. */
  moved: boolean;
  longPressFired: boolean;
  recorder: StrokeRecorder;
  /** Scenes stash whatever they grabbed here. */
  grab: unknown;
  /** True for the pointer that owns the current interaction. */
  primary: boolean;
}

export interface InputHandlers {
  onDown?(p: Pointer): void;
  onMove?(p: Pointer): void;
  onUp?(p: Pointer): void;
  onCancel?(p: Pointer): void;
  onLongPress?(p: Pointer): void;
  /** Any pointer contact at all, used to silence hints. */
  onAnyContact?(): void;
}

const LONG_PRESS_MS = 480;
const MOVE_THRESHOLD_PX = 10;

/**
 * Pointer plumbing for a canvas-first game.
 *
 * Robustness rules, straight from the acceptance list: a cancelled or lost
 * pointer releases exactly like a normal lift, extra fingers never hijack an
 * in-flight gesture, and losing focus mid-drag ends the drag cleanly rather
 * than leaving the scene stuck holding something.
 */
export class InputRouter {
  private el: HTMLElement;
  private handlers: InputHandlers = {};
  readonly pointers = new Map<number, Pointer>();
  private primaryId: number | null = null;
  private rect = { left: 0, top: 0, width: 1, height: 1 };
  private disposed = false;

  constructor(el: HTMLElement) {
    this.el = el;
    this.measure();
    el.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    el.addEventListener('pointermove', this.onPointerMove, { passive: false });
    el.addEventListener('pointerup', this.onPointerUp, { passive: false });
    el.addEventListener('pointercancel', this.onPointerCancel, { passive: false });
    el.addEventListener('lostpointercapture', this.onPointerCancel, { passive: false });
    el.addEventListener('contextmenu', this.preventDefault, { passive: false });
    window.addEventListener('blur', this.releaseAll);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  setHandlers(h: InputHandlers): void {
    this.handlers = h;
  }

  measure(): void {
    const r = this.el.getBoundingClientRect();
    this.rect = { left: r.left, top: r.top, width: Math.max(1, r.width), height: Math.max(1, r.height) };
  }

  private preventDefault = (e: Event): void => {
    e.preventDefault();
  };

  private toLocal(e: PointerEvent): { x: number; y: number } {
    return { x: e.clientX - this.rect.left, y: e.clientY - this.rect.top };
  }

  private toNdc(x: number, y: number, out: THREE.Vector2): THREE.Vector2 {
    return out.set((x / this.rect.width) * 2 - 1, -(y / this.rect.height) * 2 + 1);
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (this.disposed) return;
    e.preventDefault();
    const { x, y } = this.toLocal(e);
    const p: Pointer = {
      id: e.pointerId,
      ndc: this.toNdc(x, y, new THREE.Vector2()),
      ndcPrev: this.toNdc(x, y, new THREE.Vector2()),
      x, y, dx: 0, dy: 0,
      downX: x, downY: y,
      downTime: performance.now(),
      moved: false,
      longPressFired: false,
      recorder: new StrokeRecorder(),
      grab: null,
      primary: this.primaryId === null,
    };
    p.recorder.push(x, y, p.downTime);
    this.pointers.set(e.pointerId, p);
    if (p.primary) this.primaryId = e.pointerId;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety, not a requirement */
    }
    this.handlers.onAnyContact?.();
    this.handlers.onDown?.(p);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.disposed) return;
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    const { x, y } = this.toLocal(e);
    p.dx = x - p.x;
    p.dy = y - p.y;
    p.x = x;
    p.y = y;
    p.ndcPrev.copy(p.ndc);
    this.toNdc(x, y, p.ndc);
    p.recorder.push(x, y, performance.now());
    if (!p.moved && Math.hypot(x - p.downX, y - p.downY) > MOVE_THRESHOLD_PX) p.moved = true;
    this.handlers.onMove?.(p);
  };

  private finish(e: PointerEvent, cancelled: boolean): void {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (this.primaryId === e.pointerId) {
      // Promote a still-down finger so a released primary never wedges input.
      const next = this.pointers.values().next();
      this.primaryId = next.done ? null : next.value.id;
      if (!next.done) next.value.primary = true;
    }
    try {
      this.el.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (cancelled) this.handlers.onCancel?.(p);
    else this.handlers.onUp?.(p);
  }

  private onPointerUp = (e: PointerEvent): void => {
    if (this.disposed) return;
    e.preventDefault();
    this.finish(e, false);
  };

  private onPointerCancel = (e: PointerEvent): void => {
    if (this.disposed) return;
    this.finish(e, true);
  };

  /** Called on blur / hidden tab: a drag must never survive losing focus. */
  releaseAll = (): void => {
    for (const p of [...this.pointers.values()]) {
      this.pointers.delete(p.id);
      this.handlers.onCancel?.(p);
    }
    this.primaryId = null;
  };

  private onVisibility = (): void => {
    if (document.visibilityState === 'hidden') this.releaseAll();
  };

  /** Fires long-press callbacks; call once per frame. */
  update(): void {
    const now = performance.now();
    for (const p of this.pointers.values()) {
      if (!p.longPressFired && !p.moved && now - p.downTime >= LONG_PRESS_MS) {
        p.longPressFired = true;
        this.handlers.onLongPress?.(p);
      }
    }
  }

  get activeCount(): number {
    return this.pointers.size;
  }

  get primary(): Pointer | null {
    return this.primaryId === null ? null : this.pointers.get(this.primaryId) ?? null;
  }

  dispose(): void {
    this.disposed = true;
    this.releaseAll();
    const el = this.el;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointercancel', this.onPointerCancel);
    el.removeEventListener('lostpointercapture', this.onPointerCancel);
    el.removeEventListener('contextmenu', this.preventDefault);
    window.removeEventListener('blur', this.releaseAll);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
}

/** Shared raycaster with helpers scenes use to hit-test their props. */
export class Picker {
  readonly raycaster = new THREE.Raycaster();

  intersect(
    ndc: THREE.Vector2,
    camera: THREE.Camera,
    objects: THREE.Object3D[],
    recursive = true,
  ): THREE.Intersection[] {
    this.raycaster.setFromCamera(ndc, camera);
    return this.raycaster.intersectObjects(objects, recursive);
  }

  first(
    ndc: THREE.Vector2,
    camera: THREE.Camera,
    objects: THREE.Object3D[],
    recursive = true,
  ): THREE.Intersection | null {
    const hits = this.intersect(ndc, camera, objects, recursive);
    return hits.length ? hits[0] : null;
  }

  /** Ray against an arbitrary plane; used for dragging things along a surface. */
  onPlane(
    ndc: THREE.Vector2,
    camera: THREE.Camera,
    plane: THREE.Plane,
    out = new THREE.Vector3(),
  ): THREE.Vector3 | null {
    this.raycaster.setFromCamera(ndc, camera);
    return this.raycaster.ray.intersectPlane(plane, out);
  }
}
