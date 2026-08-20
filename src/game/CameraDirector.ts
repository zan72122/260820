import * as THREE from 'three';
import { damp, lerp } from '../util/math';

export interface Shot {
  /** Direction from the subject toward the camera (will be normalised). */
  dir: THREE.Vector3;
  distance: number;
  fov: number;
  /** Where the subject should sit on screen. +Y pushes it above the thumb. */
  ndcY: number;
  ndcX?: number;
  /** Extra height added to the look-at point. */
  raise?: number;
  /** Distance multiplier applied only in portrait. */
  portraitDistance?: number;
  portraitFov?: number;
  speed?: number;
}

/**
 * The player never controls the camera. Each stage of the job has a shot that
 * keeps the tool, the changing soil and the truck in a readable relationship
 * in both orientations.
 */
export class CameraDirector {
  readonly camera: THREE.PerspectiveCamera;
  private subject = new THREE.Vector3();
  private subjectSmooth = new THREE.Vector3();
  private shot: Shot;
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private desiredPos = new THREE.Vector3();
  private desiredLook = new THREE.Vector3();
  private right = new THREE.Vector3();
  private up = new THREE.Vector3();
  private fwd = new THREE.Vector3();
  private portrait = false;
  private aspect = 1;
  private blend = 0;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.08, 160);
    this.shot = {
      dir: new THREE.Vector3(0.1, 0.6, 1).normalize(),
      distance: 8,
      fov: 46,
      ndcY: 0.15,
    };
    this.pos.set(0, 5, 9);
    this.look.set(0, 0, 0);
  }

  setViewport(width: number, height: number) {
    this.aspect = width / height;
    this.portrait = height > width;
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }

  get isPortrait() {
    return this.portrait;
  }

  setShot(shot: Shot, subject: THREE.Vector3, instant = false) {
    this.shot = shot;
    this.subject.copy(subject);
    this.blend = instant ? 1 : 0;
    if (instant) {
      this.subjectSmooth.copy(subject);
      this.compute();
      this.pos.copy(this.desiredPos);
      this.look.copy(this.desiredLook);
      this.apply();
    }
  }

  setSubject(subject: THREE.Vector3) {
    this.subject.copy(subject);
  }

  private compute() {
    const s = this.shot;
    const dist = this.portrait ? s.distance * (s.portraitDistance ?? 1.16) : s.distance;
    const fov = this.portrait ? (s.portraitFov ?? s.fov + 6) : s.fov;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();

    const target = this.subjectSmooth.clone();
    target.y += s.raise ?? 0;

    this.fwd.copy(s.dir).normalize();
    this.desiredPos.copy(target).addScaledVector(this.fwd, dist);
    this.desiredLook.copy(target);

    // shift the frame so the subject sits where the shot wants it
    const view = new THREE.Vector3().subVectors(this.desiredLook, this.desiredPos).normalize();
    this.right.crossVectors(view, new THREE.Vector3(0, 1, 0)).normalize();
    this.up.crossVectors(this.right, view).normalize();
    const halfH = Math.tan(THREE.MathUtils.degToRad(fov) / 2) * dist;
    const halfW = halfH * this.aspect;
    const ndcY = this.portrait ? s.ndcY : s.ndcY * 0.72;
    const ndcX = s.ndcX ?? 0;
    const offX = -ndcX * halfW;
    const offY = -ndcY * halfH;
    this.desiredPos.addScaledVector(this.right, offX).addScaledVector(this.up, offY);
    this.desiredLook.addScaledVector(this.right, offX).addScaledVector(this.up, offY);
  }

  update(dt: number) {
    const speed = this.shot.speed ?? 2.6;
    this.subjectSmooth.x = damp(this.subjectSmooth.x, this.subject.x, speed * 1.6, dt);
    this.subjectSmooth.y = damp(this.subjectSmooth.y, this.subject.y, speed * 1.6, dt);
    this.subjectSmooth.z = damp(this.subjectSmooth.z, this.subject.z, speed * 1.6, dt);
    this.compute();
    this.blend = Math.min(1, this.blend + dt * 0.9);
    const k = lerp(speed * 0.65, speed, this.blend);
    this.pos.x = damp(this.pos.x, this.desiredPos.x, k, dt);
    this.pos.y = damp(this.pos.y, this.desiredPos.y, k, dt);
    this.pos.z = damp(this.pos.z, this.desiredPos.z, k, dt);
    this.look.x = damp(this.look.x, this.desiredLook.x, k * 1.25, dt);
    this.look.y = damp(this.look.y, this.desiredLook.y, k * 1.25, dt);
    this.look.z = damp(this.look.z, this.desiredLook.z, k * 1.25, dt);
    this.apply();
  }

  private apply() {
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }

  /** True once the camera has essentially arrived at the requested framing. */
  settled(tolerance = 0.35) {
    return this.pos.distanceTo(this.desiredPos) < tolerance;
  }
}

