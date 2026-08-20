import * as THREE from 'three';
import { clamp01, easeInOutCubic, lerp } from '../core/math';
import type { Stage } from '../core/stage';

/**
 * There is no free camera. Eight fixed shots carry the whole sequence, and the
 * director only decides which one is live and how to get there.
 *
 * Two rules are enforced here rather than left to the shot definitions:
 *
 *  1. Every shot solves its own distance from the current aspect ratio, using
 *     whichever of the two screen axes is tighter. That is what keeps the
 *     whole root cluster inside frame in portrait and in landscape, and what
 *     makes a mid-gesture device rotation safe.
 *  2. Every shot pushes its subject above the screen centre by `bias`. The
 *     player's finger is at the bottom of the screen on the tool handle, so
 *     the jaws, the first crack and the emerging roots sit clear of it.
 */

export type ShotName =
  | 'establish'
  | 'clampWork'
  | 'leverSide'
  | 'crackGrazing'
  | 'section'
  | 'rockFollow'
  | 'rise'
  | 'reveal'
  | 'nextRow';

export interface Shot {
  /** Azimuth around the subject, radians. 0 looks from +Z toward -Z. */
  azimuth: number;
  /** Elevation above the horizon, radians. */
  elevation: number;
  /** Horizontal extent the shot must contain, metres. */
  width: number;
  /** Vertical extent the shot must contain, metres. */
  height: number;
  /** Extra framing margin. */
  margin: number;
  /** 0..0.45 — how far above screen centre the subject sits. */
  bias: number;
  /** Field of view in degrees, in landscape. Portrait widens it. */
  fov: number;
}

/** Per-shot override of the framed extents, in metres. */
export interface Extent {
  width: number;
  height: number;
}

export const SHOTS: Record<ShotName, Shot> = {
  // 1. one stem and one tool, low three-quarter
  establish: { azimuth: -0.66, elevation: 0.10, width: 1.16, height: 0.74, margin: 1.06, bias: 0.05, fov: 40 },
  // 2. the hands: attaching the clamp
  clampWork: { azimuth: -0.46, elevation: 0.28, width: 0.28, height: 0.24, margin: 1.14, bias: 0.20, fov: 38 },
  // 3. side on, so lever, fulcrum and stem are all visible at once
  leverSide: { azimuth: -1.28, elevation: 0.15, width: 1.24, height: 0.68, margin: 1.08, bias: 0.14, fov: 42 },
  // 4. grazing the ground for the first crack and the root shoulder
  crackGrazing: { azimuth: -0.28, elevation: 0.30, width: 0.38, height: 0.26, margin: 1.06, bias: 0.16, fov: 38 },
  // the single, very short section that explains the lever's hold
  // Deliberately tight: enough to show the lever holding a plant that carries
  // on below the soil line, and not enough to give away the whole cluster.
  section: { azimuth: -1.55, elevation: 0.06, width: 0.60, height: 0.40, margin: 1.06, bias: 0.06, fov: 40 },
  // 5. mid shot that follows the rocking
  rockFollow: { azimuth: -1.12, elevation: 0.21, width: 0.56, height: 0.44, margin: 1.10, bias: 0.18, fov: 40 },
  // 6. slow pull back as the cluster comes up (extents come from the cluster)
  rise: { azimuth: -0.92, elevation: 0.22, width: 0.80, height: 0.70, margin: 1.02, bias: 0.12, fov: 42 },
  // 7. the cluster and the hole it came out of, together
  reveal: { azimuth: -1.02, elevation: 0.46, width: 1.00, height: 0.90, margin: 1.02, bias: 0.02, fov: 44 },
  // 8. wider, showing what comes next
  nextRow: { azimuth: -0.82, elevation: 0.30, width: 2.70, height: 1.30, margin: 1.06, bias: 0.02, fov: 48 },
};

interface Pose {
  position: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
}

export class CameraDirector {
  private current: Pose = {
    position: new THREE.Vector3(0, 1, 2),
    look: new THREE.Vector3(),
    fov: 40,
  };
  private from: Pose = {
    position: new THREE.Vector3(),
    look: new THREE.Vector3(),
    fov: 40,
  };
  private target: Pose = {
    position: new THREE.Vector3(),
    look: new THREE.Vector3(),
    fov: 40,
  };
  private transition = 1;
  private duration = 1;
  private shot: ShotName = 'establish';
  private subject = new THREE.Vector3();
  private extent: Extent | null = null;
  private azimuthOverride: number | null = null;
  private shake = 0;
  private shakeDecay = 0;
  private tmp = new THREE.Vector3();

  /** Reduced-motion mode: dolly distance and shake are cut, cuts still happen. */
  reducedMotion = false;

  constructor(private stage: Stage) {}

  get activeShot(): ShotName {
    return this.shot;
  }

  get settled(): boolean {
    return this.transition >= 1;
  }

