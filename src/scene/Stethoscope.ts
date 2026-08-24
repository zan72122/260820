import {
  CylinderGeometry,
  Group,
  Mesh,
  Object3D,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { clamp01, damp, lerp } from '../core/mathutil';
import { valueNoise1D } from '../core/rng';
import { halfDepthAt, axisYAt } from './ChestSurface';
import { FlexTube } from './FlexTube';
import type { MaterialLibrary } from './materials';

/**
 * The training stethoscope, built as separate materials rather than one
 * "stethoscope object": machined stainless body, a moulded non-chill rim, a
 * thin tensioned diaphragm, elastic tubing with a set bend, metal ear tubes
 * and soft eartips.
 */
export class Stethoscope {
  readonly root = new Group();
  readonly chestpiece = new Group();
  readonly binaural = new Group();
  readonly earTips: Object3D[] = [];

  private diaphragm: Mesh;
  private rim: Mesh;
  private stem: Object3D;
  private tube: FlexTube;
  private tubeMesh: Mesh;
  private sag = valueNoise1D(1234);

  private pressCurrent = 0;
  private tremorPhase = 0;
  private bendMemory = 0.62;

  // Scratch objects — the pose is recomputed every frame.
  private up = new Vector3(0, 1, 0);
  private quat = new Quaternion();
  private tubePts: Vector3[] = [];
  private tubePool: Vector3[] = Array.from({ length: 10 }, () => new Vector3());
  private fromScratch = new Vector3();
  private toScratch = new Vector3();
  private dirScratch = new Vector3();

  constructor(mats: MaterialLibrary) {
    // --- Chestpiece -------------------------------------------------------
    const body = new Mesh(new CylinderGeometry(0.0225, 0.0245, 0.0105, 40), mats.brushedSteel);
    body.castShadow = true;
    this.chestpiece.add(body);

    const bezel = new Mesh(new TorusGeometry(0.0243, 0.0022, 10, 44), mats.chromeSteel);
    bezel.rotation.x = Math.PI / 2;
    bezel.position.y = -0.0044;
    this.chestpiece.add(bezel);

    // Moulded ring that keeps cold metal off the skin.
    this.rim = new Mesh(new TorusGeometry(0.0246, 0.0028, 10, 44), mats.nonChillRim);
    this.rim.rotation.x = Math.PI / 2;
    this.rim.position.y = -0.0058;
    this.chestpiece.add(this.rim);

    // A membrane, not a painted disc: it is thin and slightly translucent.
    this.diaphragm = new Mesh(new CylinderGeometry(0.0232, 0.0232, 0.0006, 40), mats.diaphragm);
    this.diaphragm.position.y = -0.0052;
    this.chestpiece.add(this.diaphragm);

    // Bell side and stem.
    const bell = new Mesh(new CylinderGeometry(0.0155, 0.0205, 0.008, 32), mats.brushedSteel);
    bell.position.y = 0.0087;
    this.chestpiece.add(bell);
    const stem = new Mesh(new CylinderGeometry(0.0042, 0.005, 0.021, 16), mats.chromeSteel);
    stem.position.set(0, 0.021, 0.0);
    stem.rotation.x = -0.5;
    this.chestpiece.add(stem);
    const stemTip = new Object3D();
    stemTip.position.set(0, 0.031, 0.010);
    this.chestpiece.add(stemTip);
    this.stem = stemTip;

    this.root.add(this.chestpiece);

    // --- Tubing -----------------------------------------------------------
    this.tube = new FlexTube(0.0088, 46, 10);
    this.tubeMesh = new Mesh(this.tube.geometry, mats.tubing);
    this.tubeMesh.castShadow = true;
    this.tubeMesh.frustumCulled = false;
    this.root.add(this.tubeMesh);

    // --- Binaural ---------------------------------------------------------
    const yoke = new Mesh(new CylinderGeometry(0.006, 0.0075, 0.055, 14), mats.chromeSteel);
    yoke.position.y = 0.03;
    this.binaural.add(yoke);
    for (const sx of [-1, 1]) {
      const arm = new Mesh(new CylinderGeometry(0.0042, 0.0048, 0.12, 12), mats.chromeSteel);
      arm.position.set(sx * 0.024, 0.085, 0);
      arm.rotation.z = -sx * 0.3;
      arm.castShadow = true;
      this.binaural.add(arm);
      const bend = new Mesh(new TorusGeometry(0.018, 0.0042, 8, 16, Math.PI * 0.7), mats.chromeSteel);
      bend.position.set(sx * 0.038, 0.136, 0);
      bend.rotation.set(Math.PI / 2, 0, sx * 1.15);
      this.binaural.add(bend);
      const tip = new Mesh(new SphereGeometry(0.0085, 14, 10), mats.earTip);
      tip.scale.set(1, 0.85, 1.2);
      tip.position.set(sx * 0.052, 0.15, 0.002);
      this.binaural.add(tip);
      this.earTips.push(tip);
    }
    this.root.add(this.binaural);
  }

  /** Where the tubing leaves the binaural, in world space. */
  private binauralPort(out: Vector3): Vector3 {
    return out.set(0, 0.004, 0).applyMatrix4(this.binaural.matrixWorld);
  }

  /**
   * Place the chestpiece on the chest.
   * `press` 0..1 compresses the non-chill rim and lets the skin take it.
   */
  setPose(position: Vector3, normal: Vector3, press: number, dt: number): void {
    this.pressCurrent = damp(this.pressCurrent, clamp01(press), 12, dt);
    const sink = this.pressCurrent * 0.0042;

    this.quat.setFromUnitVectors(this.up, normal);
    this.chestpiece.quaternion.copy(this.quat);
    this.chestpiece.position.copy(position).addScaledVector(normal, 0.0092 - sink);

    // The rim squashes and the membrane tightens; nothing else moves.
    this.rim.scale.set(1 + this.pressCurrent * 0.05, 1, 1 - this.pressCurrent * 0.28);
    this.diaphragm.position.y = -0.0052 + this.pressCurrent * 0.0009;
    this.diaphragm.scale.setScalar(1 + this.pressCurrent * 0.012);
  }

  /** Small visible tremor while a strong sound arrives at this spot. */
  applyTremor(amount: number, beatEnergy: number, dt: number): void {
    this.tremorPhase += dt * 60;
    const a = clamp01(amount) * clamp01(beatEnergy) * 0.0011;
    this.chestpiece.position.x += Math.sin(this.tremorPhase * 1.7) * a;
    this.chestpiece.position.y += Math.sin(this.tremorPhase * 2.3 + 1.1) * a * 0.7;
  }

  /** 0 = tubing hangs slack, 1 = the instructor has taken up the slack. */
  setTubeTension(t: number, dt: number): void {
    this.bendMemory = damp(this.bendMemory, lerp(0.62, 0.2, clamp01(t)), 4, dt);
  }

  updateTube(time: number): void {
    this.chestpiece.updateWorldMatrix(true, false);
    this.binaural.updateWorldMatrix(true, false);

    const from = this.stem.getWorldPosition(this.fromScratch);
    const to = this.binauralPort(this.toScratch);

    // The control points are recycled: this runs every frame.
    const pts = this.tubePts;
    pts.length = 0;
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = this.tubePool[i].lerpVectors(from, to, t);
      // Gravity sag with a remembered bend, plus a barely-there sway.
      const arc = Math.sin(t * Math.PI);
      p.y -= arc * this.bendMemory * 0.15;
      p.y += this.sag(t * 4 + time * 0.35) * arc * 0.006;
      p.x += this.sag(t * 4 + 31 + time * 0.28) * arc * 0.008;
      // Keep the tube outside the trunk shell — it may rest on it, never in it.
      const surfaceY = axisYAt(p.z) + halfDepthAt(p.z) + 0.012;
      const nearBody = Math.abs(p.x) < 0.26 && p.z > -0.62 && p.z < 0.56;
      if (nearBody && p.y < surfaceY) p.y = surfaceY;
      pts.push(p);
    }
    // Leave the stem along its own axis first, so the tube does not kink.
    this.stem.getWorldDirection(this.dirScratch);
    this.tubePool[7].copy(from).addScaledVector(this.dirScratch, -0.02);
    pts.splice(1, 0, this.tubePool[7]);
    this.tube.setPath(pts);
  }
}
