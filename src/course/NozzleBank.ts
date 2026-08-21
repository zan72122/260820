import * as THREE from 'three';
import { BlastZone } from './BlastZone';
import { CourseSpline } from './CourseSpline';
import { galvanisedMaps } from '../world/Textures';
import { clamp, smoothstep } from '../core/Rng';

/** Two nozzles per station, set either side of the centre line so a raft
 *  never rides over the bores. */
const LATERAL = 0.62;

export interface NozzleInstance {
  /** Index into BlastZone.nozzles. */
  station: number;
  side: number;
  position: THREE.Vector3;
  direction: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

/**
 * The physical bank: thick stainless bodies bolted into the moulding, with
 * water visibly standing in the bore before the jet leaves it.
 */
export class NozzleBank {
  readonly group = new THREE.Group();
  readonly instances: NozzleInstance[] = [];
  private readonly bodies: THREE.InstancedMesh;
  private readonly bolts: THREE.InstancedMesh;
  private readonly fills: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly fillColor = new THREE.Color();

  constructor(spline: CourseSpline, private readonly blast: BlastZone) {
    const up = new THREE.Vector3(0, 1, 0);
    for (const n of blast.nozzles) {
      for (const side of [-1, 1]) {
        const frame = spline.frameAt(n.s);
        const position = frame.position
          .clone()
          .addScaledVector(frame.side, side * LATERAL)
          .addScaledVector(frame.up, 0.02);
        // Bores lean up-slope and a few degrees inboard, at the raft's tail.
        const direction = n.direction
          .clone()
          .addScaledVector(frame.side, -side * 0.12)
          .normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
        this.instances.push({ station: n.index, side, position, direction, quaternion });
      }
    }

    const count = this.instances.length;
    const steel = galvanisedMaps();

    // Thick-walled body: sunk flange, tapered barrel, real bore.
    const bodyProfile: THREE.Vector2[] = [
      new THREE.Vector2(0.0, -0.01),
      new THREE.Vector2(0.2, -0.01),
      new THREE.Vector2(0.2, 0.03),
      new THREE.Vector2(0.155, 0.048),
      new THREE.Vector2(0.138, 0.082),
      new THREE.Vector2(0.124, 0.134),
      new THREE.Vector2(0.112, 0.184),
      new THREE.Vector2(0.099, 0.212),
      new THREE.Vector2(0.085, 0.209),
      new THREE.Vector2(0.08, 0.15),
      new THREE.Vector2(0.076, 0.08),
      new THREE.Vector2(0.074, 0.0),
    ];
    const bodyGeo = new THREE.LatheGeometry(bodyProfile, 18);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xd2d7da,
      metalness: 0.7,
      roughness: 0.26,
      map: steel.map,
      roughnessMap: steel.roughnessMap,
      normalMap: steel.normalMap,
      envMapIntensity: 1.1,
    });
    bodyMat.normalScale.set(0.5, 0.5);
    this.bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
    this.bodies.castShadow = true;
    this.bodies.receiveShadow = true;
    this.group.add(this.bodies);

    // Four fixings per nozzle, sunk into the FRP.
    const boltGeo = new THREE.CylinderGeometry(0.025, 0.027, 0.024, 6);
    const boltMat = new THREE.MeshStandardMaterial({
      color: 0xb4b9bd,
      metalness: 0.72,
      roughness: 0.34,
      map: steel.map,
      normalMap: steel.normalMap,
    });
    this.bolts = new THREE.InstancedMesh(boltGeo, boltMat, count * 4);
    this.group.add(this.bolts);

    // The water column standing inside the bore before it leaves.
    const fillGeo = new THREE.CylinderGeometry(0.07, 0.066, 0.2, 12, 1, true);
    fillGeo.translate(0, 0.1, 0);
    const fillMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.06,
      metalness: 0,
      transparent: true,
      opacity: 0.95,
      envMapIntensity: 1.6,
    });
    this.fills = new THREE.InstancedMesh(fillGeo, fillMat, count);
    this.fills.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    this.group.add(this.fills);

    for (let i = 0; i < count; i++) {
      const inst = this.instances[i];
      this.dummy.position.copy(inst.position);
      this.dummy.quaternion.copy(inst.quaternion);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.bodies.setMatrixAt(i, this.dummy.matrix);

      for (let b = 0; b < 4; b++) {
        const ang = (b / 4) * Math.PI * 2 + Math.PI / 4;
        const local = new THREE.Vector3(Math.cos(ang) * 0.163, 0.018, Math.sin(ang) * 0.163);
        local.applyQuaternion(inst.quaternion);
        this.dummy.position.copy(inst.position).add(local);
        this.dummy.quaternion.copy(inst.quaternion);
        this.dummy.updateMatrix();
        this.bolts.setMatrixAt(i * 4 + b, this.dummy.matrix);
      }
    }
    this.bodies.instanceMatrix.needsUpdate = true;
    this.bolts.instanceMatrix.needsUpdate = true;
  }

  /** One quiet pulse of water in every live bore - the only hint the game
   *  gives before a child has found the lever. */
  pulse(strength: number): void {
    this.pulseAmount = strength;
    this.pulseTime = 0;
  }

  private pulseAmount = 0;
  private pulseTime = 0;

  update(dt: number): void {
    if (this.pulseAmount > 0) {
      this.pulseTime += dt;
      if (this.pulseTime > 1.5) this.pulseAmount = 0;
    }
    const pulse =
      this.pulseAmount > 0
        ? this.pulseAmount * Math.sin(clamp(this.pulseTime / 1.5, 0, 1) * Math.PI) ** 2
        : 0;

    for (let i = 0; i < this.instances.length; i++) {
      const inst = this.instances[i];
      const n = this.blast.nozzles[inst.station];
      const fill = clamp(n.fill + (n.supplied ? pulse * 0.55 : 0), 0, 1);
      const h = 0.06 + fill * 0.94;
      this.dummy.position.copy(inst.position);
      this.dummy.quaternion.copy(inst.quaternion);
      this.dummy.scale.set(1, h, 1);
      this.dummy.updateMatrix();
      this.fills.setMatrixAt(i, this.dummy.matrix);
      // Bore goes from dark standing water to bright aerated white.
      const white = smoothstep(0.15, 1.0, fill);
      this.fillColor.setRGB(0.52 + white * 0.48, 0.68 + white * 0.32, 0.76 + white * 0.24);
      this.fills.setColorAt(i, this.fillColor);
    }
    this.fills.instanceMatrix.needsUpdate = true;
    if (this.fills.instanceColor) this.fills.instanceColor.needsUpdate = true;
  }
}
