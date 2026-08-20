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
  /**
   * Portrait uses the screen's long axis for depth: a tub that is deeper than
   * it is wide, with the stall and its lanterns stacked above it.
   */
  portrait: {
    /** metres of tub that must fit across the screen; the lens follows from it */
    frameWidth: 1.02,
    elevation: 34 * DEG,
    azimuth: 6 * DEG,
    distance: 2.15,
    target: new THREE.Vector3(0, -0.02, 0.06),
    /** tilts the shot up so the lanterns sit in the top of the frame */
    lookOffsetY: 0.2,
    bounds: { rx: 0.34, rz: 0.74 },
    bowl: new THREE.Vector3(0.4, -0.016, -0.24),
    poiRest: new THREE.Vector3(-0.08, 0.03, 0.76),
  },
  /** Landscape spends the long axis on width, so the fish gain room sideways. */
  landscape: {
    // The tub only takes half the width here. That is deliberate: a 2:1
    // screen fitted tightly across gives a vertical field of view so narrow
    // that the stall disappears, and the shot stops being a place.
    frameWidth: 2.05,
    elevation: 31 * DEG,
    azimuth: -5 * DEG,
    distance: 1.25,
    target: new THREE.Vector3(0, -0.02, -0.02),
    lookOffsetY: 0.19,
    bounds: { rx: 0.52, rz: 0.34 },
    bowl: new THREE.Vector3(0.64, -0.016, 0.1),
    poiRest: new THREE.Vector3(-0.26, 0.03, 0.36),
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
    this.fov = 50;
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
    // The lens is chosen so a fixed width of tub always fits across the screen,
    // whatever shape the phone is. Framing stays composed; it never crops.
    const aspect = Math.max(this.camera.aspect, 0.001);
    const baseFov =
      (2 * Math.atan(cfg.frameWidth * 0.5 / (aspect * cfg.distance))) / DEG;
    const wantFov = clamp(baseFov, 26, 68) - this.punch * 4.2 - lean * 1.0;
    const wantDist = cfg.distance * (1 - this.punch * 0.1 - lean * 0.02);
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
    this.lookAt.y += cfg.lookOffsetY;
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
