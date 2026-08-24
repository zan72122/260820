import * as THREE from 'three';
import { clamp, damp } from '../util/math';
import { LAYOUT } from '../scene/layout';

export type ShotName =
  | 'establish'
  | 'mid'
  | 'closeControls'
  | 'threeQuarter'
  | 'listen'
  | 'reveal'
  | 'compare';

interface Angles {
  /** Azimuth in degrees; 0 looks straight down -Z from the front. */
  azimuth: number;
  /** Elevation in degrees above the horizon. */
  elevation: number;
  fov: number;
  /** Fraction of the frame kept clear around the framed points. */
  margin: number;
}

interface Shot {
  /** Everything that must stay on screen for this beat to be playable. */
  points: THREE.Vector3[];
  portrait: Angles;
  landscape: Angles;
  rate?: number;
  /** Nudge the framing centre, in metres, after fitting. */
  bias?: THREE.Vector3;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const CUFF = v(LAYOUT.cuffCenterX, LAYOUT.armY + 0.08, LAYOUT.armZ);
const CUFF_LOW = v(LAYOUT.cuffCenterX, LAYOUT.armY - 0.07, LAYOUT.armZ + 0.05);
const FOSSA = LAYOUT.fossa.clone();
const BULB = LAYOUT.bulbCenter.clone();
const VALVE = LAYOUT.valveCenter.clone();
const GAUGE = LAYOUT.gaugeCenter.clone();
const STAND = v(0.94, LAYOUT.trolleyTop + 0.26, 0.44);
const REST = v(0.79, LAYOUT.trolleyTop + 0.02, 0.6);
const HEAD = v(-0.73, LAYOUT.couchTop + 0.14, 0);
const SLOT = v(LAYOUT.cuffCenterX, LAYOUT.armY + 0.075, LAYOUT.armZ);

/**
 * A fixed rail — the child never flies a camera. Each shot names the things
 * that must stay in frame, and the distance is solved for the live aspect
 * ratio, so no anchor can drift off the edge of a phone in either orientation.
 *
 * Portrait looks down from the front, which puts the cuff high and the bulb
 * and valve low, so the working hand never covers the place the sound comes
 * from. Landscape swings round so the arm lies to the left, the valve and
 * stethoscope to the right, and the instructor sits behind.
 */
const SHOTS: Record<ShotName, Shot> = {
  establish: {
    points: [HEAD, CUFF, BULB, STAND, v(-0.3, 1.25, -0.6)],
    portrait: { azimuth: -8, elevation: 13, fov: 46, margin: 0.16 },
    landscape: { azimuth: -14, elevation: 12, fov: 40, margin: 0.16 },
    rate: 1.3,
  },
  mid: {
    points: [CUFF, CUFF_LOW, FOSSA, BULB, VALVE, GAUGE, REST, STAND],
    portrait: { azimuth: -7, elevation: 31, fov: 48, margin: 0.14 },
    landscape: { azimuth: -24, elevation: 23, fov: 40, margin: 0.15 },
  },
  closeControls: {
    // Close on the working end while the lower edge of the cuff and the dial
    // stay in shot, so pumping visibly does something further up the arm.
    points: [CUFF_LOW, BULB, VALVE, GAUGE],
    portrait: { azimuth: -6, elevation: 33, fov: 46, margin: 0.24 },
    landscape: { azimuth: -26, elevation: 24, fov: 38, margin: 0.14 },
  },
  threeQuarter: {
    // Cuff tension and the aneroid movement, with the valve under the finger.
    points: [CUFF, CUFF_LOW, VALVE, GAUGE, BULB],
    portrait: { azimuth: -12, elevation: 29, fov: 46, margin: 0.24 },
    landscape: { azimuth: -30, elevation: 26, fov: 38, margin: 0.14 },
  },
  listen: {
    points: [CUFF, CUFF_LOW, FOSSA, VALVE, BULB],
    portrait: { azimuth: -5, elevation: 30, fov: 44, margin: 0.22 },
    landscape: { azimuth: -22, elevation: 22, fov: 36, margin: 0.19 },
    rate: 2.4,
  },
  reveal: {
    points: [
      v(SLOT.x - 0.14, SLOT.y - 0.06, SLOT.z - 0.04),
      v(SLOT.x + 0.14, SLOT.y + 0.02, SLOT.z + 0.07),
    ],
    portrait: { azimuth: -3, elevation: 54, fov: 34, margin: 0.12 },
    landscape: { azimuth: -10, elevation: 50, fov: 30, margin: 0.14 },
    rate: 2.0,
  },
  compare: {
    points: [CUFF, CUFF_LOW, FOSSA, VALVE, BULB, GAUGE],
    portrait: { azimuth: -8, elevation: 28, fov: 48, margin: 0.2 },
    landscape: { azimuth: -22, elevation: 22, fov: 42, margin: 0.19 },
  },
};

const DEG = Math.PI / 180;

export class CameraDirector {
  readonly camera: THREE.PerspectiveCamera;
  private pos = new THREE.Vector3();
  private target = new THREE.Vector3();
  private desiredPos = new THREE.Vector3();
  private desiredTarget = new THREE.Vector3();
  private desiredFov = 45;
  private rate = 1.9;
  private locked = false;
  private current: ShotName = 'establish';
  private portrait = true;
  private aspect: number;

