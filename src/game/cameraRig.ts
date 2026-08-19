import { PerspectiveCamera, Vector3 } from 'three/webgpu';
import { clamp, clamp01, damp } from '../core/mathx';

/**
 * The camera is the direction, not a control. The player never moves it.
 *
 * Two things it must never do: cut, and spin. Every shot is expressed as a
 * desired eye and a desired look-at, and both are exponentially damped, so the
 * move from "crouched in a dark wing" to "standing in front of two hundred
 * parents" is one unbroken travelling shot.
 */
export class CameraRig {
  readonly camera: PerspectiveCamera;
  readonly desiredPos = new Vector3();
  readonly desiredLook = new Vector3();
  private look = new Vector3();
  /** 0 = wide landscape, 1 = tall phone held upright. */
  portrait = 0;
  /** Higher = stiffer follow. */
  posSmoothing = 0.0016;
  lookSmoothing = 0.0009;
  private breathe = 0;
  private shake = 0;
  private aspect = 1.777;

  constructor() {
    this.camera = new PerspectiveCamera(47, 1.777, 0.05, 90);
    this.camera.position.set(6.05, 1.5, 3.6);
    this.look.set(4.95, 1.5, 1.6);
  }

  resize(width: number, height: number): void {
    this.aspect = width / Math.max(1, height);
    this.camera.aspect = this.aspect;
    // Keep roughly the same amount of world in frame however the tablet is
    // held: widen vertically as the viewport gets taller and narrower.
    const refAspect = 1.777;
    const refV = 47;
    const f = Math.sqrt(refAspect / Math.max(0.35, this.aspect));
    const v = (2 * Math.atan(Math.tan((refV * Math.PI) / 360) * f) * 180) / Math.PI;
    this.camera.fov = clamp(v, 44, 80);
    this.portrait = clamp01((1.25 - this.aspect) / 0.75);
    this.camera.updateProjectionMatrix();
  }

  /** Extra distance so a portrait viewport still contains the subject. */
  get distanceScale(): number {
    return 1 + this.portrait * 0.34;
  }

  setShot(pos: Vector3, look: Vector3): void {
    this.desiredPos.copy(pos);
    this.desiredLook.copy(look);
  }

  /** A small, one-off jolt. Used once, when the house curtain thumps open. */
  bump(amount: number): void {
    this.shake = Math.min(0.05, this.shake + amount);
  }

  snap(): void {
    this.camera.position.copy(this.desiredPos);
    this.look.copy(this.desiredLook);
    this.camera.lookAt(this.look);
  }

  update(dt: number, _time: number): void {
    this.camera.position.x = damp(this.camera.position.x, this.desiredPos.x, this.posSmoothing, dt);
    this.camera.position.y = damp(this.camera.position.y, this.desiredPos.y, this.posSmoothing, dt);
    this.camera.position.z = damp(this.camera.position.z, this.desiredPos.z, this.posSmoothing, dt);

    this.look.x = damp(this.look.x, this.desiredLook.x, this.lookSmoothing, dt);
    this.look.y = damp(this.look.y, this.desiredLook.y, this.lookSmoothing, dt);
    this.look.z = damp(this.look.z, this.desiredLook.z, this.lookSmoothing, dt);

    // A whisper of handheld life. Any more and a four-year-old feels seasick.
    this.breathe += dt;
    const bx = Math.sin(this.breathe * 0.63) * 0.006 + Math.sin(this.breathe * 1.31) * 0.003;
    const by = Math.sin(this.breathe * 0.79 + 1.1) * 0.005;

    this.shake = Math.max(0, this.shake - dt * 0.12);
    const sx = this.shake * Math.sin(this.breathe * 41) * 0.6;
    const sy = this.shake * Math.sin(this.breathe * 37 + 2) * 0.6;

    this.camera.position.x += bx + sx;
    this.camera.position.y += by + sy;
    this.camera.lookAt(this.look.x, this.look.y + by * 0.4, this.look.z);
  }
}
