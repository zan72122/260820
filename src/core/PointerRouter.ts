import * as THREE from 'three';
import { Signal } from './Signals';

export type GrabTarget = 'chestpiece' | 'bulb' | 'valve' | null;

interface Anchor {
  world: THREE.Vector3;
  /** Acceptance radius in metres; converted to pixels for the hit test. */
  radius: number;
  /** Never let the touch target fall below this many CSS pixels. */
  minPx: number;
}

/**
 * One finger, three things to touch. Hit testing happens in screen space
 * against projected anchors with a floor on the pixel radius, so a small
 * brass valve is still a comfortable target on a phone, in either orientation.
 */
export class PointerRouter {
  readonly onGrab = new Signal<GrabTarget>();
  readonly onChestpieceMove = new Signal<THREE.Vector3>();
  readonly onChestpieceDrop = new Signal<void>();
  readonly onBulbPress = new Signal<number>();
  readonly onBulbStroke = new Signal<number>();
  readonly onBulbRelease = new Signal<void>();
  readonly onValveArc = new Signal<number>();
  readonly onAnyPointer = new Signal<void>();
  readonly onTapEmptySpace = new Signal<void>();

  /** Live anchors, refreshed by the game each frame. */
  readonly anchors: Record<Exclude<GrabTarget, null>, Anchor> = {
    chestpiece: { world: new THREE.Vector3(), radius: 0.05, minPx: 56 },
    bulb: { world: new THREE.Vector3(), radius: 0.05, minPx: 54 },
    valve: { world: new THREE.Vector3(), radius: 0.032, minPx: 54 },
  };

  /** Plane the chestpiece slides on while lifted. */
  dragHeight = 0.8;
  /**
   * The bulb and the valve genuinely sit within a few centimetres of each
   * other on a real sphygmomanometer, so whichever one the exercise is waiting
   * for wins a tie. A stray touch is then forgiving rather than frustrating.
   */
  preferred: GrabTarget = null;

  private grab: GrabTarget = null;
  private camera: THREE.Camera;
  private el: HTMLElement;
  private rect = { x: 0, y: 0, w: 1, h: 1 };
  private lastPointer = new THREE.Vector2();
  private downPointer = new THREE.Vector2();
  private moved = false;
  private valveCenterPx = new THREE.Vector2();
  private valveLastAngle = 0;
  private valveSign = 0;
  private bulbLastY = 0;
  private bulbDir = 0;
  private pointerId: number | null = null;
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane();
  private hit = new THREE.Vector3();

