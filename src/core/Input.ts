import { Object3D, PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three';

const _v = new Vector3();

export interface PointerContext {
  ndc: Vector2;
  screen: Vector2;
  delta: Vector2;
  ray: Raycaster;
  camera: PerspectiveCamera;
  hit: Vector3 | null;
  dragTime: number;
}

export interface Grabbable {
  id: string;
  /** resolved at touch time, so a fitted plate stops being a shelf plate */
  objects: () => Object3D[];
  enabled: () => boolean;
  onDown?: (ctx: PointerContext) => void;
  onMove?: (ctx: PointerContext) => void;
  onUp?: (ctx: PointerContext) => void;
}

/**
 * One finger, nothing else. Every control in the game is a drag, a turn or
 * a swipe; there are no menus in the play area and no pinch or two-finger
 * gestures anywhere.
 */
export class Input {
  private readonly grabs: Grabbable[] = [];
  private active: Grabbable | null = null;
  private readonly ray = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly screen = new Vector2();
  private readonly delta = new Vector2();
  private readonly plane = new Plane();
  private readonly hitPoint = new Vector3();
  private pointerId = -1;
  private dragTime = 0;
  private lastTouchAt = 0;
  onIdleBreak: (() => void) | null = null;

  constructor(
    private readonly el: HTMLElement,
    private readonly camera: PerspectiveCamera,
  ) {
    el.addEventListener('pointerdown', this.down, { passive: false });
    window.addEventListener('pointermove', this.move, { passive: false });
    window.addEventListener('pointerup', this.up, { passive: false });
    window.addEventListener('pointercancel', this.up, { passive: false });
    window.addEventListener('blur', this.release);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  register(g: Grabbable): void {
    this.grabs.push(g);
  }

  get idleFor(): number {
    return (performance.now() - this.lastTouchAt) / 1000;
  }

  get dragging(): boolean {
    return this.active !== null;
  }

  get activeId(): string | null {
    return this.active?.id ?? null;
  }

  private ctx(): PointerContext {
    return {
      ndc: this.ndc,
      screen: this.screen,
      delta: this.delta,
      ray: this.ray,
      camera: this.camera,
      hit: null,
      dragTime: this.dragTime,
    };
  }

  private updatePointer(e: PointerEvent): void {
    const r = this.el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    this.delta.set(x - this.screen.x, y - this.screen.y);
    this.screen.set(x, y);
    this.ndc.set((x / r.width) * 2 - 1, -((y / r.height) * 2 - 1));
    this.ray.setFromCamera(this.ndc, this.camera);
  }

  /** One finger only, and never stuck: a new touch always supersedes. */
  private release = (): void => {
    if (this.active) {
      this.active.onUp?.(this.ctx());
      this.active = null;
    }
    this.pointerId = -1;
  };

  private down = (e: PointerEvent): void => {
    if (this.pointerId !== -1) this.release();
    this.pointerId = e.pointerId;
    this.lastTouchAt = performance.now();
    this.onIdleBreak?.();
    const r = this.el.getBoundingClientRect();
    this.screen.set(e.clientX - r.left, e.clientY - r.top);
    this.updatePointer(e);
    this.delta.set(0, 0);
    this.dragTime = 0;

    let best: { g: Grabbable; d: number } | null = null;
    for (const g of this.grabs) {
      if (!g.enabled()) continue;
      const objs = g.objects();
      if (objs.length === 0) continue;
      const hits = this.ray.intersectObjects(objs, true);
      if (hits.length && (!best || hits[0].distance < best.d)) {
        best = { g, d: hits[0].distance };
        this.hitPoint.copy(hits[0].point);
      }
    }
    if (!best) return;
    this.active = best.g;
    const c = this.ctx();
    c.hit = this.hitPoint;
    this.active.onDown?.(c);
  };

  private move = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.lastTouchAt = performance.now();
    this.updatePointer(e);
    if (!this.active) return;
    e.preventDefault();
    this.dragTime += 1 / 60;
    this.active.onMove?.(this.ctx());
  };

  private up = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.lastTouchAt = performance.now();
    this.release();
  };

  /** Where the finger is, on a plane through `through` facing the camera. */
  screenPlanePoint(through: Vector3, out: Vector3): Vector3 {
    const n = new Vector3();
    this.camera.getWorldDirection(n);
    this.plane.setFromNormalAndCoplanarPoint(n, through);
    this.ray.ray.intersectPlane(this.plane, out);
    return out;
  }

  /** Screen-space position of a world point, in NDC. */
  toNdc(world: Vector3, out: Vector2): Vector2 {
    const p = _v.copy(world).project(this.camera);
    return out.set(p.x, p.y);
  }

  /** Angle of the finger around a fixed screen point. Fixed, so a camera
   *  that is still easing cannot amplify the turn under the child's finger. */
  angleAround(centre: Vector2): number {
    return Math.atan2(this.ndc.y - centre.y, this.ndc.x - centre.x);
  }

  dispose(): void {
    this.el.removeEventListener('pointerdown', this.down);
    window.removeEventListener('pointermove', this.move);
    window.removeEventListener('pointerup', this.up);
    window.removeEventListener('pointercancel', this.up);
    window.removeEventListener('blur', this.release);
  }
}
