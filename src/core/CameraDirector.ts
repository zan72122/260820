import * as THREE from 'three';

/**
 * The player never steers the camera.  Every phase of the work has one
 * "best chair in the house", and the director glides (or hard-cuts)
 * between them with a little engine shake on top.
 */
export class CameraDirector {
  private pos = new THREE.Vector3(0, 6, -12);
  private look = new THREE.Vector3(0, 1.4, 0);
  private fov = 55;

  private wantPos = new THREE.Vector3(0, 6, -12);
  private wantLook = new THREE.Vector3(0, 1.4, 0);
  private wantFov = 55;

  /** higher = stiffer follow */
  private stiffness = 3.2;
  private shakeAmp = 0;
  private shakeTime = 0;
  private pendingCut = true;

  private tmp = new THREE.Vector3();

  constructor(private camera: THREE.PerspectiveCamera) {}

  /** Desired framing for this frame. */
  aim(pos: THREE.Vector3, look: THREE.Vector3, fov = 55, stiffness = 3.2) {
    this.wantPos.copy(pos);
    this.wantLook.copy(look);
    this.wantFov = fov;
    this.stiffness = stiffness;
  }

  /** Snap on the next update — used when changing shot. */
  cut() {
    this.pendingCut = true;
  }

  shake(amount: number) {
    this.shakeAmp = Math.max(this.shakeAmp, amount);
  }

  update(dt: number) {
    if (this.pendingCut) {
      this.pos.copy(this.wantPos);
      this.look.copy(this.wantLook);
      this.fov = this.wantFov;
      this.pendingCut = false;
    } else {
      const k = 1 - Math.exp(-this.stiffness * dt);
      this.pos.lerp(this.wantPos, k);
      this.look.lerp(this.wantLook, k);
      this.fov += (this.wantFov - this.fov) * k;
    }

    this.shakeTime += dt;
    this.shakeAmp *= Math.exp(-4.5 * dt);
    const s = this.shakeAmp;

    this.tmp.copy(this.pos);
    if (s > 0.0004) {
      this.tmp.x += Math.sin(this.shakeTime * 41.3) * s;
      this.tmp.y += Math.sin(this.shakeTime * 33.7 + 1.7) * s * 1.25;
      this.tmp.z += Math.sin(this.shakeTime * 27.1 + 0.6) * s * 0.6;
    }
    this.camera.position.copy(this.tmp);
    this.camera.lookAt(this.look);

    // The engine's own base FOV comes from orientation; shots scale it.
    const base = this.camera.userData.baseFov as number | undefined;
    const target = base ? this.fov * (base / 55) : this.fov;
    if (Math.abs(this.camera.fov - target) > 0.01) {
      this.camera.fov = target;
      this.camera.updateProjectionMatrix();
    }
  }
}
