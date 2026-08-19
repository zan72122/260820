// ---------------------------------------------------------------------------
// Camera choreography. The game never lets the player steer the camera - it
// moves between hand-authored poses: the wide "where shall I dig?" shot, the
// low working shot, the tight framing for the pull, and the crate shot.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { easeInOutCubic, easeOutCubic, clamp01, lerp } from './util.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(0, 2.4, 4.2);
    this.look = new THREE.Vector3(0, 0.2, 0);
    this.fov = camera.fov;

    this.fromPos = this.pos.clone();
    this.fromLook = this.look.clone();
    this.fromFov = this.fov;
    this.toPos = this.pos.clone();
    this.toLook = this.look.clone();
    this.toFov = this.fov;

    this.t = 1;
    this.dur = 1;
    this.ease = easeInOutCubic;

    this.driftT = Math.random() * 10;
    this.driftAmp = 0.02;
    this.shake = 0;
    this._v = new THREE.Vector3();
  }

  /** Snap instantly. */
  set(pos, look, fov) {
    this.pos.copy(pos); this.look.copy(look);
    if (fov) this.fov = fov;
    this.toPos.copy(pos); this.toLook.copy(look); this.toFov = this.fov;
    this.t = 1;
    this.apply();
  }

  /** Glide to a new pose. */
  goTo(pos, look, duration = 1.4, ease = easeInOutCubic, fov = null) {
    this.fromPos.copy(this.pos);
    this.fromLook.copy(this.look);
    this.fromFov = this.fov;
    this.toPos.copy(pos);
    this.toLook.copy(look);
    this.toFov = fov == null ? this.fov : fov;
    this.t = 0;
    this.dur = Math.max(0.0001, duration);
    this.ease = ease;
  }

  get moving() { return this.t < 1; }

  addShake(v) { this.shake = Math.min(1, this.shake + v); }

  update(dt) {
    if (this.t < 1) {
      this.t = clamp01(this.t + dt / this.dur);
      const e = this.ease(this.t);
      this.pos.lerpVectors(this.fromPos, this.toPos, e);
      this.look.lerpVectors(this.fromLook, this.toLook, e);
      this.fov = lerp(this.fromFov, this.toFov, e);
    }
    this.driftT += dt;
    this.shake = Math.max(0, this.shake - dt * 2.6);
    this.apply();
  }

  apply() {
    const c = this.camera;
    const d = this.driftT;
    // a breath of hand-held drift keeps the frame alive without any wobble
    const dx = Math.sin(d * 0.37) * this.driftAmp + Math.sin(d * 0.91) * this.driftAmp * 0.4;
    const dy = Math.sin(d * 0.53 + 1.3) * this.driftAmp * 0.6;
    const sh = this.shake * this.shake;
    c.position.set(
      this.pos.x + dx + (Math.random() - 0.5) * sh * 0.05,
      this.pos.y + dy + (Math.random() - 0.5) * sh * 0.05,
      this.pos.z + dx * 0.5
    );
    this._v.copy(this.look);
    this._v.y += dy * 0.25;
    c.lookAt(this._v);
    if (Math.abs(c.fov - this.fov) > 0.01) {
      c.fov = this.fov;
      c.updateProjectionMatrix();
    }
  }
}

/**
 * Framing helper. Rather than hard-coding camera distances (which frame very
 * differently on a tall phone and a wide tablet), each shot declares the tilt
 * it wants and how much of the world should span the screen's narrow axis.
 * The distance is then derived from the live field of view, so the same shot
 * reads the same on an iPhone in portrait and an iPad in landscape.
 */
export function framePose(focus, yaw, tiltDeg, coverHalfW, camera, minDist = 0.3) {
  const vHalf = (camera.fov * 0.5 * Math.PI) / 180;
  const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
  const d = Math.max(minDist, coverHalfW / Math.max(0.08, Math.tan(hHalf)));
  const tilt = (tiltDeg * Math.PI) / 180;
  const horiz = d * Math.cos(tilt);
  return {
    pos: new THREE.Vector3(
      focus.x + Math.sin(yaw) * horiz,
      focus.y + d * Math.sin(tilt),
      focus.z + Math.cos(yaw) * horiz
    ),
    look: focus.clone(),
    dist: d,
  };
}
