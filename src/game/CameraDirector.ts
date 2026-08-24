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
  /** Metres that must be visible across the frame at the subject. */
  width: number;
  /** Metres that must be visible up the frame at the subject. */
  height: number;
  /** How briskly the camera moves into this shot. */
  rate: number;
}

type ShotTable = Record<ShotName, ShotSpec>;

const shot = (p: number[], t: number[], width: number, height: number, rate = 1.6): ShotSpec => ({
  position: new Vector3(p[0], p[1], p[2]),
  target: new Vector3(t[0], t[1], t[2]),
  width,
  height,
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

  // Landscape puts the chest and the record tiles side by side.
  private landscapeShots: ShotTable = {
    establishing: shot([2.35, 2.05, 2.75], [-0.05, 0.95, -0.18], 3.4, 2.2, 1.0),
    midShot: shot([1.4, 1.78, 1.9], [0.0, 0.9, -0.15], 1.95, 1.35, 1.4),
    chestThreeQuarter: shot([0.5, 1.5, 1.12], [-0.02, 0.89, -0.05], 0.76, 0.62, 1.8),
    listening: shot([0.44, 1.5, 1.12], [-0.02, 0.89, -0.05], 0.76, 0.62, 1.5),
    reveal: shot([0.4, 1.2, 0.45], [-0.02, 0.87, -0.05], 0.4, 0.34, 2.2),
    compare: shot([0.92, 1.7, 1.44], [0.26, 0.91, -0.02], 1.75, 0.98, 1.5),
    play: shot([0.9, 1.68, 1.42], [0.26, 0.91, -0.03], 1.75, 0.98, 1.5),
  };

  // Portrait stacks them: the clavicles at the top of the frame, the costal
  // margin at the bottom, and the stand with the tiles below that.
  private portraitShots: ShotTable = {
    establishing: shot([1.95, 2.25, 2.65], [-0.05, 0.95, -0.15], 2.2, 2.5, 1.0),
    midShot: shot([1.05, 1.95, 1.8], [0.0, 0.9, -0.1], 1.15, 1.55, 1.4),
    chestThreeQuarter: shot([0.4, 1.58, 1.06], [-0.01, 0.89, -0.05], 0.56, 0.78, 1.8),
    listening: shot([0.3, 1.6, 1.08], [-0.01, 0.89, -0.05], 0.56, 0.78, 1.5),
    reveal: shot([0.34, 1.24, 0.44], [-0.02, 0.87, -0.05], 0.34, 0.4, 2.2),
    compare: shot([0.32, 2.0, 2.02], [0.02, 0.9, 0.47], 0.92, 2.06, 1.5),
    play: shot([0.3, 1.98, 2.0], [0.02, 0.9, 0.46], 0.92, 2.06, 1.5),
  };

  constructor() {
    this.camera = new PerspectiveCamera(42, 1, 0.05, 40);
    const s = this.portraitShots.establishing;
    this.pos.copy(s.position);
    this.target.copy(s.target);
    this.fov = this.fovFor(s);
    this.apply();
  }

  /**
   * Choose the field of view from what has to fit, not from a fixed number.
   * A phone in portrait and an iPad in landscape have wildly different aspect
   * ratios, and the chest has to be reachable and uncovered in all of them.
   */
  private fovFor(s: ShotSpec): number {
    return this.fovForFraming(s.position.distanceTo(s.target), s.width, s.height);
  }

  /** Field of view that fits `width` x `height` metres at `dist` metres. */
  fovForFraming(dist: number, width: number, height: number): number {
    const d = Math.max(0.2, dist);
    const aspect = Math.max(0.2, this.camera.aspect);
    const byWidth = 2 * Math.atan(width / 2 / d / aspect);
    const byHeight = 2 * Math.atan(height / 2 / d);
    const rad = Math.max(byWidth, byHeight);
    return Math.min(72, Math.max(26, (rad * 180) / Math.PI));
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
      wantFov = this.fovFor(s);
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
      this.fov = this.fovFor(s);
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
