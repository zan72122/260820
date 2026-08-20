/**
 * Nobody hands a four year old an orbit camera. Every shot in the game is composed here.
 *
 * Portrait and landscape are not crops of one another: portrait pushes the nebuta up the
 * frame and leans into its height, landscape opens out sideways for the parade route and
 * the hayashi players. The shot is always framed so the working surface sits above the
 * finger, never under it.
 */

import { PerspectiveCamera, Vector3 } from 'three';
import type { LayoutKind, Viewport } from './Viewport';
import { clamp, damp } from '../util/math';

const _dir = new Vector3();

export interface ShotRequest {
  /** Point the camera looks at. */
  look: Vector3;
  /** Radius of the sphere the shot should contain, used when `points` is absent. */
  radius: number;
  /**
   * Exact world points the frame must hold. Fitting a sphere to a long, flat nebuta pushes
   * the lens absurdly far back on a phone, so shots that matter pass their real corners.
   */
  points?: Vector3[];
  /**
   * Points that must stay fully on screen even when `points` is allowed to bleed off the
   * sides — the light switch, for instance, which a child has to be able to see and touch.
   */
  anchorPoints?: Vector3[];
  /** Horizontal orbit angle, radians, 0 = looking from +X. */
  yaw: number;
  /** Elevation, radians. */
  pitch: number;
  /** Explicit offset direction from the subject to the lens; overrides yaw/pitch. */
  dir?: Vector3;
  /** Extra fraction of the frame to leave around the subject. */
  padding?: number;
  /** Positive pushes the subject up the frame, leaving room for the hand below. */
  headroom?: number;
  /**
   * <1 lets the subject run off the sides. Portrait shots of a long nebuta use this instead
   * of retreating halfway across the playground to fit the tail.
   */
  horizontalFit?: number;
  fov?: number;
  lambda?: number;
  rollNoise?: number;
}

const LAYOUT_TUNING: Record<LayoutKind, { fov: number; padding: number; headroom: number }> = {
  // narrow frame: taller lens, subject high, plenty of room under the thumb
  'phone-portrait': { fov: 56, padding: 1.08, headroom: 0.26 },
  'phone-landscape': { fov: 54, padding: 1.04, headroom: 0.1 },
  'tablet-portrait': { fov: 50, padding: 1.06, headroom: 0.22 },
  'tablet-landscape': { fov: 50, padding: 1.02, headroom: 0.08 },
};

const _right = new Vector3();
const _upv = new Vector3();
const _rel = new Vector3();
const WORLD_UP = new Vector3(0, 1, 0);

export class CameraDirector {
  readonly camera: PerspectiveCamera;
  private readonly pos = new Vector3(3, 1.6, 3);
  private readonly look = new Vector3(0, 0.9, 0);
  private readonly wantPos = new Vector3(3, 1.6, 3);
  private readonly wantLook = new Vector3(0, 0.9, 0);
  private wantFov = 46;
  private lambda = 3.2;
  private shakeAmount = 0;
  private noise = 0;
  private time = 0;

  constructor(private readonly viewport: Viewport) {
    this.camera = new PerspectiveCamera(46, viewport.aspect, 0.05, 90);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }

  get tuning() {
    return LAYOUT_TUNING[this.viewport.layout];
  }

  /**
   * `radius` is read as the half-height to hold, so the same shot reads at the same scale in
   * portrait and landscape instead of collapsing when the frame gets narrow.
   */
  private distanceFor(radius: number, fovDeg: number, padding: number): number {
    const tanV = Math.tan((fovDeg * Math.PI) / 360);
    return (radius * padding) / Math.max(0.05, tanV);
  }

  /**
   * Exact fit: solve, per corner and per axis, the smallest distance at which the point
   * still projects inside the frame. Cheap, and it stops a 2.5 m long nebuta from being
   * pushed halfway across the playground just to satisfy a bounding sphere.
   */
  private distanceForPoints(
    points: Vector3[],
    look: Vector3,
    dir: Vector3,
    fovDeg: number,
    padding: number,
    horizontalFit: number,
  ): { dist: number; halfHeight: number } {
    const aspect = Math.max(0.2, this.viewport.aspect);
    const tanV = Math.tan((fovDeg * Math.PI) / 360);
    const tanH = (tanV * aspect) / Math.max(0.2, horizontalFit);
    _right.crossVectors(WORLD_UP, dir);
    if (_right.lengthSq() < 1e-6) _right.set(1, 0, 0);
    _right.normalize();
    _upv.crossVectors(dir, _right).normalize();

    let dist = 0.2;
    let halfHeight = 0.1;
    for (const p of points) {
      _rel.subVectors(p, look);
      const depthOffset = _rel.dot(dir);
      const h = Math.abs(_rel.dot(_right)) * padding;
      const v = Math.abs(_rel.dot(_upv)) * padding;
      halfHeight = Math.max(halfHeight, Math.abs(_rel.dot(_upv)));
      dist = Math.max(dist, depthOffset + h / tanH, depthOffset + v / tanV);
    }
    return { dist, halfHeight };
  }

