import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MaterialKit } from './materials';
import { BEAM_W, BEAM_TOP_Y, PathSampler } from '../game/switchModel';

/**
 * Two-car straddle-type monorail trainset (fictional livery). Bogies wrap the
 * beam: running tires on top, guide tires on the upper webs, stabilising
 * tires on the lower webs — the confirmed straddle wheel arrangement.
 * Each car is merged into a handful of meshes (one per material).
 */

const CAR_LEN = 13.9;
const CAR_W = 2.9;
const CAR_H = 2.95;
const BOGIE_OFF = 4.4;
const FLOOR_LIFT = 0.42;

export class Train {
  readonly group = new THREE.Group();
  private cars: THREE.Group[] = [];
  s = 0;
  speed = 0;
  sampler: PathSampler | null = null;
  dir: 1 | -1 = -1;

  constructor(mats: MaterialKit) {
    for (let c = 0; c < 2; c++) {
      const car = buildCar(mats, c === 0);
      this.cars.push(car);
      this.group.add(car);
    }
  }

  place(sampler: PathSampler, s: number, dir: 1 | -1): void {
    this.sampler = sampler;
    this.s = s;
    this.dir = dir;
    this.speed = 0;
    this.updatePose();
    this.group.visible = true;
  }

  hide(): void { this.group.visible = false; }

  advance(dist: number): void {
    this.s += dist * this.dir;
    this.updatePose();
  }

  private updatePose(): void {
    if (!this.sampler) return;
    const sm = this.sampler;
    for (let c = 0; c < this.cars.length; c++) {
      const centre = this.s - this.dir * (CAR_LEN / 2 + 0.4 + c * (CAR_LEN + 0.65));
      const sA = centre - this.dir * BOGIE_OFF;
      const sB = centre + this.dir * BOGIE_OFF;
      const pA = sm.pos(sA), pB = sm.pos(sB);
      const mid = pA.clone().add(pB).multiplyScalar(0.5);
      const yaw = Math.atan2(pB.x - pA.x, pB.z - pA.z);
      const car = this.cars[c];
      car.position.set(mid.x, BEAM_TOP_Y, mid.z);
      car.rotation.y = this.dir === -1 ? yaw + Math.PI : yaw;
    }
  }

  headPos(out: THREE.Vector3): THREE.Vector3 {
    if (!this.sampler) return out.set(0, 0, 9999);
    const p = this.sampler.pos(this.s);
    return out.set(p.x, BEAM_TOP_Y + 1.2, p.z);
  }
}