  constructor(el: HTMLElement, camera: THREE.Camera) {
    this.el = el;
    this.camera = camera;
    el.addEventListener('pointerdown', this.onDown, { passive: false });
    el.addEventListener('pointermove', this.onMove, { passive: false });
    el.addEventListener('pointerup', this.onUp, { passive: false });
    el.addEventListener('pointercancel', this.onUp, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setViewport(x: number, y: number, w: number, h: number): void {
    this.rect = { x, y, w, h };
  }

  private toScreen(v: THREE.Vector3): THREE.Vector2 {
    const p = v.clone().project(this.camera);
    return new THREE.Vector2(
      ((p.x + 1) / 2) * this.rect.w,
      ((1 - p.y) / 2) * this.rect.h,
    );
  }

  private radiusPx(a: Anchor): number {
    const right = new THREE.Vector3();
    this.camera.matrixWorld.extractBasis(right, new THREE.Vector3(), new THREE.Vector3());
    const edge = a.world.clone().addScaledVector(right, a.radius);
    const px = this.toScreen(a.world).distanceTo(this.toScreen(edge));
    return Math.max(a.minPx, px);
  }

  private pick(p: THREE.Vector2): GrabTarget {
    const order: Exclude<GrabTarget, null>[] = ['valve', 'bulb', 'chestpiece'];
    let best: GrabTarget = null;
    let bestScore = Infinity;
    for (const name of order) {
      const a = this.anchors[name];
      const c = this.toScreen(a.world);
      const r = this.radiusPx(a);
      const d = c.distanceTo(p);
      const score = (d / r) * (name === this.preferred ? 0.55 : 1);
      if (d <= r && score < bestScore) {
        bestScore = score;
        best = name;
      }
    }
    return best;
  }

  private local(e: PointerEvent): THREE.Vector2 {
    return new THREE.Vector2(e.clientX - this.rect.x, e.clientY - this.rect.y);
  }

  private onDown = (e: PointerEvent): void => {
    if (this.pointerId !== null) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    this.el.setPointerCapture?.(e.pointerId);
    const p = this.local(e);
    this.downPointer.copy(p);
    this.lastPointer.copy(p);
    this.moved = false;
    this.onAnyPointer.emit();

    this.grab = this.pick(p);
    this.onGrab.emit(this.grab);

    if (this.grab === 'bulb') {
      this.bulbLastY = p.y;
      this.bulbDir = 0;
      this.onBulbPress.emit(0);
    } else if (this.grab === 'valve') {
      this.valveCenterPx.copy(this.toScreen(this.anchors.valve.world));
      this.valveLastAngle = Math.atan2(p.y - this.valveCenterPx.y, p.x - this.valveCenterPx.x);
      this.valveSign = 0;
    }
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    const p = this.local(e);
    if (p.distanceTo(this.downPointer) > 6) this.moved = true;
    this.onAnyPointer.emit();

    if (this.grab === 'chestpiece') {
      this.dragChestpiece(p);
    } else if (this.grab === 'bulb') {
      const dy = p.y - this.bulbLastY;
      if (Math.abs(dy) > 3) {
        const dir = Math.sign(dy);
        // A reversal in a swipe is another complete squeeze of the bulb.
        if (this.bulbDir !== 0 && dir !== this.bulbDir) {
          this.onBulbStroke.emit((p.x - this.rect.w / 2) / this.rect.w);
        }
        this.bulbDir = dir;
        this.bulbLastY = p.y;
      }
    } else if (this.grab === 'valve') {
      this.turnValve(p);
    }
    this.lastPointer.copy(p);
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.el.releasePointerCapture?.(e.pointerId);
    this.pointerId = null;
    if (this.grab === 'chestpiece') this.onChestpieceDrop.emit();
    else if (this.grab === 'bulb') this.onBulbRelease.emit();
    else if (this.grab === null && !this.moved) this.onTapEmptySpace.emit();
    this.grab = null;
    this.onGrab.emit(null);
  };

  private dragChestpiece(p: THREE.Vector2): void {
    const ndc = new THREE.Vector2(
      (p.x / this.rect.w) * 2 - 1,
      -(p.y / this.rect.h) * 2 + 1,
    );
    this.ray.setFromCamera(ndc, this.camera as THREE.PerspectiveCamera);
    this.plane.set(new THREE.Vector3(0, 1, 0), -this.dragHeight);
    if (this.ray.ray.intersectPlane(this.plane, this.hit)) {
      this.onChestpieceMove.emit(this.hit.clone());
    }
  }

  private turnValve(p: THREE.Vector2): void {
    const d = new THREE.Vector2(p.x - this.valveCenterPx.x, p.y - this.valveCenterPx.y);
    if (d.length() < 14) {
      // Too close to the spindle for a meaningful angle: read the drag instead.
      const dx = p.x - this.lastPointer.x;
      if (Math.abs(dx) > 0.5) this.onValveArc.emit(Math.abs(dx) * 0.012);
      return;
    }
    const angle = Math.atan2(d.y, d.x);
    let delta = angle - this.valveLastAngle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    this.valveLastAngle = angle;
    if (Math.abs(delta) < 1e-4) return;
    // The direction of the first real movement becomes "opening" for this
    // gesture, so a wobbling finger never undoes the child's own progress.
    if (this.valveSign === 0 && Math.abs(delta) > 0.02) this.valveSign = Math.sign(delta);
    if (this.valveSign === 0) return;
    const forward = delta * this.valveSign;
    if (forward > 0) this.onValveArc.emit(forward);
  }

  get grabbing(): GrabTarget {
    return this.grab;
  }

  dispose(): void {
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointercancel', this.onUp);
  }
}