export const SHOTS = {
  /** Opening: the whole work area with the truck reading as mid-ground. */
  establish: (): Shot => ({
    dir: new THREE.Vector3(-0.35, 0.46, 1).normalize(),
    distance: 12.5,
    fov: 42,
    ndcY: 0.08,
    raise: 0.9,
    portraitDistance: 1.34,
    portraitFov: 52,
    speed: 1.5,
  }),
  /** Locating: shallow overhead so the sensor shadow and the ground read together. */
  detect: (): Shot => ({
    dir: new THREE.Vector3(-0.12, 0.82, 0.86).normalize(),
    distance: 4.6,
    fov: 44,
    ndcY: 0.2,
    raise: 0.24,
    portraitDistance: 1.2,
    portraitFov: 52,
    speed: 2.2,
  }),
  /** First wetting: low and close, so the colour change is unmistakable. */
  water: (): Shot => ({
    dir: new THREE.Vector3(-0.25, 0.4, 0.92).normalize(),
    distance: 2.15,
    fov: 44,
    ndcY: 0.22,
    raise: 0.12,
    portraitDistance: 1.22,
    portraitFov: 53,
    speed: 2.4,
  }),
  /** Suction: mid shot, both the wet patch and the hose in frame. */
  vacuum: (): Shot => ({
    dir: new THREE.Vector3(-0.34, 0.56, 0.86).normalize(),
    distance: 3.1,
    fov: 44,
    ndcY: 0.2,
    raise: 0.16,
    portraitDistance: 1.22,
    portraitFov: 53,
    speed: 2.2,
  }),
  /** The moment a made thing appears in the dirt. */
  macro: (): Shot => ({
    dir: new THREE.Vector3(-0.1, 0.46, 0.9).normalize(),
    distance: 1.35,
    fov: 40,
    ndcY: 0.12,
    raise: 0.05,
    portraitDistance: 1.2,
    portraitFov: 48,
    speed: 1.7,
  }),
  /** Working around the pipe. */
  expose: (): Shot => ({
    dir: new THREE.Vector3(-0.4, 0.62, 0.78).normalize(),
    distance: 2.7,
    fov: 44,
    ndcY: 0.2,
    raise: 0.14,
    portraitDistance: 1.22,
    portraitFov: 53,
    speed: 2.2,
  }),
  /** Side three-quarter: ground line, hole and pipe all visible at once. */
  depth: (): Shot => ({
    dir: new THREE.Vector3(-0.88, 0.3, 0.5).normalize(),
    distance: 2.5,
    fov: 42,
    ndcY: 0.14,
    raise: 0.3,
    portraitDistance: 1.22,
    portraitFov: 50,
    speed: 1.9,
  }),
  /** Pull back and hand the next patch of ground to the player. */
  handoff: (): Shot => ({
    dir: new THREE.Vector3(-0.28, 0.58, 0.94).normalize(),
    distance: 7.2,
    fov: 44,
    ndcY: 0.1,
    raise: 0.5,
    portraitDistance: 1.3,
    portraitFov: 54,
    speed: 1.5,
  }),
  /** Short underground cutaway, only unlocked after the first find. */
  cutaway: (): Shot => ({
    dir: new THREE.Vector3(-0.95, 0.14, 0.3).normalize(),
    distance: 2.3,
    fov: 40,
    ndcY: 0.05,
    raise: -0.18,
    portraitDistance: 1.24,
    portraitFov: 48,
    speed: 1.4,
  }),
};
