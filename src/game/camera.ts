import * as THREE from 'three';
import { clamp, damp } from '../core/util';

export interface Framing {
  /** point on the sand the shot is built around */
  tx: number;
  ty: number;
  tz: number;
  /** ground area that must stay readable, in world units */
  w: number;
  d: number;
  /** degrees above the horizon */
  pitch: number;
  margin?: number;
  fov?: number;
  /** how quickly the move settles, in seconds of half-life */
  ease?: number;
}

/**
 * The camera is a teaching instrument, not a toy: the child never drives it.
 * Each shot declares the ground area that must stay readable and the rig
 * solves the distance for the current screen, so portrait and landscape get
 * genuinely different compositions of the same terrain.
 */
export class CameraRig {
  private target = new THREE.Vector3(0, 0, 0);
  private eye = new THREE.Vector3(0, 6, 7);
  private curTarget = new THREE.Vector3(0, 0, 0);
  private curEye = new THREE.Vector3(0, 6, 7);
  private fov = 45;
  private curFov = 45;
  private ease = 0.5;
  private yaw = 0;

  portrait = true;

  constructor(private cam: THREE.PerspectiveCamera) {}

  setOrientation(portrait: boolean) {
    this.portrait = portrait;
    // Landscape re-stages the shot from the upstream-left side so the
    // channel runs across the screen instead of into the distance.
    this.yaw = portrait ? 0 : -Math.PI / 2;
  }

  apply(f: Framing) {
    this.target.set(f.tx, f.ty, f.tz);
    this.fov = f.fov ?? 44;
    this.ease = f.ease ?? 0.55;

    const aspect = this.cam.aspect;
    const pitch = (f.pitch * Math.PI) / 180;
    const margin = f.margin ?? 1.08;

    // Rotate the requested footprint into camera space before fitting.
    const cy = Math.abs(Math.cos(this.yaw));
    const sy = Math.abs(Math.sin(this.yaw));
    const spanH = f.w * cy + f.d * sy;
    const spanD = f.d * cy + f.w * sy;

    const vFov = (this.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const vertExtent = spanD * Math.sin(pitch) + 0.75 * Math.cos(pitch);
    const distV = vertExtent / 2 / Math.tan(vFov / 2);
    const distH = spanH / 2 / Math.tan(hFov / 2);
    const dist = Math.max(distV, distH) * margin;

    const horiz = Math.cos(pitch) * dist;
    this.eye.set(
      this.target.x + Math.sin(this.yaw) * horiz,
      Math.max(0.42, this.target.y + Math.sin(pitch) * dist),
      this.target.z + Math.cos(this.yaw) * horiz,
    );
  }

  snap() {
    this.curTarget.copy(this.target);
    this.curEye.copy(this.eye);
    this.curFov = this.fov;
  }

  update(dt: number) {
    const h = this.ease;
    this.curTarget.x = damp(this.curTarget.x, this.target.x, h, dt);
    this.curTarget.y = damp(this.curTarget.y, this.target.y, h, dt);
    this.curTarget.z = damp(this.curTarget.z, this.target.z, h, dt);
    this.curEye.x = damp(this.curEye.x, this.eye.x, h, dt);
    this.curEye.y = damp(this.curEye.y, this.eye.y, h, dt);
    this.curEye.z = damp(this.curEye.z, this.eye.z, h, dt);
    this.curFov = damp(this.curFov, this.fov, h, dt);

    this.cam.position.copy(this.curEye);
    this.cam.position.y = Math.max(0.4, this.cam.position.y);
    this.cam.lookAt(this.curTarget);
    if (Math.abs(this.cam.fov - this.curFov) > 0.01) {
      this.cam.fov = this.curFov;
      this.cam.updateProjectionMatrix();
    }
  }

  /** 0 = settled, 1 = still travelling. Used to hold beats until we arrive. */
  get travel() {
    return clamp(this.curEye.distanceTo(this.eye) / 2.2, 0, 1);
  }
}
