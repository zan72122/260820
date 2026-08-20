import * as THREE from 'three';
import { clamp, damp } from '../core/math';

/**
 * One finger, always.
 *
 * A second touch is ignored outright rather than being given a second job, so
 * there is no way to end up holding the tool with one hand and operating it
 * with another. Everything the player does is a press, a drag and a release
 * from a single pointer.
 */
export class Pointer {
  active = false;
  /** Normalised device coords of the current position. */
  readonly ndc = new THREE.Vector2();
  readonly startNdc = new THREE.Vector2();
  /** Pixel delta since the previous frame. */
  readonly delta = new THREE.Vector2();
  /** Pixels per second, smoothed. */
  readonly velocity = new THREE.Vector2();
  /** Total pixel distance travelled since press. */
  travel = 0;
  justPressed = false;
  justReleased = false;

  private last = new THREE.Vector2();
  private pixel = new THREE.Vector2();
  private startPixel = new THREE.Vector2();
  private id: number | null = null;
  private element: HTMLElement;
  private accum = new THREE.Vector2();

  constructor(element: HTMLElement) {
    this.element = element;
    element.addEventListener('pointerdown', this.onDown, { passive: false });
    element.addEventListener('pointermove', this.onMove, { passive: false });
    element.addEventListener('pointerup', this.onUp, { passive: false });
    element.addEventListener('pointercancel', this.onUp, { passive: false });
    element.addEventListener('lostpointercapture', this.onUp, { passive: false });
    // Stop iOS from turning a two-finger drag into a page zoom.
    element.addEventListener('gesturestart', preventDefault as EventListener, { passive: false });
    element.addEventListener('touchmove', preventDefault as EventListener, { passive: false });
    element.addEventListener('contextmenu', preventDefault as EventListener);
  }

  private setFromEvent(e: PointerEvent): void {
    const rect = this.element.getBoundingClientRect();
    this.pixel.set(e.clientX - rect.left, e.clientY - rect.top);
    this.ndc.set(
      (this.pixel.x / Math.max(1, rect.width)) * 2 - 1,
      -(this.pixel.y / Math.max(1, rect.height)) * 2 + 1,
    );
  }

  private onDown = (e: PointerEvent): void => {
    if (this.id !== null) return; // a second finger gets no say
    e.preventDefault();
    this.id = e.pointerId;
    this.element.setPointerCapture?.(e.pointerId);
    this.setFromEvent(e);
    this.startNdc.copy(this.ndc);
    this.startPixel.copy(this.pixel);
    this.last.copy(this.pixel);
    this.accum.set(0, 0);
    this.velocity.set(0, 0);
    this.travel = 0;
    this.active = true;
    this.justPressed = true;
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.id) return;
    e.preventDefault();
    this.setFromEvent(e);
    this.accum.add(new THREE.Vector2(this.pixel.x - this.last.x, this.pixel.y - this.last.y));
    this.travel += this.last.distanceTo(this.pixel);
    this.last.copy(this.pixel);
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.id) return;
    e.preventDefault?.();
    this.element.releasePointerCapture?.(e.pointerId);
    this.id = null;
    this.active = false;
    this.justReleased = true;
  };

  /** Call once per frame, before the game reads anything. */
  beginFrame(dt: number): void {
    this.delta.copy(this.accum);
    this.accum.set(0, 0);
    const instant = new THREE.Vector2(this.delta.x / Math.max(dt, 1e-4), this.delta.y / Math.max(dt, 1e-4));
    this.velocity.set(
      damp(this.velocity.x, instant.x, 18, dt),
      damp(this.velocity.y, instant.y, 18, dt),
    );
  }

  endFrame(): void {
    this.justPressed = false;
    this.justReleased = false;
  }

  /** Fraction of the viewport's smaller axis the pointer has travelled. */
  dragFraction(axis: 'x' | 'y'): number {
    const rect = this.element.getBoundingClientRect();
    const base = Math.max(1, Math.min(rect.width, rect.height));
    return (this.pixel[axis] - this.startPixel[axis]) / base;
  }

  dispose(): void {
    this.element.removeEventListener('pointerdown', this.onDown);
    this.element.removeEventListener('pointermove', this.onMove);
    this.element.removeEventListener('pointerup', this.onUp);
    this.element.removeEventListener('pointercancel', this.onUp);
    this.element.removeEventListener('lostpointercapture', this.onUp);
    this.element.removeEventListener('gesturestart', preventDefault as EventListener);
    this.element.removeEventListener('touchmove', preventDefault as EventListener);
    this.element.removeEventListener('contextmenu', preventDefault as EventListener);
  }
}

function preventDefault(e: Event): void {
  e.preventDefault();
}

/**
 * A one-dimensional control with gain and momentum.
 *
 * A four-year-old's drag is short and jerky. The gain turns a small swipe into
 * a meaningful stroke, and the momentum carries it the rest of the way. Let go
 * halfway, or drag back the other way, and it does not break: it either holds
 * where it got to (`ratchet`) or settles gently back to neutral.
 */
export class DragAxis {
  value = 0;
  private velocity = 0;
  private engaged = false;
  private peak = 0;

