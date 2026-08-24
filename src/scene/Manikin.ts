import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  Group,
  Mesh,
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

    // This is a torso trainer: it ends in a moulded neck plug with a collar,
    // and the arms are not part of the cardiac module at all. Nothing here
    // tries to be a face.
    const neck = new Mesh(new CylinderGeometry(0.055, 0.062, 0.075, 20), mats.skin);
    neck.rotation.x = Math.PI / 2 - 0.16;
    neck.position.set(0, TABLE_TOP_Y + 0.098, -0.632);
    neck.castShadow = true;
    this.bodyGroup.add(neck);
    const collar = new Mesh(new CylinderGeometry(0.058, 0.058, 0.014, 20), mats.manikinShell);
    collar.rotation.x = Math.PI / 2 - 0.16;
    collar.position.set(0, TABLE_TOP_Y + 0.104, -0.664);
    this.bodyGroup.add(collar);
    const plug = new Mesh(new CylinderGeometry(0.04, 0.04, 0.02, 16), mats.trainingPolymer);
    plug.rotation.x = Math.PI / 2 - 0.16;
    plug.position.set(0, TABLE_TOP_Y + 0.107, -0.676);
    this.bodyGroup.add(plug);

    // The trainer ends at the upper abdomen in a moulded end plate, and the
    // whole torso is carried on a base that rests on the pad.
    const endPlate = new Mesh(new CylinderGeometry(0.128, 0.118, 0.024, 28), mats.manikinShell);
    endPlate.rotation.x = Math.PI / 2;
    endPlate.scale.set(1.0, 1.0, 0.66);
    endPlate.position.set(0, TABLE_TOP_Y + 0.072, 0.428);
    endPlate.castShadow = true;
    this.bodyGroup.add(endPlate);

    const base = new Mesh(new BoxGeometry(0.28, 0.026, 0.72), mats.manikinShell);
    base.position.set(0, TABLE_TOP_Y + 0.013, 0.06);
    base.castShadow = true;
    base.receiveShadow = true;
    this.bodyGroup.add(base);

    // Service port on the flank, as on a real skills-lab torso.
    const port = new Mesh(new BoxGeometry(0.05, 0.028, 0.066), mats.manikinShell);
    port.position.set(0.148, TABLE_TOP_Y + 0.055, 0.3);
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
    // Respiration and the beat move the torso rather than scaling it: the
    // chestpiece mapping has to stay exact wherever the child puts a finger.
    this.bodyGroup.position.y = -axisYAt(-0.05) + breath * 0.0055 + beat * 0.0013;
    this.bodyGroup.position.z = breath * 0.0022;
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
      // Counter-clockwise seen from outside the shell.
      idx.push(a, a + 1, b, a + 1, b + 1, b);
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
      if (dir < 0) idx.push(centreIndex, ringStart + j + 1, ringStart + j);
      else idx.push(centreIndex, ringStart + j, ringStart + j + 1);
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