  /**
   * Point the named shot at a subject. `extent` overrides the shot's framed
   * size, which is how the lift shots grow with the cluster instead of
   * cropping it.
   */
  aim(
    shot: ShotName,
    subject: THREE.Vector3,
    extent: Extent | null = null,
    azimuth: number | null = null,
  ): void {
    this.shot = shot;
    this.subject.copy(subject);
    this.extent = extent;
    this.azimuthOverride = azimuth;
  }

  /** Jump straight to the current shot — used only between stages. */
  cut(): void {
    this.solve(this.target);
    this.current.position.copy(this.target.position);
    this.current.look.copy(this.target.look);
    this.current.fov = this.target.fov;
    this.transition = 1;
  }

  /** Ease from wherever the camera is to the current shot. */
  move(duration = 1.1): void {
    this.from.position.copy(this.current.position);
    this.from.look.copy(this.current.look);
    this.from.fov = this.current.fov;
    this.transition = 0;
    this.duration = Math.max(0.05, this.reducedMotion ? duration * 0.55 : duration);
  }

  /** A short knock on the camera; suppressed under reduced motion. */
  impulse(amount: number): void {
    if (this.reducedMotion) return;
    this.shake = Math.min(0.02, this.shake + amount);
    this.shakeDecay = 3.4;
  }

  /**
   * A phone held upright has a very narrow horizontal field. Rather than
   * retreating until a wide subject fits — which turns every close shot into a
   * landscape — portrait takes a wider lens and stays near the work.
   */
  private fovFor(shot: ShotName): number {
    const def = SHOTS[shot];
    return this.stage.isPortrait
      ? Math.min(56, def.fov * (1 + (1 / Math.max(this.stage.aspect, 0.35)) * 0.36))
      : def.fov;
  }

  /** Distance this shot would sit at to hold the given extent. */
  distanceFor(shot: ShotName, extent: Extent): number {
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.fovFor(shot)) / 2);
    const tanH = tanV * this.stage.aspect;
    return (
      Math.max(extent.width / 2 / tanH, extent.height / 2 / tanV) * SHOTS[shot].margin
    );
  }

  private solve(out: Pose): void {
    const shot = SHOTS[this.shot];

    const aspect = this.stage.aspect;
    const fov = this.fovFor(this.shot);
    out.fov = fov;

    const vFov = THREE.MathUtils.degToRad(fov);
    const tanV = Math.tan(vFov / 2);
    const tanH = tanV * aspect;

    let width = this.extent ? this.extent.width : shot.width;
    let height = this.extent ? this.extent.height : shot.height;
    if (this.reducedMotion && this.extent) {
      width = lerp(shot.width, width, 0.5);
      height = lerp(shot.height, height, 0.5);
    }

    // Solve each screen axis on its own, and take whichever is the binding
    // constraint. This is what keeps a wide fan of roots and a tall cluster
    // both fully in frame, in portrait and in landscape alike.
    const distance = Math.max(width / 2 / tanH, height / 2 / tanV) * shot.margin;

    const elevation = shot.elevation + (this.stage.isPortrait ? 0.03 : 0);
    const azimuth = this.azimuthOverride ?? shot.azimuth;
    const cosE = Math.cos(elevation);
    out.position.set(
      this.subject.x + Math.sin(azimuth) * distance * cosE,
      this.subject.y + Math.sin(elevation) * distance,
      this.subject.z + Math.cos(azimuth) * distance * cosE,
    );
    // Very low shots must not put the eye underground.
    out.position.y = Math.max(out.position.y, 0.05);

    // Looking below the subject lifts it above the screen centre, clearing the
    // area where a finger will be.
    out.look.copy(this.subject);
    out.look.y -= shot.bias * tanV * distance;
  }

  update(dt: number): void {
    this.solve(this.target);

    if (this.transition < 1) {
      this.transition = clamp01(this.transition + dt / this.duration);
      const t = easeInOutCubic(this.transition);
      this.current.position.lerpVectors(this.from.position, this.target.position, t);
      this.current.look.lerpVectors(this.from.look, this.target.look, t);
      this.current.fov = lerp(this.from.fov, this.target.fov, t);
    } else {
      // Follow live subject movement without ever snapping.
      const follow = Math.min(1, dt * 5.5);
      this.current.position.lerp(this.target.position, follow);
      this.current.look.lerp(this.target.look, follow);
      this.current.fov = lerp(this.current.fov, this.target.fov, follow);
    }

    if (this.shake > 0.00005) {
      this.shake *= Math.exp(-this.shakeDecay * dt);
    } else {
      this.shake = 0;
    }

    const cam = this.stage.camera;
    cam.fov = this.current.fov;
    cam.updateProjectionMatrix();
    cam.position.copy(this.current.position);
    if (this.shake > 0) {
      this.tmp.set(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake,
      );
      cam.position.add(this.tmp);
    }
    cam.lookAt(this.current.look);
  }
}