  constructor(
    /** Screen fractions per unit of value. */
    public gain = 1.6,
    /** Hold the highest value reached instead of falling back. */
    public ratchet = false,
    public min = 0,
    public max = 1,
  ) {}

  begin(): void {
    this.engaged = true;
    this.velocity = 0;
  }

  /** `deltaFraction` is signed drag distance as a fraction of the short axis. */
  drive(deltaFraction: number, dt: number): void {
    if (!this.engaged) return;
    const step = deltaFraction * this.gain;
    let next = clamp(this.value + step, this.min, this.max);
    if (this.ratchet) {
      // A lever holding a load does not spring back. It gives a little under
      // a reverse push and then holds, so a wrong-way drag can never undo
      // progress or leave the mechanism disagreeing with the plant.
      this.peak = Math.max(this.peak, next);
      next = Math.max(next, this.peak - 0.06);
      this.peak = Math.max(this.peak, next);
    }
    if (dt > 0) this.velocity = (next - this.value) / dt;
    this.value = next;
  }

  release(): void {
    this.engaged = false;
  }

  get isEngaged(): boolean {
    return this.engaged;
  }

  update(dt: number): void {
    if (this.engaged) return;
    if (Math.abs(this.velocity) > 0.02) {
      // Carry the stroke past where the finger stopped.
      this.value = clamp(this.value + this.velocity * dt, this.min, this.max);
      if (this.ratchet) {
        this.peak = Math.max(this.peak, this.value);
        this.value = Math.max(this.value, this.peak - 0.06);
      }
      this.velocity *= Math.exp(-4.5 * dt);
      if (this.value <= this.min || this.value >= this.max) this.velocity = 0;
    } else {
      this.velocity = 0;
      if (!this.ratchet) {
        this.value = damp(this.value, this.min, 5.5, dt);
      }
    }
  }

  reset(): void {
    this.value = this.min;
    this.peak = this.min;
    this.velocity = 0;
    this.engaged = false;
  }
}

/**
 * Counts side-to-side strokes. A stroke lands when the finger reverses after
 * moving far enough; stopping mid-way or wiggling never counts twice.
 */
export class RockGesture {
  /** Live rocking offset, -1..1, fed straight to the plant's sway. */
  offset = 0;
  strokes = 0;
  private direction = 0;
  private peak = 0;
  private engaged = false;

  constructor(
    private threshold = 0.055,
    private gain = 2.6,
  ) {}

  begin(): void {
    this.engaged = true;
    this.direction = 0;
    this.peak = 0;
  }

  /** Returns true on the frame a stroke completes. */
  drive(deltaFraction: number, dt: number): boolean {
    if (!this.engaged) return false;
    this.offset = clamp(this.offset + deltaFraction * this.gain, -1, 1);
    void dt;
    const dir = Math.sign(deltaFraction);
    if (dir !== 0 && dir !== this.direction) {
      // direction changed: the previous swing is finished
      if (Math.abs(this.peak) >= this.threshold * this.gain) {
        this.direction = dir;
        this.peak = 0;
        return true;
      }
      this.direction = dir;
      this.peak = 0;
    }
    this.peak += deltaFraction * this.gain;
    if (Math.abs(this.peak) >= 0.55) {
      this.peak = 0;
      this.direction = -dir;
      return true;
    }
    return false;
  }

  release(): void {
    this.engaged = false;
    this.direction = 0;
    this.peak = 0;
  }

  update(dt: number): void {
    if (!this.engaged) {
      // Settles back upright on its own; never leaves the plant leaning.
      this.offset = damp(this.offset, 0, 6.5, dt);
    }
  }

  reset(): void {
    this.offset = 0;
    this.strokes = 0;
    this.direction = 0;
    this.peak = 0;
    this.engaged = false;
  }
}

/** Ray helper shared by every hit test. */
export class Picker {
  private raycaster = new THREE.Raycaster();

  constructor(private camera: THREE.Camera) {}

  /** Distance in pixels-equivalent from the pointer to a world point. */
  screenDistance(point: THREE.Vector3, ndc: THREE.Vector2, aspect: number): number {
    const p = point.clone().project(this.camera);
    // Scale x by aspect so the tolerance is a circle on screen, not an ellipse.
    return Math.hypot((p.x - ndc.x) * aspect, p.y - ndc.y);
  }

  intersect(ndc: THREE.Vector2, objects: THREE.Object3D[]): THREE.Intersection | null {
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(objects, true);
    return hits.length > 0 ? hits[0]! : null;
  }

  /** Where the pointer ray meets a horizontal plane at height y. */
  onPlane(ndc: THREE.Vector2, y: number, out: THREE.Vector3): boolean {
    this.raycaster.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    return this.raycaster.ray.intersectPlane(plane, out) !== null;
  }

  /** Where the pointer ray meets a plane facing the camera through `origin`. */
  onFacingPlane(ndc: THREE.Vector2, origin: THREE.Vector3, out: THREE.Vector3): boolean {
    this.raycaster.setFromCamera(ndc, this.camera);
    const normal = new THREE.Vector3();
    this.camera.getWorldDirection(normal);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal.negate(), origin);
    return this.raycaster.ray.intersectPlane(plane, out) !== null;
  }
}
