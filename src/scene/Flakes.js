// Shaved-ice flakes.
//
// A fixed pool of instanced shards -- nothing is allocated or destroyed while the
// handle turns. Each shard carries a share of the volume the blade removed and
// hands it to the mound when it lands; whatever the pool can't carry is added to
// the pile as fine spray, so the heap always matches what the blade cut.

import {
  InstancedMesh, BufferGeometry, BufferAttribute, MeshStandardMaterial,
  Object3D, Color, DoubleSide, DynamicDrawUsage, Vector3,
} from 'three';
import { mulberry32 } from '../util/rand.js';

function shardGeometry() {
  // a curled sliver, 1 unit long, with a fold down the middle so it flashes
  const pos = [], nrm = [], idx = [];
  const cols = 5;
  for (let i = 0; i <= cols; i++) {
    const t = i / cols;
    const curl = Math.sin(t * Math.PI) * 0.22;
    const w = 0.34 * (0.55 + 0.75 * Math.sin(t * Math.PI));
    pos.push(-0.5 + t, curl * 0.6, -w);
    pos.push(-0.5 + t, curl, 0.0);
    pos.push(-0.5 + t, curl * 0.6, w);
    for (let k = 0; k < 3; k++) nrm.push(0, 1, 0);
  }
  for (let i = 0; i < cols; i++) {
    const a = i * 3, b = (i + 1) * 3;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
    idx.push(a + 1, b + 1, a + 2, b + 1, b + 2, a + 2);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nrm), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class Flakes {
  constructor(scene, { count, mound, quality }) {
    this.count = count;
    this.mound = mound;
    this.rnd = mulberry32(20260820);

    const mat = new MeshStandardMaterial({
      color: new Color(0.97, 0.985, 1.0),
      roughness: 0.34, metalness: 0.0, side: DoubleSide,
      envMapIntensity: 1.1, flatShading: true,
    });
    this.material = mat;

    this.mesh = new InstancedMesh(shardGeometry(), mat, count);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = quality.flakeShadows;
    this.mesh.receiveShadow = false;
    scene.add(this.mesh);

    this.px = new Float32Array(count); this.py = new Float32Array(count); this.pz = new Float32Array(count);
    this.vx = new Float32Array(count); this.vy = new Float32Array(count); this.vz = new Float32Array(count);
    this.rx = new Float32Array(count); this.ry = new Float32Array(count); this.rz = new Float32Array(count);
    this.wx = new Float32Array(count); this.wy = new Float32Array(count); this.wz = new Float32Array(count);
    this.sx = new Float32Array(count); this.sz = new Float32Array(count);
    this.vol = new Float32Array(count);
    this.age = new Float32Array(count);
    this.alive = new Uint8Array(count);
    this.free = [];
    for (let i = count - 1; i >= 0; i--) this.free.push(i);

    this._o = new Object3D();
    this.live = 0;
    this.landedThisFrame = 0;
    this.hide();
  }

  hide() {
    const o = this._o;
    o.position.set(0, -10, 0); o.scale.set(0.0001, 0.0001, 0.0001);
    o.updateMatrix();
    for (let i = 0; i < this.count; i++) this.mesh.setMatrixAt(i, o.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  reset() {
    this.free.length = 0;
    for (let i = this.count - 1; i >= 0; i--) { this.free.push(i); this.alive[i] = 0; }
    this.live = 0;
    this.hide();
  }

  /**
   * @param x,z  where on the blade line this shaving came off
   * @param len  flake length in metres (slow crank = long soft ribbons)
   * @param vol  cubic metres of ice this shard represents
   * @param push forward ejection speed, scales with crank speed
   */
  spawn(x, z, len, vol, push) {
    const i = this.free.pop();
    if (i === undefined) return false;
    const r = this.rnd;
    this.px[i] = x + (r() - 0.5) * 0.006;
    this.py[i] = 0.1880 - r() * 0.002;
    this.pz[i] = z + (r() - 0.5) * 0.010;
    this.vx[i] = (r() - 0.5) * push * 0.7;
    this.vy[i] = -0.02 - r() * 0.05;
    this.vz[i] = push * (0.25 + r() * 0.9) + (r() - 0.5) * 0.05;
    this.wx[i] = (r() - 0.5) * 14; this.wy[i] = (r() - 0.5) * 14; this.wz[i] = (r() - 0.5) * 14;
    this.rx[i] = r() * 6.28; this.ry[i] = r() * 6.28; this.rz[i] = r() * 6.28;
    this.sx[i] = len * (0.75 + r() * 0.5);
    this.sz[i] = len * (0.55 + r() * 0.5);
    this.vol[i] = vol;
    this.age[i] = 0;
    this.alive[i] = 1;
    this.live++;
    return true;
  }

  update(dt) {
    const o = this._o;
    const g = 3.15;          // shaved ice is light; it drifts down, it does not drop
    const drag = 2.1;
    this.landedThisFrame = 0;
    for (let i = 0; i < this.count; i++) {
      if (!this.alive[i]) continue;
      this.age[i] += dt;
      const k = Math.max(0, 1 - drag * dt);
      this.vx[i] *= k; this.vz[i] *= k;
      this.vy[i] = (this.vy[i] - g * dt) * k;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;
      this.rx[i] += this.wx[i] * dt; this.ry[i] += this.wy[i] * dt; this.rz[i] += this.wz[i] * dt;

      const ground = this.mound.surfaceY(this.px[i], this.pz[i]);
      if (this.py[i] <= ground || this.age[i] > 2.2) {
        this.mound.deposit(this.px[i], this.pz[i], this.vol[i]);
        this.alive[i] = 0;
        this.free.push(i);
        this.live--;
        this.landedThisFrame++;
        o.position.set(0, -10, 0); o.scale.set(0.0001, 0.0001, 0.0001);
        o.rotation.set(0, 0, 0);
        o.updateMatrix();
        this.mesh.setMatrixAt(i, o.matrix);
        continue;
      }
      o.position.set(this.px[i], this.py[i], this.pz[i]);
      o.rotation.set(this.rx[i], this.ry[i], this.rz[i]);
      o.scale.set(this.sx[i], this.sx[i] * 0.55, this.sz[i]);
      o.updateMatrix();
      this.mesh.setMatrixAt(i, o.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  setEnvMap(env) { this.material.envMap = env; this.material.needsUpdate = true; }
}