function buildCar(m: MaterialKit, head: boolean): THREE.Group {
  const g = new THREE.Group();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const put = (mat: THREE.Material, geo: THREE.BufferGeometry,
    x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    if (rx) geo.rotateX(rx);
    if (ry) geo.rotateY(ry);
    if (rz) geo.rotateZ(rz);
    geo.translate(x, y, z);
    // extrusions are non-indexed; normalise so merging works
    const flat = geo.index ? geo.toNonIndexed() : geo;
    flat.deleteAttribute('uv');
    let arr = buckets.get(mat);
    if (!arr) { arr = []; buckets.set(mat, arr); }
    arr.push(flat);
  };

  // body: rounded-top profile extruded along the car
  const shape = new THREE.Shape();
  const hw = CAR_W / 2, r = 0.55;
  shape.moveTo(-hw, 0);
  shape.lineTo(-hw, CAR_H - r);
  shape.quadraticCurveTo(-hw, CAR_H, -hw + r, CAR_H);
  shape.lineTo(hw - r, CAR_H);
  shape.quadraticCurveTo(hw, CAR_H, hw, CAR_H - r);
  shape.lineTo(hw, 0);
  shape.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: CAR_LEN, bevelEnabled: false });
  put(m.trainBody, bodyGeo, 0, FLOOR_LIFT, -CAR_LEN / 2);

  // livery stripe under the windows
  put(m.trainStripe, new THREE.BoxGeometry(CAR_W + 0.02, 0.34, CAR_LEN - 0.1), 0, FLOOR_LIFT + 1.16, 0);

  // window row (doors get their own inset panels)
  for (let wz = -CAR_LEN / 2 + 1.7; wz < CAR_LEN / 2 - 1.4; wz += 1.55) {
    if (Math.abs(wz + 4.2) < 0.95 || Math.abs(wz - 4.2) < 0.95) continue;
    put(m.glassDark, new THREE.BoxGeometry(CAR_W + 0.015, 0.62, 1.15), 0, FLOOR_LIFT + 1.98, wz + 0.5);
  }
  for (const z of [-4.2, 4.2]) {
    put(m.doorPanel, new THREE.BoxGeometry(CAR_W + 0.02, 1.9, 1.3), 0, FLOOR_LIFT + 1.1, z);
    put(m.glassDark, new THREE.BoxGeometry(CAR_W + 0.03, 0.5, 0.5), 0, FLOOR_LIFT + 1.95, z);
  }

  if (head) {
    put(m.glassDark, new THREE.BoxGeometry(CAR_W - 0.75, 0.72, 0.5), 0, FLOOR_LIFT + 2.0, -CAR_LEN / 2 - 0.08, -0.1);
    put(m.trainBody, new THREE.BoxGeometry(CAR_W - 0.3, 0.16, 0.46), 0, FLOOR_LIFT + 2.44, -CAR_LEN / 2 - 0.08);
    put(m.trainStripe, new THREE.BoxGeometry(CAR_W - 0.2, 0.42, 0.4), 0, FLOOR_LIFT + 0.9, -CAR_LEN / 2 - 0.14);
    put(m.trainBody, new THREE.BoxGeometry(CAR_W - 0.2, 0.62, 0.34), 0, FLOOR_LIFT + 0.38, -CAR_LEN / 2 - 0.1);
    for (const s of [-1, 1]) {
      put(m.headlight, new THREE.CylinderGeometry(0.09, 0.09, 0.06, 10),
        s * 0.9, FLOOR_LIFT + 1.5, -CAR_LEN / 2 - 0.34, Math.PI / 2);
    }
  }

  // roof equipment
  for (const z of [-3.4, 0.6, 3.4]) {
    put(m.roofKit, new THREE.BoxGeometry(1.7, 0.3, 2.4), 0, FLOOR_LIFT + CAR_H + 0.15, z);
  }

  // body skirts wrap down past the beam top, as on real straddle stock
  for (const s of [-1, 1]) {
    put(m.trainBody, new THREE.BoxGeometry(0.09, 0.78, CAR_LEN - 0.06),
      s * (CAR_W / 2 - 0.05), 0.2, 0);
  }

  // bogies wrapping the beam
  for (const bz of [-BOGIE_OFF, BOGIE_OFF]) {
    const by = FLOOR_LIFT - 0.44;
    for (const s of [-1, 1]) {
      put(m.steelDark, new THREE.BoxGeometry(0.16, 1.25, 2.5), s * (BEAM_W / 2 + 0.17), by - 0.45, bz);
      for (const wz of [-0.85, 0.85]) {
        put(m.rubber, new THREE.CylinderGeometry(0.26, 0.26, 0.16, 16), s * (BEAM_W / 2 + 0.085), by - 0.28, bz + wz);
      }
      for (const wz of [-0.6, 0.6]) {
        put(m.rubber, new THREE.CylinderGeometry(0.22, 0.22, 0.14, 14), s * (BEAM_W / 2 + 0.075), by - 1.05, bz + wz);
      }
    }
    for (const wz of [-0.7, 0.7]) {
      put(m.rubber, new THREE.CylinderGeometry(0.44, 0.44, 0.36, 18), 0, by + 0.44, bz + wz, 0, 0, Math.PI / 2);
    }
  }

  for (const [mat, geos] of buckets) {
    const mesh = new THREE.Mesh(mergeGeometries(geos, false), mat);
    mesh.castShadow = true;
    g.add(mesh);
  }
  return g;
}
