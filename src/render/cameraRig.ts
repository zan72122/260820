import * as THREE from 'three';
import { clamp, damp, easeInOutCubic } from '../core/math';

export type PoseName = 'intro' | 'front' | 'test' | 'result';

interface Pose {
  /** offset from the focus point. */
  offset: THREE.Vector3;
  /** look target offset from the focus point. */
  lookOffset: THREE.Vector3;
  fov: number;
}

/**
 * Camera grammar: 3/4 establishing view -> near-frontal for adjusting the
 * gap -> low tracking view during the test -> back to frontal for the
 * result, so the pair always reads as letters again.
 */
export class CameraRig {
  camera: THREE.PerspectiveCamera;
  /** world x the rig frames (pair center / gap center). */
  focusX = 0;
  private poseName: PoseName = 'intro';
  private from: Pose;
  private to: Pose;
  private t = 1;
  private duration = 1.6;
  private followY = 1.2;
  private followX = 0;
  private aspect = 1;

  private poses: Record<PoseName, Pose> = {
    intro: {
      offset: new THREE.Vector3(3.6, 2.3, 4.9),
      lookOffset: new THREE.Vector3(0, 0.95, 0),
      fov: 46,
    },
    front: {
      offset: new THREE.Vector3(0.25, 1.42, 5.6),
      lookOffset: new THREE.Vector3(0, 1.18, 0),
      fov: 44,
    },
    test: {
      offset: new THREE.Vector3(0.9, 0.75, 5.1),
      lookOffset: new THREE.Vector3(0, 1.0, 0),
      fov: 46,
    },
    result: {
      offset: new THREE.Vector3(-0.15, 1.5, 6.1),
      lookOffset: new THREE.Vector3(0, 1.1, 0),
      fov: 43,
    },
  };

  constructor() {
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 80);
    this.from = this.poses.intro;
    this.to = this.poses.intro;
  }

  setAspect(aspect: number): void {
    this.aspect = aspect;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  get pose(): PoseName {
    return this.poseName;
  }

  goTo(name: PoseName, duration = 1.6): void {
    if (name === this.poseName && this.t >= 1) return;
    this.from = this.currentPose();
    this.to = this.poses[name];
    this.poseName = name;
    this.t = 0;
    this.duration = duration;
  }

  snapTo(name: PoseName): void {
    this.poseName = name;
    this.from = this.poses[name];
    this.to = this.poses[name];
    this.t = 1;
  }

  private currentPose(): Pose {
    const k = easeInOutCubic(clamp(this.t, 0, 1));
    return {
      offset: this.from.offset.clone().lerp(this.to.offset, k),
      lookOffset: this.from.lookOffset.clone().lerp(this.to.lookOffset, k),
      fov: this.from.fov + (this.to.fov - this.from.fov) * k,
    };
  }

  /**
   * followPoint: capsule position during the test, so the low camera keeps
   * the capsule and the negative space in frame together.
   */
  update(dt: number, followPoint: { x: number; y: number } | null): void {
    if (this.t < 1) this.t = Math.min(1, this.t + dt / this.duration);
    const p = this.currentPose();

    let fx = this.focusX;
    let fy = 0;
    if (this.poseName === 'test' && followPoint) {
      this.followX = damp(this.followX, followPoint.x * 0.55, 3, dt);
      this.followY = damp(this.followY, clamp(followPoint.y, 0.35, 2.1) * 0.55, 3, dt);
      fx += this.followX * 0.4;
      fy = this.followY - 0.65;
    } else {
      this.followX = damp(this.followX, 0, 3, dt);
      this.followY = damp(this.followY, 1.2, 3, dt);
    }

    // portrait: pull back a bit less (letters fill the height, sides may
    // crop at very wide spacing — which is honest: the pair doesn't fit).
    // landscape: pull back so pair + machinery + tray fit in one frame.
    const portrait = this.aspect < 1;
    const distScale = portrait ? 1.06 : clamp(1.25 / this.aspect + 0.52, 0.82, 1.2);

    this.camera.position.set(
      fx + p.offset.x * (portrait ? 0.92 : 1),
      p.offset.y + fy * 0.5 + (portrait ? 0.12 : 0),
      p.offset.z * distScale,
    );
    this.camera.lookAt(fx + p.lookOffset.x, p.lookOffset.y + fy + (portrait ? 0.22 : 0), 0);
    const targetFov = portrait ? p.fov + 12 : p.fov;
    if (Math.abs(this.camera.fov - targetFov) > 0.01) {
      this.camera.fov = damp(this.camera.fov, targetFov, 6, dt);
      this.camera.updateProjectionMatrix();
    }
  }
}
