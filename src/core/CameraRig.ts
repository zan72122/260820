import { PerspectiveCamera, Vector3 } from 'three';
import { clamp, damp } from './Easing';

export interface Shot {
  name: string;
  /** Direction the camera sits in, relative to the target. Normalised. */
  dir: Vector3;
  target: Vector3;
  /** Radius of the sphere that must fit on screen. Distance is derived from
   *  this and the live aspect ratio, so framing survives every phone shape. */
  fit: number;
  /** Vertical field of view in degrees. Small = intimate and compressed. */
  fov: number;
  /** How fast the camera converges. Low = a slow, deliberate move. */
  rate?: number;
  /** Handheld micro-motion. 0 for locked-off, 1 for held-in-the-hand. */
  handheld?: number;
}

export function shot(
  name: string, from: [number, number, number], target: [number, number, number],
  fit: number, fov: number, rate = 2.6, handheld = 0.6,
): Shot {
  const t = new Vector3(...target);
  const dir = new Vector3(...from).sub(t).normalize();
  return { name, dir, target: t, fit, fov, rate, handheld };
}

/**
 * The camera is never the player's to steer. Each verb has a shot, and the rig
 * carries the player between them — so the reveal lands as a cut-in, not as
 * something they might be pointed the wrong way for.
 */
export class CameraRig {
  readonly camera: PerspectiveCamera;

  private current: Shot;
  private pos = new Vector3();
  private look = new Vector3();
  private fov: number;
  private aspect = 1;

  private shakeAmp = 0;
  private shakeT = 0;
  private time = 0;
  private targetOverride: Vector3 | null = null;
  private dolly = 0;
  private dollyTarget = 0;

  constructor(camera: PerspectiveCamera, initial: Shot) {
    this.camera = camera;
    this.current = initial;
    this.fov = initial.fov;
    this.look.copy(initial.target);
    this.pos.copy(this.solve(initial, initial.target));
    this.apply();
  }

  private solve(s: Shot, target: Vector3): Vector3 {
    const vHalf = (s.fov * Math.PI) / 360;
    // A very tall phone would otherwise drag the camera absurdly far back to
    // satisfy the horizontal fit. Past 5:3 the framing stops getting wider.
    const hHalf = Math.atan(Math.tan(vHalf) * Math.max(this.aspect, 0.60));
    const half = Math.max(0.06, Math.min(vHalf, hHalf));
    const dist = (s.fit / Math.tan(half)) * (1 + this.dolly);
    return new Vector3().copy(target).addScaledVector(s.dir, dist);
  }

  setAspect(aspect: number): void {
    this.aspect = aspect;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Ease to a new shot. */
  to(s: Shot): void {
    this.current = s;
  }

  /** Jump instantly — used on scene reset. */
  cut(s: Shot): void {
    this.current = s;
    this.fov = s.fov;
    this.look.copy(this.effectiveTarget());
    this.pos.copy(this.solve(s, this.look));
    this.apply();
  }

  /** Follow a moving object (the stone once it is picked up). */
  follow(p: Vector3 | null): void {
    this.targetOverride = p;
  }

  /** Push in or pull out from the current shot, -0.5 .. 1. */
  setDolly(v: number): void {
    this.dollyTarget = clamp(v, -0.6, 1.5);
  }

  impulse(amp: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
  }

  private effectiveTarget(): Vector3 {
    return this.targetOverride ?? this.current.target;
  }

  get shotName(): string { return this.current.name; }

  update(dt: number): void {
    this.time += dt;
    const s = this.current;
    const rate = s.rate ?? 2.6;

    this.dolly = damp(this.dolly, this.dollyTarget, 3.0, dt);
    this.look.lerp(this.effectiveTarget(), 1 - Math.exp(-rate * 1.15 * dt));
    const want = this.solve(s, this.look);
    this.pos.lerp(want, 1 - Math.exp(-rate * dt));
    this.fov = damp(this.fov, s.fov, rate * 1.1, dt);

    this.shakeAmp = damp(this.shakeAmp, 0, 7.5, dt);
    this.shakeT += dt * 34;

    this.apply();
  }

  private apply(): void {
    const s = this.current;
    const hh = (s.handheld ?? 0.6) * 0.0075;
    const t = this.time;
    // Two incommensurable frequencies read as a hand, not as a sine wave.
    const bx = (Math.sin(t * 0.63) * 0.6 + Math.sin(t * 1.47 + 1.3) * 0.4) * hh;
    const by = (Math.sin(t * 0.81 + 2.1) * 0.6 + Math.sin(t * 1.93) * 0.4) * hh;

    const sx = Math.sin(this.shakeT * 1.7) * this.shakeAmp;
    const sy = Math.sin(this.shakeT * 2.3 + 1.1) * this.shakeAmp;

    this.camera.position.set(this.pos.x + bx + sx, this.pos.y + by + sy, this.pos.z);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.look.x, this.look.y + by * 0.4, this.look.z);
  }
}
