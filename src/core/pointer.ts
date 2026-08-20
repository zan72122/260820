import * as THREE from 'three';

/**
 * One-finger input only. A second touch is ignored outright rather than
 * fighting the first, so a four-year-old resting a palm on the glass
 * cannot break a drag that is already in progress.
 */
export class Pointer {
  down = false;
  justDown = false;
  justUp = false;
  x = 0;
  y = 0;
  px = 0;
  py = 0;
  dx = 0;
  dy = 0;
  startX = 0;
  startY = 0;
  /** Accumulated finger travel in CSS px for this press. */
  path = 0;
  downTime = 0;
  /** Increments on every press, so a gesture cannot leak into the next phase. */
  pressId = 0;
  vx = 0;
  vy = 0;
  private id: number | null = null;
  private pendingDown = false;
  private pendingUp = false;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();

  constructor(private el: HTMLElement) {
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('lostpointercapture', this.onUp);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // Safari still emits gesture events for pinch-zoom on some builds.
    for (const n of ['gesturestart', 'gesturechange', 'gestureend']) {
      el.addEventListener(n, (e) => e.preventDefault());
    }
  }

  private onDown = (e: PointerEvent) => {
    if (this.id !== null) return;
    this.id = e.pointerId;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety, not a requirement */
    }
    this.x = this.px = this.startX = e.clientX;
    this.y = this.py = this.startY = e.clientY;
    this.dx = this.dy = 0;
    this.path = 0;
    this.vx = this.vy = 0;
    this.down = true;
    this.pendingDown = true;
    this.pressId++;
    this.downTime = performance.now();
    e.preventDefault();
  };

  private onMove = (e: PointerEvent) => {
    if (this.id !== e.pointerId) return;
    this.x = e.clientX;
    this.y = e.clientY;
    e.preventDefault();
  };

  private onUp = (e: PointerEvent) => {
    if (this.id !== e.pointerId) return;
    this.id = null;
    this.down = false;
    this.pendingUp = true;
    try {
      this.el.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  /** Call once per frame, before game logic. */
  update(dt: number) {
    this.justDown = this.pendingDown;
    this.justUp = this.pendingUp;
    this.pendingDown = false;
    this.pendingUp = false;
    this.dx = this.x - this.px;
    this.dy = this.y - this.py;
    this.path += Math.hypot(this.dx, this.dy);
    const k = dt > 0 ? 1 / dt : 0;
    this.vx = this.vx * 0.7 + this.dx * k * 0.3;
    this.vy = this.vy * 0.7 + this.dy * k * 0.3;
    this.px = this.x;
    this.py = this.y;
  }

  ndcAt(x = this.x, y = this.y) {
    this.ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    return this.ndc;
  }

  ray(camera: THREE.Camera, x = this.x, y = this.y) {
    this.raycaster.setFromCamera(this.ndcAt(x, y), camera);
    return this.raycaster;
  }

  /** Where the finger lands on a horizontal plane at height `y`. */
  planePoint(camera: THREE.Camera, y: number, out = new THREE.Vector3()): THREE.Vector3 | null {
    const r = this.ray(camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    return r.ray.intersectPlane(plane, out);
  }

  /** Distance from press origin in CSS px. */
  get dragDist() {
    return Math.hypot(this.x - this.startX, this.y - this.startY);
  }
}