  request(r: ShotRequest): void {
    const tune = this.tuning;
    const fov = r.fov ?? tune.fov;
    const padding = (r.padding ?? 1) * tune.padding;
    const headroom = (r.headroom ?? 1) * tune.headroom;
    if (r.dir) {
      _dir.copy(r.dir).normalize();
    } else {
      const cp = Math.cos(r.pitch);
      _dir.set(Math.cos(r.yaw) * cp, Math.sin(r.pitch), Math.sin(r.yaw) * cp);
    }

    let dist: number;
    let vertical: number;
    if (r.points && r.points.length) {
      const fit = this.distanceForPoints(r.points, r.look, _dir, fov, padding, r.horizontalFit ?? 1);
      dist = fit.dist;
      vertical = fit.halfHeight;
      if (r.anchorPoints && r.anchorPoints.length) {
        const anchor = this.distanceForPoints(r.anchorPoints, r.look, _dir, fov, padding, 1);
        dist = Math.max(dist, anchor.dist);
      }
    } else {
      dist = this.distanceFor(r.radius, fov, padding);
      vertical = r.radius;
    }

    this.wantPos.copy(r.look).addScaledVector(_dir, dist);
    // aiming a little below the subject lifts it up the frame, leaving the hand room below
    this.wantLook.copy(r.look);
    this.wantLook.y -= vertical * headroom;
    this.wantFov = fov;
    this.lambda = r.lambda ?? 3.2;
    this.noise = r.rollNoise ?? 0.25;
  }

  /** Cuts straight to the requested shot. Used only between chapters, never mid-moment. */
  snap(): void {
    this.pos.copy(this.wantPos);
    this.look.copy(this.wantLook);
    this.camera.fov = this.wantFov;
    this.camera.updateProjectionMatrix();
  }

  shake(v: number): void {
    this.shakeAmount = Math.min(1, this.shakeAmount + v);
  }

  update(dt: number): void {
    this.time += dt;
    this.pos.x = damp(this.pos.x, this.wantPos.x, this.lambda, dt);
    this.pos.y = damp(this.pos.y, this.wantPos.y, this.lambda, dt);
    this.pos.z = damp(this.pos.z, this.wantPos.z, this.lambda, dt);
    this.look.x = damp(this.look.x, this.wantLook.x, this.lambda * 1.1, dt);
    this.look.y = damp(this.look.y, this.wantLook.y, this.lambda * 1.1, dt);
    this.look.z = damp(this.look.z, this.wantLook.z, this.lambda * 1.1, dt);

    this.shakeAmount = Math.max(0, this.shakeAmount - dt * 1.8);
    const s = this.shakeAmount * this.shakeAmount * 0.035;
    // a hint of handheld drift so the frame never feels locked on rails
    const drift = this.noise * 0.012;
    this.camera.position.set(
      this.pos.x + Math.sin(this.time * 0.63) * drift + Math.sin(this.time * 21) * s,
      this.pos.y + Math.sin(this.time * 0.81 + 1.7) * drift + Math.cos(this.time * 25) * s,
      this.pos.z + Math.sin(this.time * 0.53 + 3.1) * drift,
    );
    this.camera.lookAt(this.look);
    this.camera.fov = damp(this.camera.fov, this.wantFov, this.lambda, dt);
    this.camera.aspect = this.viewport.aspect;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Screen-space offset, in CSS pixels, that keeps the brush tip clear of the fingertip.
   * The child touches here; the paint lands a little above.
   */
  fingerOffset(): { x: number; y: number } {
    const portrait = this.viewport.portrait;
    const short = Math.min(this.viewport.width, this.viewport.height);
    const base = clamp(short * 0.075, 34, 62);
    return portrait ? { x: 0, y: -base } : { x: -base * 0.24, y: -base * 0.8 };
  }
}
