// あやしい場所の配置。手前ほど分かりやすく、奥へ行くほど少しだけ探しがいがある。
import * as THREE from 'three';
import { layLeaf } from '../world/litter.js';
import { leafMaterial } from '../world/litter.js';

export const PLAYER_POS = new THREE.Vector3(0, 0, 2.6);

/** 実際にたけのこが埋まっている場所(順番に掘る) */
export const SPOT_LAYOUT = [
  { x: -0.55, z: 0.70, hint: 0 },
  { x: 0.85, z: -0.50, hint: 1 },
  { x: -1.05, z: -1.60, hint: 2 },
  { x: 1.15, z: -2.70, hint: 3 },
  { x: -0.45, z: -3.80, hint: 4 },
];

/** たけのこではないもの。触っても罰は無く、小さな反応だけ返す */
export const DECOY_LAYOUT = [
  { x: 0.75, z: 0.95, kind: 'stone' },
  { x: -1.45, z: -0.35, kind: 'leaf' },
  { x: 0.15, z: -1.85, kind: 'stone' },
  { x: -1.35, z: -2.95, kind: 'leaf' },
  { x: 0.75, z: -4.30, kind: 'leaf' },
];

/** 地面ジオメトリに入れるふくらみ(「なにか埋まってそう」の第一の手がかり) */
export function groundBumps() {
  const bumps = [];
  for (const s of SPOT_LAYOUT) {
    bumps.push({ x: s.x, z: s.z, radius: 0.62, height: 0.055 - s.hint * 0.007 });
  }
  for (const d of DECOY_LAYOUT) {
    bumps.push({ x: d.x, z: d.z, radius: 0.5, height: d.kind === 'stone' ? 0.038 : 0.026 });
  }
  return bumps;
}

/** 場所へ寄るときのカメラの向き(プレイヤー側から) */
export function viewAzimuthFor(x, z) {
  return Math.atan2(PLAYER_POS.z - z, PLAYER_POS.x - x);
}

export class Decoy {
  constructor(rng, { x, z, kind }, surfaceAt, fast = false) {
    this.kind = kind;
    this.rng = rng;
    this.revealed = false;
    this.t = 0;
    this.position = new THREE.Vector3(x, surfaceAt(x, z), z);
    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this.group.name = 'decoy';

    const dummy = new THREE.Object3D();
    const n = fast ? 10 : 34;
    const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), leafMaterial('dry'), n);
    this.leaves = [];
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = Math.sqrt(rng()) * 0.34;
      const lx = Math.cos(a) * r;
      const lz = Math.sin(a) * r;
      const y = surfaceAt(x + lx, z + lz) - this.position.y + 0.014 + rng.range(0, 0.015);
      const s = rng.range(0.09, 0.15);
      const rot = rng.range(0, 6.28);
      this.leaves.push({ x: lx, z: lz, y, s, rot, vy: 0, t: 0, alive: true });
      dummy.position.set(lx, y, lz);
      dummy.rotation.set(-Math.PI / 2 + rng.range(-0.3, 0.3), rot, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.receiveShadow = !fast;
    this.litter = inst;
    this.dummy = dummy;
    this.group.add(inst);

    if (kind === 'stone') {
      const g = new THREE.IcosahedronGeometry(0.11, fast ? 0 : 1);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        p.setXYZ(i, p.getX(i) * rng.range(0.85, 1.2), p.getY(i) * rng.range(0.5, 0.75), p.getZ(i) * rng.range(0.85, 1.2));
      }
      g.computeVertexNormals();
      this.stone = new THREE.Mesh(
        g,
        new THREE.MeshStandardMaterial({ color: 0x827a6c, roughness: 0.92 })
      );
      this.stone.position.y = -0.045;
      this.stone.rotation.set(rng.range(0, 3), rng.range(0, 6), rng.range(0, 3));
      this.stone.castShadow = !fast;
      this.stone.receiveShadow = !fast;
      this.group.add(this.stone);
    }
  }

  /** 触られたときの、ちいさな反応 */
  reveal() {
    if (this.revealed) return;
    this.revealed = true;
    this.t = 0;
    for (const lf of this.leaves) {
      lf.vy = 0.35 + this.rng() * 0.4;
      lf.dx = this.rng.range(-0.5, 0.5);
      lf.dz = this.rng.range(-0.5, 0.5);
      lf.flying = true;
    }
  }

  update(dt) {
    if (!this.revealed) return;
    this.t += dt;
    let dirty = false;
    for (let i = 0; i < this.leaves.length; i++) {
      const lf = this.leaves[i];
      if (!lf.flying) continue;
      lf.t += dt;
      lf.vy -= dt * 1.9;
      lf.y += lf.vy * dt;
      lf.x += lf.dx * dt;
      lf.z += lf.dz * dt;
      const k = Math.max(0, 1 - lf.t / 1.3);
      this.dummy.position.set(lf.x, lf.y, lf.z);
      this.dummy.rotation.set(-Math.PI / 2 + lf.t * 2, lf.rot + lf.t * 2.5, 0);
      this.dummy.scale.setScalar(lf.s * k);
      this.dummy.updateMatrix();
      this.litter.setMatrixAt(i, this.dummy.matrix);
      dirty = true;
      if (k <= 0) lf.flying = false;
    }
    if (dirty) this.litter.instanceMatrix.needsUpdate = true;
    if (this.stone) {
      // 石が少しだけ顔を出す
      const k = Math.min(1, this.t / 0.5);
      this.stone.position.y = -0.045 + k * 0.03;
    }
  }
}

/** 場所の周りに落ち葉を厚く積んで「あやしさ」を作る */
export function scatterAround(rng, target, x, z, count, surfaceAt) {
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = 0.45 + Math.sqrt(rng()) * 0.5;
    layLeaf(dummy, x + Math.cos(a) * r, z + Math.sin(a) * r, rng, 1.1);
    target.push(dummy.matrix.clone());
  }
}
