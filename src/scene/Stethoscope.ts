import * as THREE from 'three';
import { clamp01, lerp } from '../util/math';
import { LAYOUT } from './layout';
import type { Materials } from './Materials';

/** A tube whose centreline can be rewritten every frame without reallocating. */
class DynamicTube {
  readonly mesh: THREE.Mesh;
  private readonly segs: number;
  private readonly radial: number;
  private readonly radius: number;
  private curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(),
    new THREE.Vector3(0, 1, 0),
  ]);

  constructor(segs: number, radial: number, radius: number, mat: THREE.Material) {
    this.segs = segs;
    this.radial = radial;
    this.radius = radius;
    const count = (segs + 1) * (radial + 1);
    const pos = new Float32Array(count * 3);
    const nrm = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const idx: number[] = [];
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j;
        const b = a + 1;
        const c = a + radial + 1;
        const d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
    for (let i = 0; i <= segs; i++) {
      for (let j = 0; j <= radial; j++) {
        const k = i * (radial + 1) + j;
        uv[k * 2] = i / segs;
        uv[k * 2 + 1] = j / radial;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
  }

  setPoints(points: THREE.Vector3[]): void {
    this.curve.points = points;
    const g = this.mesh.geometry;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const nrm = g.getAttribute('normal') as THREE.BufferAttribute;
    const pArr = pos.array as Float32Array;
    const nArr = nrm.array as Float32Array;

    // Parallel transport keeps the tube from spinning as the end moves.
    const up = new THREE.Vector3(0, 1, 0);
    let normal = new THREE.Vector3(1, 0, 0);
    const p = new THREE.Vector3();
    const t = new THREE.Vector3();
    const binormal = new THREE.Vector3();
    for (let i = 0; i <= this.segs; i++) {
      const u = i / this.segs;
      this.curve.getPointAt(u, p);
      this.curve.getTangentAt(u, t).normalize();
      if (i === 0) {
        normal.copy(Math.abs(t.dot(up)) > 0.92 ? new THREE.Vector3(1, 0, 0) : up)
          .cross(t)
          .normalize();
      } else {
        normal.sub(t.clone().multiplyScalar(normal.dot(t))).normalize();
      }
      binormal.copy(t).cross(normal).normalize();
      for (let j = 0; j <= this.radial; j++) {
        const a = (j / this.radial) * Math.PI * 2;
        const cx = Math.cos(a);
        const sy = Math.sin(a);
        const k = i * (this.radial + 1) + j;
        const nx = normal.x * cx + binormal.x * sy;
        const ny = normal.y * cx + binormal.y * sy;
        const nz = normal.z * cx + binormal.z * sy;
        pArr[k * 3] = p.x + nx * this.radius;
        pArr[k * 3 + 1] = p.y + ny * this.radius;
        pArr[k * 3 + 2] = p.z + nz * this.radius;
        nArr[k * 3] = nx;
        nArr[k * 3 + 1] = ny;
        nArr[k * 3 + 2] = nz;
      }
    }
    pos.needsUpdate = true;
    nrm.needsUpdate = true;
    g.computeBoundingSphere();
  }
}

/** Resting place of the chestpiece before the child picks it up. */
export const CHESTPIECE_REST = new THREE.Vector3(0.79, LAYOUT.trolleyTop + 0.013, 0.6);

/**
 * The stethoscope. Steel chestpiece, thin polymer diaphragm, an elastic rim
 * that compresses against the skin, soft tubing, and silicone eartips resting
 * in the training listening stand.
 */
export class StethoscopeRig {
  readonly group = new THREE.Group();
  readonly chestpiece = new THREE.Group();
  /** World position of the diaphragm face. */
  readonly position = CHESTPIECE_REST.clone();

  private rim!: THREE.Mesh;
  private diaphragm!: THREE.Mesh;
  private mainTube!: DynamicTube;
  private branchA!: DynamicTube;
  private branchB!: DynamicTube;
  private yPiece = new THREE.Vector3(0.93, 0.79, 0.47);
  private earA = new THREE.Vector3(0.985, 0.9, 0.4);
  private earB = new THREE.Vector3(0.895, 0.9, 0.4);
  private sway = 0;
  private lastTubeKey = '';

  constructor(private mats: Materials) {
    this.buildStand();
    this.buildChestpiece();
    this.buildTubing();
    this.setPosition(CHESTPIECE_REST, 0, 0);
  }

  private buildStand(): void {
    const m = this.mats;
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.055, 0.012, 20),
      m.steelSatin,
    );
    base.position.set(0.94, LAYOUT.trolleyTop + 0.006, 0.44);
    base.castShadow = true;
    this.group.add(base);
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.008, 0.25, 12),
      m.steelFrame,
    );
    post.position.set(0.94, LAYOUT.trolleyTop + 0.13, 0.44);
    this.group.add(post);
    const cradle = new THREE.Mesh(
      new THREE.TorusGeometry(0.032, 0.005, 8, 22, Math.PI * 1.25),
      m.steelFrame,
    );
    cradle.rotation.x = Math.PI / 2;
    cradle.rotation.z = Math.PI * 0.35;
    cradle.position.set(0.94, LAYOUT.trolleyTop + 0.245, 0.42);
    this.group.add(cradle);
    const pad = this.mats.makeShadowPatch(0.14, 0.13);
    pad.position.set(0.94, LAYOUT.trolleyTop + 0.001, 0.44);
    this.group.add(pad);
  }

  private buildChestpiece(): void {
    const m = this.mats;

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0235, 0.0225, 0.009, 34),
      m.steelBrushed,
    );
    this.chestpiece.add(body);

    // Machined step around the head, worn brighter where fingers hold it.
    const step = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0248, 0.0248, 0.0028, 34),
      m.steelSatin,
    );
    step.position.y = 0.0042;
    this.chestpiece.add(step);

    this.rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.0238, 0.0021, 8, 30),
      m.elastomerRim,
    );
    this.rim.rotation.x = Math.PI / 2;
    this.rim.position.y = -0.0048;
    this.chestpiece.add(this.rim);

    this.diaphragm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0224, 0.0224, 0.0009, 34),
      m.diaphragm,
    );
    this.diaphragm.position.y = -0.0046;
    this.chestpiece.add(this.diaphragm);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0042, 0.0048, 0.024, 14),
      m.steelBrushed,
    );
    stem.position.set(0.0, 0.014, -0.014);
    stem.rotation.x = -0.7;
    this.chestpiece.add(stem);

    this.group.add(this.chestpiece);

    const sh = this.mats.makeShadowPatch(0.075, 0.07);
    sh.position.set(CHESTPIECE_REST.x, LAYOUT.trolleyTop + 0.001, CHESTPIECE_REST.z);
    this.group.add(sh);
  }

  private buildTubing(): void {
    const m = this.mats;
    this.mainTube = new DynamicTube(34, 7, 0.0048, m.tubing);
    this.branchA = new DynamicTube(16, 6, 0.0042, m.tubing);
    this.branchB = new DynamicTube(16, 6, 0.0042, m.tubing);
    this.group.add(this.mainTube.mesh, this.branchA.mesh, this.branchB.mesh);

    const yPiece = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0062, 0.0075, 0.016, 12),
      m.steelSatin,
    );
    yPiece.position.copy(this.yPiece);
    this.group.add(yPiece);

    for (const p of [this.earA, this.earB]) {
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0072, 12, 10), m.siliconeTip);
      tip.scale.set(1, 0.8, 1);
      tip.position.copy(p);
      this.group.add(tip);
      const eartube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0035, 0.0035, 0.03, 8),
        m.steelSatin,
      );
      eartube.position.set(p.x, p.y - 0.02, p.z + 0.004);
      this.group.add(eartube);
    }
  }

  /**
   * `contact` compresses the rim and sinks the head into the skin; `lift` is
   * how far the child has raised it while dragging.
   */
  setPosition(p: THREE.Vector3, contact: number, lift: number): void {
    this.position.copy(p);
    const c = clamp01(contact);
    this.chestpiece.position.set(p.x, p.y + lift, p.z);
    // Slight tilt to follow the curve of the limb once it is seated.
    this.chestpiece.rotation.z = lerp(0, -0.06, c);
    this.chestpiece.rotation.x = lerp(0.05, 0.0, c);
    this.rim.scale.set(1 + c * 0.05, 1, 1 + c * 0.05);
    this.rim.position.y = -0.0048 + c * 0.0016;
    this.diaphragm.position.y = -0.0046 + c * 0.0012;
  }

  /** A barely visible diaphragm motion locked to the beat, once seated. */
  setDiaphragmPulse(amount: number): void {
    const k = 1 + amount * 0.006;
    this.diaphragm.scale.set(k, 1 + amount * 0.35, k);
  }

  update(dt: number, dragging: boolean): void {
    // The tubing lags the head, then settles — cloth-and-rubber, not wire.
    this.sway = lerp(this.sway, dragging ? 1 : 0, 1 - Math.exp(-6 * dt));
    const p = this.chestpiece.position;
    const drop = 0.05 + this.sway * 0.03;
    const key = `${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)},${drop.toFixed(4)}`;
    if (key === this.lastTubeKey) return;
    this.lastTubeKey = key;
    const mid1 = new THREE.Vector3(
      lerp(p.x, this.yPiece.x, 0.3),
      Math.min(p.y, this.yPiece.y) - drop,
      lerp(p.z, this.yPiece.z, 0.3) + 0.05,
    );
    const mid2 = new THREE.Vector3(
      lerp(p.x, this.yPiece.x, 0.72),
      Math.min(p.y, this.yPiece.y) - drop * 0.55,
      lerp(p.z, this.yPiece.z, 0.72) + 0.02,
    );
    this.mainTube.setPoints([
      new THREE.Vector3(p.x, p.y + 0.018, p.z - 0.022),
      mid1,
      mid2,
      new THREE.Vector3(this.yPiece.x, this.yPiece.y - 0.012, this.yPiece.z + 0.004),
    ]);
    this.branchA.setPoints([
      new THREE.Vector3(this.yPiece.x + 0.002, this.yPiece.y + 0.006, this.yPiece.z),
      new THREE.Vector3(this.earA.x - 0.012, this.earA.y - 0.06, this.earA.z + 0.02),
      new THREE.Vector3(this.earA.x, this.earA.y - 0.036, this.earA.z + 0.004),
    ]);
    this.branchB.setPoints([
      new THREE.Vector3(this.yPiece.x - 0.002, this.yPiece.y + 0.006, this.yPiece.z),
      new THREE.Vector3(this.earB.x + 0.012, this.earB.y - 0.06, this.earB.z + 0.02),
      new THREE.Vector3(this.earB.x, this.earB.y - 0.036, this.earB.z + 0.004),
    ]);
  }
}
