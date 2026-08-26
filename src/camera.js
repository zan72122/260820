import * as THREE from '../vendor/three.module.js';
import { clamp, damp } from './util/math.js';

const _v = new THREE.Vector3();
const _d = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/**
 * The camera is a storyteller, not a tripod.
 *
 * Shots are authored per beat (game.js decides where to stand); this class
 * smooths between them and enforces the one hard rule: the caster's hand and
 * the net must both stay on screen, so the rope between them is never cut.
 */
export class Director {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(0.05, 1.72, 2.55);
    this.look = new THREE.Vector3(0.05, 0.22, -2.2);
    this.fov = 64;
    this.aspect = 0.5;
    this.portrait = true;
    this.gaze = null;
    this.shake = 0;
    this.framingError = 0;
    this.pushOut = 0;
  }

  setViewport(aspect) {
    this.aspect = aspect;
    this.portrait = aspect < 1.0;
  }

  /** Half-angle of the tightest screen axis: what actually decides the framing. */
  minHalfAngle(fovDeg = this.camera.fov) {
    const v = THREE.MathUtils.degToRad(fovDeg) * 0.5;
    const h = Math.atan(Math.tan(v) * this.aspect);
    return Math.min(v, h);
  }

  nudgeGaze(point) { this.gaze = { point: point.clone(), t: 0 }; }
  kick(amount) { this.shake = Math.min(1.4, this.shake + amount); }

  apply(shot, dt) {
    const rate = shot.rate ?? 3.0;
    this.pos.x = damp(this.pos.x, shot.pos.x, rate, dt);
    this.pos.y = damp(this.pos.y, shot.pos.y, rate, dt);
    this.pos.z = damp(this.pos.z, shot.pos.z, rate, dt);
    const lrate = rate * (shot.lookRate ?? 1.15);
    this.look.x = damp(this.look.x, shot.look.x, lrate, dt);
    this.look.y = damp(this.look.y, shot.look.y, lrate, dt);
    this.look.z = damp(this.look.z, shot.look.z, lrate, dt);

    if (this.gaze) {
      this.gaze.t += dt;
      const w = Math.sin(clamp(this.gaze.t / 1.7, 0, 1) * Math.PI) * 0.26;
      this.look.lerp(this.gaze.point, w);
      if (this.gaze.t > 1.7) this.gaze = null;
    }

    this.camera.fov = damp(this.camera.fov, shot.fov, 3.0, dt);
    this.camera.position.copy(this.pos);
    this.camera.up.copy(_up);
    this.camera.lookAt(this.look);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();

    if (shot.mustSee && shot.mustSee.length) this._keepInFrame(shot.mustSee, dt);

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.6);
      const s = this.shake * this.shake * 0.05;
      const t = performance.now();
      this.camera.position.x += Math.sin(t * 0.041) * s;
      this.camera.position.y += Math.sin(t * 0.057) * s;
      this.camera.lookAt(this.look);
      this.camera.updateMatrixWorld();
    }
  }

  /**
   * Guaranteed continuity of cause and effect: neither end of the rope may
   * leave the frame.
   *
   * Backing the camera straight along its own view ray does not change its
   * orientation, so the required distance is solvable in closed form — no
   * search, no feedback loop that can ratchet itself out to sea.
   */
  _keepInFrame(points, dt) {
    // 0.86, not 0.90: a notch or a rounded corner eats a few percent of the
    // short edge on a phone, and the rope must survive that too.
    const S = 0.86;
    const A = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) * 0.5);
    const inv = this.camera.matrixWorldInverse;
    let need = 0;
    let worst = 0;
    for (const p of points) {
      _v.copy(p).applyMatrix4(inv);          // camera space, looking down -Z
      const depth = -_v.z;
      const reqY = Math.abs(_v.y) / (S * A);
      const reqX = Math.abs(_v.x) / (S * A * this.aspect);
      const req = Math.max(reqY, reqX, 0.35);
      need = Math.max(need, req - depth);
      if (depth > 0.01) {
        worst = Math.max(worst, Math.abs(_v.y) / (depth * A), Math.abs(_v.x) / (depth * A * this.aspect));
      } else worst = Math.max(worst, 2);
    }
    this.framingError = worst;

    // Headroom, so the damped value stays a little ahead of what is needed.
    const target = clamp(need + 0.28, 0, 16);
    // Give room at once — a cut rope is worse than a quick step back — but take
    // it back slowly, so the frame breathes closed instead of snapping.
    this.pushOut = target > this.pushOut
      ? Math.max(target, damp(this.pushOut, target, 18.0, dt))
      : damp(this.pushOut, target, 1.2, dt);

    if (this.pushOut > 0.002) {
      _d.subVectors(this.pos, this.look).normalize();
      this.camera.position.copy(this.pos).addScaledVector(_d, this.pushOut);
      this.camera.lookAt(this.look);
      this.camera.updateMatrixWorld();

      // Report what was actually rendered, not what would have been.
      const inv2 = this.camera.matrixWorldInverse;
      let after = 0;
      for (const p of points) {
        _v.copy(p).applyMatrix4(inv2);
        const depth = -_v.z;
        if (depth > 0.01) {
          after = Math.max(after, Math.abs(_v.y) / (depth * A), Math.abs(_v.x) / (depth * A * this.aspect));
        } else after = Math.max(after, 2);
      }
      this.framingError = after;
    }
  }
}

/** Distance at which a sphere of `radius` exactly fills the tightest screen axis. */
export function fitDistance(radius, halfAngle, margin = 1.2) {
  return (radius * margin) / Math.max(0.05, Math.sin(halfAngle));
}
