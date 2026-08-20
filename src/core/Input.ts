import * as THREE from 'three';

/**
 * Strictly single-finger input. Extra pointers are ignored on purpose: the
 * water and the suction must never be driven at the same time.
 */
export class Input {
  active = false;
  justPressed = false;
  justReleased = false;
  x = 0;
  y = 0;
  dx = 0;
  dy = 0;
  travel = 0;
  idleTime = 0;
  private pointerId: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private el: HTMLElement;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  /** Fraction of viewport height the tool tip sits above the finger. */
  lift = 0.15;

  constructor(el: HTMLElement) {
    this.el = el;
    el.addEventListener('pointerdown', this.onDown, { passive: false });
    el.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('blur', () => this.release());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.release();
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('gesturestart', (e: Event) => e.preventDefault());
  }

  private onDown = (e: PointerEvent) => {
    e.preventDefault();
    if (this.pointerId !== null) return; // second finger is discarded
    this.pointerId = e.pointerId;
    this.active = true;
    this.justPressed = true;
    this.x = this.lastX = e.clientX;
    this.y = this.lastY = e.clientY;
    this.dx = 0;
    this.dy = 0;
    this.idleTime = 0;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best effort */
    }
  };

  private onMove = (e: PointerEvent) => {
    if (this.pointerId !== e.pointerId) return;
    e.preventDefault();
    this.x = e.clientX;
    this.y = e.clientY;
  };

  private onUp = (e: PointerEvent) => {
    if (this.pointerId === null || e.pointerId !== this.pointerId) return;
    this.release();
  };

  private release() {
    if (this.pointerId === null) return;
    this.pointerId = null;
    this.active = false;
    this.justReleased = true;
    this.dx = 0;
    this.dy = 0;
  }

  /** Force-release; used when the game changes tools mid-gesture. */
  cancel() {
    this.pointerId = null;
    this.active = false;
    this.dx = 0;
    this.dy = 0;
  }

  beginFrame(dt: number) {
    this.dx = this.x - this.lastX;
    this.dy = this.y - this.lastY;
    this.lastX = this.x;
    this.lastY = this.y;
    const moved = Math.hypot(this.dx, this.dy);
    this.travel = moved;
    if (this.active && moved > 0.6) this.idleTime = 0;
    else this.idleTime += dt;
  }

  endFrame() {
    this.justPressed = false;
    this.justReleased = false;
  }

  /**
   * World point under the finger, lifted up the screen so the operator's hands
   * and the soil that is changing are never covered by the finger itself.
   */
  worldOnPlane(camera: THREE.PerspectiveCamera, planeY: number, out: THREE.Vector3): boolean {
    const rect = this.el.getBoundingClientRect();
    const liftPx = rect.height * this.lift;
    const sx = this.x - rect.left;
    const sy = this.y - rect.top - liftPx;
    this.ndc.set((sx / rect.width) * 2 - 1, -(sy / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, camera);
    this.plane.constant = -planeY;
    return this.raycaster.ray.intersectPlane(this.plane, out) !== null;
  }

  /** Screen position of the tool tip (finger position minus the lift). */
  liftedScreen(out: { x: number; y: number }) {
    const rect = this.el.getBoundingClientRect();
    out.x = this.x - rect.left;
    out.y = this.y - rect.top - rect.height * this.lift;
  }
}
