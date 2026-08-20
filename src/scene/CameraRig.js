/**
 * Camera framing.
 *
 * Never straight down. The whole game is a question about the third
 * dimension — is the paper above the fish or under it, has the fish left the
 * water or not — and a top-down view answers none of it. So the camera sits
 * between 30 and 40 degrees off the surface, close enough that the poi is a
 * real object and far enough that the fish always has somewhere to run.
 *
 * Rotating the phone re-composes the shot in 3D: the tub itself changes
 * shape, using depth in portrait and width in landscape, so the fish always
 * have room to escape along the screen's long axis.
 */

import * as THREE from 'three';
import { clamp, damp, lerp } from '../core/Rng.js';

const DEG = Math.PI / 180;

export const FRAMING = {
  portrait: {
    fov: 58,
    elevation: 36 * DEG,
    azimuth: 7 * DEG,
    distance: 1.72,
    target: new THREE.Vector3(0, -0.02, 0.02),
    bounds: { rx: 0.44, rz: 0.6 },
    bowl: new THREE.Vector3(0.4, -0.016, 0.6),
    poiRest: new THREE.Vector3(-0.06, 0.03, 0.63),
  },
  landscape: {
    fov: 41,
    elevation: 31 * DEG,
    azimuth: -6 * DEG,
    distance: 1.14,
    target: new THREE.Vector3(0, -0.02, 0.0),
    bounds: { rx: 0.7, rz: 0.42 },
    bowl: new THREE.Vector3(0.72, -0.016, 0.36),
    poiRest: new THREE.Vector3(-0.3, 0.03, 0.47),
  },
};

export class CameraRig {
  /** @param {THREE.PerspectiveCamera} camera */
  constructor(camera) {
    this.camera = camera;
    this.mode = 'portrait';
    this.cfg = { ...FRAMING.portrait };
    this.target = FRAMING.portrait.target.clone();
    this.lookAt = this.target.clone();
    this.fov = this.cfg.fov;
    this.elevation = this.cfg.elevation;
    this.azimuth = this.cfg.azimuth;
    this.distance = this.cfg.distance;
    this.bounds = { ...FRAMING.portrait.bounds };
    this.punch = 0;
    this._punchTimer = 0;
    this.time = 0;
    this.interest = new THREE.Vector3();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._ray = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this.transition = 1;
  }

  /**
   * @param {number} w,h CSS pixels
   * @returns {boolean} true when the composition changed
   */
  setViewport(w, h) {
    const mode = w >= h ? 'landscape' : 'portrait';
    this.camera.aspect = w / Math.max(h, 1);
    // A very tall phone needs a wider lens or the tub will not fit across.
    this._aspectPad = clamp(0.62 / Math.max(w / Math.max(h, 1), 0.001), 0.9, 1.3);
    if (mode !== this.mode) {
      this.mode = mode;
      this.transition = 0;
    }
    this.cfg = FRAMING[this.mode];
    this.camera.updateProjectionMatrix();
    return this.transition < 1;
  }

  /** Where the tub should be shaped right now. */
  get targetBounds() {
    return this.cfg.bounds;
  }

  get bowlPoint() {
    return this.cfg.bowl;
  }

  get poiRestPoint() {
    return this.cfg.poiRest;
  }

  /** A small, slow push-in. Never a cut — the lift has to stay unbroken. */
  punchIn(amount = 1, hold = 1.35) {
    this.punch = Math.max(this.punch, clamp(amount, 0, 1));
    this._punchTimer = hold;
  }

  /**
   * @param {number} dt
   * @param {THREE.Vector3} focus  the poi, or wherever the action is
   * @param {number} tension       0..1, how much the camera should lean in
   */
  update(dt, focus, tension = 0) {
    this.time += dt;
    this.transition = Math.min(1, this.transition + dt * 1.6);

    const cfg = this.cfg;
    const speed = lerp(2.2, 7.0, this.transition);

    // Follow the action, but only part of the way: the tub must stay readable.
    if (focus) this.interest.lerp(focus, 1 - Math.exp(-3.2 * dt));
    const tx = lerp(cfg.target.x, this.interest.x, 0.22);
    const tz = lerp(cfg.target.z, this.interest.z, 0.16);
    this.target.x = damp(this.target.x, tx, speed, dt);
    this.target.y = damp(this.target.y, cfg.target.y + this.interest.y * 0.2, speed, dt);
    this.target.z = damp(this.target.z, tz, speed, dt);

    this._punchTimer -= dt;
    if (this._punchTimer <= 0) this.punch = damp(this.punch, 0, 2.0, dt);

    const lean = clamp(tension, 0, 1);
    const wantFov = cfg.fov * this._aspectPad - this.punch * 3.4 - lean * 1.2;
    const wantDist = cfg.distance * (1 - this.punch * 0.085 - lean * 0.02);
    const wantElev = cfg.elevation + this.punch * 1.6 * DEG - lean * 1.2 * DEG;

    this.fov = damp(this.fov, wantFov, speed, dt);
    this.distance = damp(this.distance, wantDist, speed, dt);
    this.elevation = damp(this.elevation, wantElev, speed, dt);
    this.azimuth = damp(this.azimuth, cfg.azimuth, speed, dt);

    // A trace of handheld, so the frame is never mechanically still.
    const bx = Math.sin(this.time * 0.37) * 0.006 + Math.sin(this.time * 0.91) * 0.002;
    const by = Math.cos(this.time * 0.29) * 0.005;

    const ce = Math.cos(this.elevation);
    const se = Math.sin(this.elevation);
    const ca = Math.cos(this.azimuth);
    const sa = Math.sin(this.azimuth);
    this.camera.position.set(
      this.target.x + sa * ce * this.distance + bx,
      this.target.y + se * this.distance + by,
      this.target.z + ca * ce * this.distance
    );
    this.lookAt.copy(this.target);
    this.lookAt.y += 0.012;
    this.camera.lookAt(this.lookAt);
    if (Math.abs(this.camera.fov - this.fov) > 1e-3) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Screen point -> a point on the water plane.
   * The finger addresses a spot a little *below* where the poi will sit, so
   * the child's own hand never covers the tool or the fish.
   *
   * @param {number} ndcX,ndcY
   * @param {number} planeY
   * @param {number} liftPixels  screen-space offset, in NDC units
   */
  screenToWater(ndcX, ndcY, planeY, liftNdc, out = new THREE.Vector3()) {
    this._ndc.set(ndcX, clamp(ndcY + liftNdc, -1.6, 1.6));
    this._ray.setFromCamera(this._ndc, this.camera);
    this._plane.constant = -planeY;
    const hit = this._ray.ray.intersectPlane(this._plane, out);
    if (!hit) {
      // Looking at or above the horizon: fall back to a long throw forward.
      out.copy(this._ray.ray.origin).addScaledVector(this._ray.ray.direction, 3);
      out.y = planeY;
    }
    return out;
  }
}
