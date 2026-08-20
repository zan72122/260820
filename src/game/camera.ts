import * as THREE from 'three';
import { clamp, damp } from '../core/util';
import { terrainHeight } from '../world/terrain';

export type ShotSpec = {
  /** What the shot is about. */
  focus: THREE.Vector3;
  /** Horizontal direction from focus toward the camera. */
  back: THREE.Vector3;
  dist: number;
  height: number;
  /** Extra distance/fov in portrait, where the frame is narrow. */
  portraitDist?: number;
  fov?: number;
  /** Positive lifts the subject higher in frame (away from the thumb). */
  lift?: number;
  rate?: number;
};

/**
 * The child never drives the camera. Every shot is damped toward its target
 * so cause and effect are never cut apart by a jump.
 */
export class CameraRig {
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private fov = 46;
  private targetPos = new THREE.Vector3();
  private targetLook = new THREE.Vector3();
  private targetFov = 46;
  private rate = 2.6;
  private initialised = false;

  constructor(private camera: THREE.PerspectiveCamera) {}

  apply(spec: ShotSpec, portrait: boolean) {
    const back = spec.back.clone().setY(0).normalize();
    const distScale = portrait ? spec.portraitDist ?? 1.24 : 1;
    const dist = spec.dist * distScale;
    this.targetPos
      .copy(spec.focus)
      .addScaledVector(back, dist)
      .add(new THREE.Vector3(0, spec.height, 0));

    const lift = spec.lift ?? 1;
    // In portrait the subject is pushed above centre so fingers stay clear.
    const drop = portrait ? 0.16 * dist * lift : 0.05 * dist * lift;
    this.targetLook.copy(spec.focus).add(new THREE.Vector3(0, -drop, 0));
    this.targetFov = spec.fov ?? (portrait ? 54 : 44);
    this.rate = spec.rate ?? 2.6;

    if (!this.initialised) {
      this.initialised = true;
      this.pos.copy(this.targetPos);
      this.look.copy(this.targetLook);
      this.fov = this.targetFov;
    }
  }

  update(dt: number) {
    if (!this.initialised) return;
    const r = this.rate;
    this.pos.set(
      damp(this.pos.x, this.targetPos.x, r, dt),
      damp(this.pos.y, this.targetPos.y, r, dt),
      damp(this.pos.z, this.targetPos.z, r, dt),
    );
    this.look.set(
      damp(this.look.x, this.targetLook.x, r * 1.15, dt),
      damp(this.look.y, this.targetLook.y, r * 1.15, dt),
      damp(this.look.z, this.targetLook.z, r * 1.15, dt),
    );
    this.fov = damp(this.fov, this.targetFov, 3.2, dt);

    // never let the lens dip into the soil
    const floor = terrainHeight(this.pos.x, this.pos.z) + 0.14;
    const y = Math.max(this.pos.y, floor);
    this.camera.position.set(this.pos.x, y, this.pos.z);
    this.camera.lookAt(this.look);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = clamp(this.fov, 30, 70);
      this.camera.updateProjectionMatrix();
    }
  }

  get lookAt() {
    return this.look;
  }

  snap() {
    this.pos.copy(this.targetPos);
    this.look.copy(this.targetLook);
    this.fov = this.targetFov;
  }
}
