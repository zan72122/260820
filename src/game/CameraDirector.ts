import { PerspectiveCamera, Vector3 } from 'three';
import { damp } from '../core/mathutil';

export type ShotName =
  | 'establishing'
  | 'midShot'
  | 'chestThreeQuarter'
  | 'listening'
  | 'reveal'
  | 'compare'
  | 'play';

interface ShotSpec {
  position: Vector3;
  target: Vector3;
  fov: number;
  /** How briskly the camera moves into this shot. */
  rate: number;
}

type ShotTable = Record<ShotName, ShotSpec>;

const shot = (p: number[], t: number[], fov: number, rate = 1.6): ShotSpec => ({
  position: new Vector3(p[0], p[1], p[2]),
  target: new Vector3(t[0], t[1], t[2]),
  fov,
  rate,
});

/**
 * There is no free camera and no first-person view.
 *
 * The chain runs: the room, the manikin and the instructor, a three-quarter
 * close on the chest and hands, then a locked frame that does not move while
 * the child is listening, a short look inside, and back out to a stable
 * working view that can hold the upper and lower halves of the chest at once.
 */
export class CameraDirector {
  readonly camera: PerspectiveCamera;
  private current: ShotName = 'establishing';
  private pos = new Vector3();
  private target = new Vector3();
  private fov = 42;
  private dynamic: ((out: { position: Vector3; target: Vector3; fov: number }) => void) | null = null;
  private dynamicRate = 2.4;
  private portrait = true;
  private tmp = { position: new Vector3(), target: new Vector3(), fov: 42 };
  private locked = false;

  private landscapeShots: ShotTable = {
    establishing: shot([2.05, 1.95, 2.5], [-0.1, 0.9, -0.2], 46, 1.0),
    midShot: shot([1.15, 1.66, 1.62], [-0.02, 0.86, -0.12], 40, 1.4),
    chestThreeQuarter: shot([0.42, 1.32, 0.72], [-0.02, 0.84, -0.06], 38, 1.8),
    listening: shot([0.34, 1.3, 0.66], [-0.02, 0.845, -0.06], 36, 1.5),
    reveal: shot([0.3, 1.15, 0.35], [-0.02, 0.84, -0.05], 38, 2.2),
    compare: shot([0.5, 1.52, 0.94], [0.06, 0.86, -0.03], 42, 1.5),
    play: shot([0.46, 1.46, 0.9], [0.05, 0.86, -0.04], 42, 1.5),
  };

  private portraitShots: ShotTable = {
    establishing: shot([1.5, 2.2, 2.35], [-0.05, 0.9, -0.2], 52, 1.0),
    midShot: shot([0.72, 1.95, 1.5], [-0.02, 0.86, -0.14], 46, 1.4),
    chestThreeQuarter: shot([0.24, 1.5, 0.66], [-0.02, 0.85, -0.07], 44, 1.8),
    listening: shot([0.2, 1.48, 0.62], [-0.02, 0.85, -0.07], 42, 1.5),
    reveal: shot([0.2, 1.25, 0.34], [-0.02, 0.84, -0.06], 44, 2.2),
    compare: shot([0.26, 1.72, 0.92], [0.02, 0.86, -0.02], 50, 1.5),
    play: shot([0.24, 1.66, 0.88], [0.02, 0.86, -0.03], 50, 1.5),
  };

  constructor() {
    this.camera = new PerspectiveCamera(42, 1, 0.05, 40);
    const s = this.portraitShots.establishing;
    this.pos.copy(s.position);
    this.target.copy(s.target);
    this.fov = s.fov;
    this.apply();
  }

  setViewport(width: number, height: number): void {
    this.portrait = height >= width;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  isPortrait(): boolean {
    return this.portrait;
  }

  private table(): ShotTable {
    return this.portrait ? this.portraitShots : this.landscapeShots;
  }

  setShot(name: ShotName): void {
    this.current = name;
    this.dynamic = null;
  }

  getShot(): ShotName {
    return this.current;
  }

  /** Used by the reveal, which is framed from wherever the chestpiece is. */
  setDynamic(
    fn: (out: { position: Vector3; target: Vector3; fov: number }) => void,
    rate = 2.4,
  ): void {
    this.dynamic = fn;
    this.dynamicRate = rate;
  }

  /**
   * Hold the frame absolutely still. Called whenever the child is meant to be
   * comparing two sounds — a drifting camera is a second variable.
   */
  setLocked(locked: boolean): void {
    this.locked = locked;
  }

  update(dt: number): void {
    let rate: number;
    let wantPos: Vector3;
    let wantTarget: Vector3;
    let wantFov: number;

    if (this.dynamic) {
      this.tmp.fov = this.fov;
      this.dynamic(this.tmp);
      wantPos = this.tmp.position;
      wantTarget = this.tmp.target;
      wantFov = this.tmp.fov;
      rate = this.dynamicRate;
    } else {
      const s = this.table()[this.current];
      wantPos = s.position;
      wantTarget = s.target;
      wantFov = s.fov;
      rate = s.rate;
    }

    if (this.locked) {
      // Still allow an in-progress move to settle, but never start a new drift.
      rate *= 0.55;
      if (this.pos.distanceTo(wantPos) < 0.004) rate = 0;
    }

    if (rate > 0) {
      this.pos.x = damp(this.pos.x, wantPos.x, rate, dt);
      this.pos.y = damp(this.pos.y, wantPos.y, rate, dt);
      this.pos.z = damp(this.pos.z, wantPos.z, rate, dt);
      this.target.x = damp(this.target.x, wantTarget.x, rate, dt);
      this.target.y = damp(this.target.y, wantTarget.y, rate, dt);
      this.target.z = damp(this.target.z, wantTarget.z, rate, dt);
      this.fov = damp(this.fov, wantFov, rate, dt);
    }
    this.apply();
  }

  /** Jump straight to the current shot — used on orientation change. */
  snap(): void {
    const s = this.table()[this.current];
    if (!this.dynamic) {
      this.pos.copy(s.position);
      this.target.copy(s.target);
      this.fov = s.fov;
      this.apply();
    }
  }

  private apply(): void {
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.target);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