  constructor(aspect: number, portrait: boolean) {
    this.aspect = aspect;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.02, 40);
    this.portrait = portrait;
    this.solve('establish');
    this.pos.copy(this.desiredPos);
    this.target.copy(this.desiredTarget);
    this.camera.fov = this.desiredFov;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.target);
  }

  setOrientation(portrait: boolean): void {
    if (this.portrait === portrait) return;
    this.portrait = portrait;
    // Re-framing only. Pressure, valve angle, beat phase and the sound stage
    // all carry straight through a rotation.
    this.solve(this.current);
  }

  resize(aspect: number): void {
    this.aspect = aspect;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.solve(this.current);
  }

  cut(shot: ShotName): void {
    if (this.current === shot) return;
    this.locked = false;
    this.solve(shot);
  }

  /** Stop the camera dead so nothing competes with the sound. */
  hold(): void {
    this.locked = true;
  }

  release(): void {
    this.locked = false;
  }

  get shot(): ShotName {
    return this.current;
  }

  /** Fit the shot's framing points for the current aspect ratio. */
  private solve(shot: ShotName): void {
    this.current = shot;
    const s = SHOTS[shot];
    const a = this.portrait ? s.portrait : s.landscape;
    this.desiredFov = a.fov;
    this.rate = s.rate ?? 2.5;

    const dir = new THREE.Vector3(
      Math.sin(a.azimuth * DEG) * Math.cos(a.elevation * DEG),
      Math.sin(a.elevation * DEG),
      Math.cos(a.azimuth * DEG) * Math.cos(a.elevation * DEG),
    ).normalize();

    const centre = new THREE.Vector3();
    for (const p of s.points) centre.add(p);
    centre.multiplyScalar(1 / s.points.length);
    if (s.bias) centre.add(s.bias);

    const forward = dir.clone().negate();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    const tanV = Math.tan((a.fov * DEG) / 2) * (1 - a.margin);
    const tanH = tanV * this.aspect;

    let distance = 0.4;
    const rel = new THREE.Vector3();
    for (const p of s.points) {
      rel.copy(p).sub(centre);
      const depth = rel.dot(forward);
      const dx = Math.abs(rel.dot(right));
      const dy = Math.abs(rel.dot(up));
      distance = Math.max(distance, dx / tanH - depth, dy / tanV - depth);
    }
    distance = clamp(distance * 1.02, 0.24, 7.5);

    this.desiredTarget.copy(centre);
    this.desiredPos.copy(centre).addScaledVector(dir, distance);
    // Never dip below the couch or clip through the floor.
    this.desiredPos.y = Math.max(this.desiredPos.y, LAYOUT.couchTop + 0.16);
  }

  update(dt: number): void {
    if (!this.locked) {
      const r = this.rate;
      this.pos.x = damp(this.pos.x, this.desiredPos.x, r, dt);
      this.pos.y = damp(this.pos.y, this.desiredPos.y, r, dt);
      this.pos.z = damp(this.pos.z, this.desiredPos.z, r, dt);
      this.target.x = damp(this.target.x, this.desiredTarget.x, r, dt);
      this.target.y = damp(this.target.y, this.desiredTarget.y, r, dt);
      this.target.z = damp(this.target.z, this.desiredTarget.z, r, dt);
      const fov = damp(this.camera.fov, this.desiredFov, r, dt);
      if (Math.abs(fov - this.camera.fov) > 1e-4) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
    }
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.target);
  }
}
