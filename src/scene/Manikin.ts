import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  Group,
  Mesh,
  SphereGeometry,
  Vector3,
} from 'three';
import type { CardiacClock } from '../core/CardiacClock';
import { clamp01, damp } from '../core/mathutil';
import {
  TABLE_TOP_Y,
  TORSO_Z_MAX,
  TORSO_Z_MIN,
  axisYAt,
  trunkPoint,
} from './ChestSurface';
import type { MaterialLibrary } from './materials';

/**
 * The adult cardiac-auscultation training manikin.
 *
 * It is equipment, not a patient: moulded synthetic skin over a shell, visible
 * seams between replaceable modules, a cradle underneath holding it on the
 * table. The head is deliberately plain and kept towards the back of frame.
 */
export class Manikin {
  readonly root = new Group();
  /** The mesh that the chestpiece is raycast against. */
  readonly torsoMesh: Mesh;
  private rollGroup = new Group();
  private bodyGroup = new Group();
  private breathPhase = 0;
  private rollTarget = 0;
  private rollCurrent = 0;

  constructor(mats: MaterialLibrary) {
    const pivotY = axisYAt(-0.05);
    this.rollGroup.position.set(0, pivotY, 0);
    this.bodyGroup.position.set(0, -pivotY, 0);
    this.rollGroup.add(this.bodyGroup);
    this.root.add(this.rollGroup);

    this.torsoMesh = new Mesh(buildTorsoGeometry(), mats.skin);
    this.torsoMesh.castShadow = true;
    this.torsoMesh.receiveShadow = true;
    this.torsoMesh.name = 'manikin-torso';
    this.bodyGroup.add(this.torsoMesh);

    // Head module: moulded, matte, no attempt at a lifelike face.
    const head = new Group();
    const skull = new Mesh(new SphereGeometry(0.098, 28, 20), mats.skin);
    skull.scale.set(0.94, 1.0, 1.16);
    skull.castShadow = true;
    head.add(skull);
    const jaw = new Mesh(new BoxGeometry(0.115, 0.058, 0.108), mats.skin);
    jaw.position.set(0, -0.055, 0.026);
    head.add(jaw);
    const nose = new Mesh(new SphereGeometry(0.021, 12, 10), mats.skin);
    nose.position.set(0, 0.03, 0.086);
    nose.scale.set(0.8, 0.9, 1.3);
    head.add(nose);
    head.position.set(0, TABLE_TOP_Y + 0.098, -0.74);
    head.rotation.set(-0.12, 0.22, 0);
    this.bodyGroup.add(head);

    // Neck module joint.
    const neck = new Mesh(new CapsuleGeometry(0.052, 0.08, 6, 16), mats.skin);
    neck.rotation.x = Math.PI / 2;
    neck.position.set(0, TABLE_TOP_Y + 0.078, -0.62);
    this.bodyGroup.add(neck);

    // Upper-arm stubs — the arms are separate replaceable modules.
    for (const side of [-1, 1]) {
      const arm = new Mesh(new CapsuleGeometry(0.05, 0.2, 6, 16), mats.skin);
      arm.rotation.set(Math.PI / 2, 0, side * 0.16);
      arm.position.set(side * 0.212, TABLE_TOP_Y + 0.052, -0.3);
      arm.castShadow = true;
      this.bodyGroup.add(arm);
      const cuff = new Mesh(new CapsuleGeometry(0.049, 0.012, 4, 16), mats.manikinShell);
      cuff.rotation.set(Math.PI / 2, 0, side * 0.16);
      cuff.position.set(side * 0.204, TABLE_TOP_Y + 0.052, -0.19);
      this.bodyGroup.add(cuff);
    }

    // Support cradle: the torso does not float on the pad.
    const cradle = new Mesh(new BoxGeometry(0.3, 0.03, 0.36), mats.manikinShell);
    cradle.position.set(0, TABLE_TOP_Y + 0.012, 0.12);
    cradle.receiveShadow = true;
    this.bodyGroup.add(cradle);

    // Service port on the flank, as on a real skills-lab torso.
    const port = new Mesh(new BoxGeometry(0.052, 0.03, 0.07), mats.manikinShell);
    port.position.set(0.166, TABLE_TOP_Y + 0.06, 0.3);
    port.rotation.z = -0.3;
    this.bodyGroup.add(port);
  }

  /** 0 = supine, 1 = rolled towards the left lateral position. */
  setLateralRoll(amount: number): void {
    this.rollTarget = clamp01(amount);
  }

  getLateralRoll(): number {
    return this.rollCurrent;
  }

  update(dt: number, clock: CardiacClock): void {
    this.rollCurrent = damp(this.rollCurrent, this.rollTarget, 3.2, dt);
    this.rollGroup.rotation.z = -this.rollCurrent * 0.26;

    // Slow, quiet respiration plus the small lift of ventricular contraction.
    this.breathPhase += dt * (Math.PI * 2) / 4.3;
    const breath = Math.sin(this.breathPhase) * 0.5 + 0.5;
    const beat = clock.contractionEnvelope();
    this.bodyGroup.position.y = -axisYAt(-0.05) + breath * 0.0042 + beat * 0.0011;
    this.torsoMesh.scale.set(1 + breath * 0.0035, 1 + breath * 0.0055, 1);
  }
}

/** Lathe the parametric trunk into a closed shell with consistent normals. */
function buildTorsoGeometry(): BufferGeometry {
  const zSegs = 96;
  const phiSegs = 72;
  const verts: number[] = [];
  const norms: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const sp = { position: new Vector3(), normal: new Vector3() };

  for (let i = 0; i <= zSegs; i++) {
    const t = i / zSegs;
    const z = TORSO_Z_MIN + t * (TORSO_Z_MAX - TORSO_Z_MIN);
    for (let j = 0; j <= phiSegs; j++) {
      const phi = (j / phiSegs) * Math.PI * 2 - Math.PI;
      trunkPoint(z, phi, sp);
      verts.push(sp.position.x, sp.position.y, sp.position.z);
      norms.push(sp.normal.x, sp.normal.y, sp.normal.z);
      uvs.push(j / phiSegs, t);
    }
  }
  const row = phiSegs + 1;
  for (let i = 0; i < zSegs; i++) {
    for (let j = 0; j < phiSegs; j++) {
      const a = i * row + j;
      const b = a + row;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  // Flat caps so the shell is closed from every angle.
  for (const [z, dir] of [
    [TORSO_Z_MIN, -1],
    [TORSO_Z_MAX, 1],
  ] as Array<[number, number]>) {
    const centreIndex = verts.length / 3;
    const yc = axisYAt(z);
    verts.push(0, yc, z);
    norms.push(0, 0, dir);
    uvs.push(0.5, 0.5);
    const ringStart = verts.length / 3;
    for (let j = 0; j <= phiSegs; j++) {
      const phi = (j / phiSegs) * Math.PI * 2 - Math.PI;
      trunkPoint(z, phi, sp);
      verts.push(sp.position.x, sp.position.y, sp.position.z);
      norms.push(0, 0, dir);
      uvs.push(0.5 + Math.cos(phi) * 0.45, 0.5 + Math.sin(phi) * 0.45);
    }
    for (let j = 0; j < phiSegs; j++) {
      if (dir < 0) idx.push(centreIndex, ringStart + j, ringStart + j + 1);
      else idx.push(centreIndex, ringStart + j + 1, ringStart + j);
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  geo.setAttribute('normal', new BufferAttribute(new Float32Array(norms), 3));
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}
