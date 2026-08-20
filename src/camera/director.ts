import * as THREE from 'three';
import { clamp, clamp01, damp, lerp } from '../util/math';

/**
 * Camera direction.
 *
 * One camera, never cut. The whole causal chain — the ball hanging in the
 * clamp, the fall, the surface giving way, the rebound to its highest point —
 * has to be legible inside a single continuous frame, otherwise the child is
 * being shown a film instead of a consequence.
 *
 * The frame is computed by fitting a world-space box that contains the release
 * point and the impact point. Because no material can return more energy than
 * it received, the top of the first bounce is always below the release point,
 * so a frame that holds the fall automatically holds the apex: we never have
 * to zoom out mid-bounce and give the answer away.
 */

export type CameraMode = 'tray' | 'chain';

export interface FramingRequest {
  mode: CameraMode;
  /** Where the ball is released from. */
  release: THREE.Vector3;
  /** Where it is going to land. */
  impact: THREE.Vector3;
  /** Extra points that must stay on screen (chain pads, the release ring). */
  extra: THREE.Vector3[];
  portrait: boolean;
}

interface Pose {
  azimuth: number;
  elevation: number;
  margin: number;
  /** Empty world space added below the action, so it sits high on screen and
   *  the child's hand has somewhere to be. */
  padBottom: number;
  padTop: number;
}

const POSES: Record<string, Pose> = {
  // Biased towards a side view: the drop is a vertical event and reads best
  // when the fall line is close to parallel with the screen.
  'tray.landscape': { azimuth: 0.95, elevation: 0.19, margin: 1.03, padBottom: 0.12, padTop: 0.1 },
  'tray.portrait': { azimuth: 1.05, elevation: 0.15, margin: 1.02, padBottom: 0.2, padTop: 0.1 },
  // Higher three-quarter so all three pads and the route between them read.
  'chain.landscape': { azimuth: 0.32, elevation: 0.34, margin: 1.04, padBottom: 0.1, padTop: 0.12 },
  'chain.portrait': { azimuth: 0.85, elevation: 0.5, margin: 1.06, padBottom: 0.16, padTop: 0.18 },
};

const _box = new THREE.Box3();
const _v = new THREE.Vector3();
const _corner = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _center = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

export class CameraDirector {
  readonly camera: THREE.PerspectiveCamera;
  private position = new THREE.Vector3(3.4, 1.8, 3.2);
  private target = new THREE.Vector3(0, 1, 0);
  private desiredPosition = new THREE.Vector3(3.4, 1.8, 3.2);
  private desiredTarget = new THREE.Vector3(0, 1, 0);
  private azimuth = 0.94;
  private elevation = 0.23;
  private distance = 5;

