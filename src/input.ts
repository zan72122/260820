import * as THREE from 'three';

// One-finger interaction:
//  - drag / circle on the handwheel  -> turntable
//  - vertical drag on the tall lever -> lamp height (H machine, stage 2)
//  - forward swipe after completion  -> next machine
// The touch targets are generous invisible proxies; the shadow and the
// finger stay far apart on screen by construction (wheel low, screen high).

export interface InputHandlers {
  onWheel(deltaWheelRad: number): void;
  onLever(deltaMeters: number): void;
  onSwipe(): void;
  onAnyTouch(): void;
  wheelProxy(): THREE.Object3D | null;
  leverProxy(): THREE.Object3D | null;
  wheelCenterWorld(): THREE.Vector3;
  swipeEnabled(): boolean;
}

export class InputController {
  private raycaster = new THREE.Raycaster();
  private pointerId: number | null = null;
  private mode: 'wheel' | 'lever' | 'swipe' | 'none' = 'none';
  private lastX = 0;
  private lastY = 0;
  private startX = 0;
  private startY = 0;
  private wheelCenterPx = new THREE.Vector2();
  private swiped = false;
  dragging = false;
  leverDragging = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: THREE.PerspectiveCamera,
    private h: InputHandlers,
  ) {
    canvas.addEventListener('pointerdown', this.onDown, { passive: false });
    window.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp, { passive: false });
    window.addEventListener('pointercancel', this.onUp, { passive: false });
  }

  private projectToPx(v: THREE.Vector3, out: THREE.Vector2): void {
    const p = v.clone().project(this.camera);
    out.set(
      (p.x * 0.5 + 0.5) * this.canvas.clientWidth,
      (-p.y * 0.5 + 0.5) * this.canvas.clientHeight,
    );
  }

  private onDown = (e: PointerEvent): void => {
    if (this.pointerId !== null) return;
    e.preventDefault();
    this.h.onAnyTouch();
    this.pointerId = e.pointerId;
    this.lastX = this.startX = e.clientX;
    this.lastY = this.startY = e.clientY;
    this.swiped = false;

    const rect = this.canvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.camera);

    if (this.h.swipeEnabled()) {
      this.mode = 'swipe';
      return;
    }

    const lever = this.h.leverProxy();
    if (lever) {
      const hitL = this.raycaster.intersectObject(lever, false);
      if (hitL.length > 0) {
        this.mode = 'lever';
        this.leverDragging = true;
        return;
      }
    }
    const wheel = this.h.wheelProxy();
    if (wheel) {
      const hitW = this.raycaster.intersectObject(wheel, false);
      if (hitW.length > 0) {
        this.mode = 'wheel';
        this.dragging = true;
        this.projectToPx(this.h.wheelCenterWorld(), this.wheelCenterPx);
        return;
      }
    }
    // fallback: a drag starting in the lower part of the view drives the wheel
    if (e.clientY > rect.top + rect.height * 0.55) {
      this.mode = 'wheel';
      this.dragging = true;
      this.projectToPx(this.h.wheelCenterWorld(), this.wheelCenterPx);
      return;
    }
    this.mode = 'none';
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;

    if (this.mode === 'wheel') {
      const cx = this.wheelCenterPx.x, cy = this.wheelCenterPx.y;
      const rx = e.clientX - cx, ry = e.clientY - cy;
      const r = Math.hypot(rx, ry);
      let dAng: number;
      if (r > 46) {
        const a1 = Math.atan2(ry - dy, rx - dx);
        const a2 = Math.atan2(ry, rx);
        let da = a2 - a1;
        if (da > Math.PI) da -= Math.PI * 2;
        if (da < -Math.PI) da += Math.PI * 2;
        dAng = da;
      } else {
        dAng = dx / 90;
      }
      dAng = THREE.MathUtils.clamp(dAng, -0.25, 0.25);
      if (dAng !== 0) this.h.onWheel(dAng);
    } else if (this.mode === 'lever') {
      if (dy !== 0) this.h.onLever(-dy * 0.0026);
    } else if (this.mode === 'swipe' && !this.swiped) {
      const totX = e.clientX - this.startX;
      const totY = e.clientY - this.startY;
      if (Math.hypot(totX, totY) > 64) {
        this.swiped = true;
        this.h.onSwipe();
      }
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.mode = 'none';
    this.dragging = false;
    this.leverDragging = false;
  };
}