  /** 0..1 gentle push-in used around the moment of contact. */
  private closeIn = 0;
  private closeInTarget = 0;
  private shake = 0;
  private shakeSeed = 0;
  private aspect = 1;
  private safeTop = 0;
  private safeBottom = 0;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 140);
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.target);
  }

  setViewport(width: number, height: number, safeTop = 0, safeBottom = 0) {
    this.aspect = width / Math.max(height, 1);
    this.safeTop = safeTop / Math.max(height, 1);
    this.safeBottom = safeBottom / Math.max(height, 1);
    this.camera.aspect = this.aspect;
    // A slightly longer lens in landscape keeps the pavilion from bowing.
    this.camera.fov = this.aspect >= 1 ? 36 : 44;
    this.camera.updateProjectionMatrix();
  }

  /** Nudge the frame in a touch as the ball meets the surface. */
  emphasiseContact(strength: number) {
    this.closeInTarget = clamp01(strength);
  }

  releaseContact() {
    this.closeInTarget = 0;
  }

  /** A very small kick, scaled by impact energy. Never a screen-shake gimmick. */
  impulse(energy: number) {
    this.shake = Math.min(1, this.shake + energy * 0.5);
    this.shakeSeed += 1.7;
  }

  frame(req: FramingRequest, immediate = false) {
    const key = `${req.mode}.${req.portrait ? 'portrait' : 'landscape'}`;
    const pose = POSES[key];
    this.azimuth = damp(this.azimuth, pose.azimuth, 100, 1);
    this.elevation = pose.elevation;
    this.azimuth = pose.azimuth;

    _box.makeEmpty();
    _box.expandByPoint(req.release);
    _box.expandByPoint(req.impact);
    for (const p of req.extra) _box.expandByPoint(p);
    _box.min.y -= pose.padBottom;
    _box.max.y += pose.padTop;
    _box.expandByScalar(0.07);
    _box.getCenter(_center);

    // Camera basis for the requested pose.
    _dir.set(
      Math.sin(this.azimuth) * Math.cos(this.elevation),
      Math.sin(this.elevation),
      Math.cos(this.azimuth) * Math.cos(this.elevation)
    );
    _right.crossVectors(_dir, WORLD_UP).normalize();
    _up.crossVectors(_right, _dir).normalize();

    // Project the box corners onto the camera plane to get the real extents.
    let halfW = 0;
    let halfH = 0;
    let halfD = 0;
    for (let i = 0; i < 8; i++) {
      _corner.set(
        i & 1 ? _box.max.x : _box.min.x,
        i & 2 ? _box.max.y : _box.min.y,
        i & 4 ? _box.max.z : _box.min.z
      );
      _corner.sub(_center);
      halfW = Math.max(halfW, Math.abs(_corner.dot(_right)));
      halfH = Math.max(halfH, Math.abs(_corner.dot(_up)));
      halfD = Math.max(halfD, Math.abs(_corner.dot(_dir)));
    }

    // Notches and home indicators eat into the usable height.
    const usable = Math.max(0.55, 1 - this.safeTop - this.safeBottom);
    const vFov = (this.camera.fov * Math.PI) / 180;
    const tanV = Math.tan(vFov / 2) * usable;
    const tanH = tanV * this.aspect;
    const margin = pose.margin * (1 - this.closeIn * 0.09);
    // Fit against the box's near face, plus a small clearance. Anything more
    // generous here shows up directly as a smaller ball on screen.
    const dist = Math.max(halfH / tanV, halfW / tanH) * margin + halfD * 0.62 + 0.12;
    this.distance = clamp(dist, 1.6, 16);

    this.desiredTarget.copy(_center);
    // Re-centre vertically for the safe areas so the action is not under a
    // notch or behind the home bar.
    const shift = (this.safeTop - this.safeBottom) * 0.5 * (2 * tanV * this.distance);
    this.desiredTarget.y -= shift;
    this.desiredPosition.copy(_center).addScaledVector(_dir, this.distance);
    this.desiredPosition.y -= shift;

    if (immediate) {
      this.position.copy(this.desiredPosition);
      this.target.copy(this.desiredTarget);
      this.apply();
    }
  }

  update(dt: number) {
    this.closeIn = damp(this.closeIn, this.closeInTarget, this.closeInTarget > this.closeIn ? 9 : 3.2, dt);
    this.shake = Math.max(0, this.shake - dt * 3.4);

    // Slow, heavy moves: the camera should feel like a tripod being nudged,
    // never like it is chasing the ball.
    const rate = 2.6;
    this.position.x = damp(this.position.x, this.desiredPosition.x, rate, dt);
    this.position.y = damp(this.position.y, this.desiredPosition.y, rate, dt);
    this.position.z = damp(this.position.z, this.desiredPosition.z, rate, dt);
    this.target.x = damp(this.target.x, this.desiredTarget.x, rate * 1.15, dt);
    this.target.y = damp(this.target.y, this.desiredTarget.y, rate * 1.15, dt);
    this.target.z = damp(this.target.z, this.desiredTarget.z, rate * 1.15, dt);
    this.apply();
  }

  private apply() {
    const s = this.shake * this.shake * 0.012;
    const j = this.shakeSeed;
    _v.set(
      Math.sin(j * 12.9) * s,
      Math.sin(j * 7.3 + 1.1) * s * 1.4,
      Math.sin(j * 5.1 + 2.3) * s
    );
    this.camera.position.copy(this.position).add(_v);
    this.camera.lookAt(this.target);
  }

  /** Screen-space X of a world point, in -1..1. Used to pan impact audio. */
  panOf(point: THREE.Vector3) {
    _v.copy(point).project(this.camera);
    return clamp(_v.x, -1, 1);
  }

  get lookTarget() {
    return this.target;
  }

  get eye() {
    return this.position;
  }

  get pushIn() {
    return this.closeIn;
  }

  /** Blend factor used by the app to know when a reframe has finished. */
  settled() {
    return this.position.distanceToSquared(this.desiredPosition) < 0.0004;
  }

  static lerpPose(a: number, b: number, t: number) {
    return lerp(a, b, t);
  }
}
