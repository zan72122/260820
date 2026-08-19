import * as THREE from 'three';
import { materials } from './materials.js';
import { roundedBox, heapGeometry, mesh } from './geo.js';

/* ------------------------------------------------------------------
   The dump truck that runs alongside and catches the snow.
   Local space: forward = +Z.
------------------------------------------------------------------- */

export const BED = {
  floorY: 1.30,
  halfW: 1.05,
  zBack: -3.15,
  zFront: 1.05,
  sideH: 0.92,
};

export class Truck {
  constructor(scene) {
    const M = materials();
    const root = new THREE.Group();
    this.root = root;
    scene.add(root);

    /* ------- wheels ------- */
    const tyre = new THREE.CylinderGeometry(0.62, 0.62, 0.42, 20);
    tyre.rotateZ(Math.PI / 2);
    const rim = new THREE.CylinderGeometry(0.27, 0.27, 0.46, 12);
    rim.rotateZ(Math.PI / 2);
    const lug = new THREE.BoxGeometry(0.46, 0.08, 0.13);
    this.wheels = [];
    const axles = [[2.55, 1], [-1.35, 1], [-2.28, 1]];
    for (const [z, dual] of axles) {
      for (const sx of [-1, 1]) {
        const offs = dual && z < 0 ? [-0.22, 0.22] : [0];
        for (const o of offs) {
          const g = new THREE.Group();
          g.position.set(sx * (1.02 + Math.abs(o)), 0.62, z);
          root.add(g);
          mesh(tyre, M.rubber, g);
          mesh(rim, M.greyPaint, g);
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            mesh(lug, M.rubberDirty, g, [0, Math.cos(a) * 0.6, Math.sin(a) * 0.6], [a, 0, 0]);
          }
          this.wheels.push(g);
        }
      }
    }
    // mud flaps behind the rear bogie
    for (const sx of [-1, 1]) {
      mesh(new THREE.BoxGeometry(0.58, 0.55, 0.04), M.rubberDirty, root, [sx * 1.15, 0.42, -2.95]);
    }

    /* ------- frame ------- */
    mesh(roundedBox(2.1, 0.32, 6.6, 0.05), M.darkPaint, root, [0, 1.02, -0.3]);
    // fuel tank + air tanks
    mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.1, 14), M.chrome, root, [1.18, 0.95, 0.55], [0, 0, Math.PI / 2]);
    mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.8, 12), M.bareSteel, root, [-1.18, 0.95, 0.4], [0, 0, Math.PI / 2]);

    /* ------- cab ------- */
    const cab = new THREE.Group();
    cab.position.set(0, 1.2, 2.55);
    root.add(cab);
    mesh(roundedBox(2.24, 1.5, 2.0, 0.14), M.bluePaint, cab, [0, 0.8, 0]);
    // windscreen + side glass
    mesh(new THREE.PlaneGeometry(1.86, 0.86), M.glass, cab, [0, 1.12, 1.02]);
    for (const sx of [-1, 1]) {
      mesh(new THREE.PlaneGeometry(1.3, 0.78), M.glass, cab, [sx * 1.13, 1.06, 0.15], [0, sx * Math.PI / 2, 0]);
      // mirror
      mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 6), M.bareSteel, cab, [sx * 1.3, 1.5, 0.8]);
      mesh(roundedBox(0.1, 0.3, 0.05, 0.02), M.darkPaint, cab, [sx * 1.38, 1.62, 0.8]);
    }
    // bumper, grille, lights
    mesh(roundedBox(2.3, 0.34, 0.22, 0.06), M.chrome, cab, [0, 0.2, 1.06]);
    mesh(roundedBox(1.5, 0.5, 0.1, 0.04), M.darkPaint, cab, [0, 0.66, 1.03]);
    for (const sx of [-1, 1]) {
      mesh(roundedBox(0.34, 0.22, 0.1, 0.04), M.darkPaint, cab, [sx * 0.86, 0.62, 1.02]);
      mesh(new THREE.PlaneGeometry(0.28, 0.16), M.lampWhite, cab, [sx * 0.86, 0.62, 1.08]);
    }
    // exhaust stack
    mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.9, 10), M.chrome, root, [-1.12, 1.9, 1.55]);
    this.exhaustPort = new THREE.Object3D();
    this.exhaustPort.position.set(-1.12, 2.9, 1.55);
    root.add(this.exhaustPort);
    // amber roof beacon
    const beacon = new THREE.Group();
    beacon.position.set(0, 2.3, 2.2);
    root.add(beacon);
    mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.16, 10), M.lampAmber, beacon);
    this.beacon = beacon;
    this.beaconLight = new THREE.PointLight(0xffa020, 0, 7, 2);
    beacon.add(this.beaconLight);

    /* ------- tipping bed ------- */
    const bed = new THREE.Group();
    bed.position.set(0, BED.floorY - 0.12, BED.zBack);   // pivot at the rear sill
    root.add(bed);
    this.bed = bed;

    const L = BED.zFront - BED.zBack;
    const cz = L / 2;
    mesh(roundedBox(2.24, 0.16, L, 0.04), M.yellowPaint, bed, [0, 0.08, cz]);      // floor
    for (const sx of [-1, 1]) {                                                     // sides
      mesh(roundedBox(0.12, BED.sideH, L, 0.04), M.yellowPaint, bed, [sx * (BED.halfW + 0.06), 0.1 + BED.sideH / 2, cz]);
      // ribs
      for (let i = 0; i < 4; i++) {
        mesh(roundedBox(0.06, BED.sideH * 0.9, 0.12, 0.02), M.yellowPaint, bed,
          [sx * (BED.halfW + 0.14), 0.14 + BED.sideH / 2, 0.55 + i * 1.05]);
      }
    }
    // headboard
    mesh(roundedBox(2.24, BED.sideH + 0.45, 0.12, 0.04), M.yellowPaint, bed, [0, 0.1 + (BED.sideH + 0.45) / 2, L + 0.03]);
    // tailgate (swings open as the bed tips)
    const gate = new THREE.Group();
    gate.position.set(0, 0.1 + BED.sideH, 0.0);
    bed.add(gate);
    this.gate = gate;
    mesh(roundedBox(2.24, BED.sideH, 0.1, 0.04), M.yellowPaint, gate, [0, -BED.sideH / 2, 0]);
    mesh(roundedBox(2.3, 0.1, 0.14, 0.03), M.darkPaint, gate, [0, -0.02, 0]);

    // hoist ram under the bed
    const hoist = new THREE.Group();
    hoist.position.set(0, 0.1, 1.2);
    root.add(hoist);
    this.hoist = hoist;
    this.hoistBarrel = mesh(new THREE.CylinderGeometry(0.16, 0.18, 1.0, 12), M.greyPaint, hoist, [0, 0.55, 0]);
    this.hoistRod = mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 10), M.chrome, hoist, [0, 1.2, 0]);

    /* ------- snow load in the bed ------- */
    const heapGeo = heapGeometry(BED.halfW * 0.98, (L / 2) * 0.96, 1.0, 26, 5);
    this.heap = new THREE.Mesh(heapGeo, materials().snowPile);
    this.heap.castShadow = true;
    this.heap.receiveShadow = true;
    this.heap.position.set(0, 0.16, cz);
    this.heap.scale.set(1, 0.001, 1);
    this.heap.visible = false;
    bed.add(this.heap);

    // loose lumps that sit on top of the load for texture
    const lumpGeo = new THREE.IcosahedronGeometry(0.19, 0);
    this.lumps = new THREE.InstancedMesh(lumpGeo, materials().snowChunk, 48);
    this.lumps.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.lumps.castShadow = true;
    this.lumps.count = 0;
    bed.add(this.lumps);
    this._lumpData = [];
    this._m4 = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();

    // aim helper: the sweet spot snow should land in
    this.aimPoint = new THREE.Object3D();
    this.aimPoint.position.set(0, BED.floorY + 0.7, (BED.zBack + BED.zFront) / 2);
    root.add(this.aimPoint);

    /* ------- state ------- */
    this.fill = 0;
    this.tilt = 0;          // 0 = level, 1 = fully tipped
    this.speed = 0;
    this._t = 0;
    this.cz = cz;
    this.L = L;
  }

  get position() { return this.root.position; }

  aimWorld(out) {
    this.aimPoint.position.y = BED.floorY + 0.45 + this.fill * 0.55;
    return this.aimPoint.getWorldPosition(out);
  }

  exhaustWorld(out) { return this.exhaustPort.getWorldPosition(out); }

  /** local-space test: has a world point dropped into the bed? */
  isInBed(worldPoint, tmp) {
    tmp.copy(worldPoint);
    this.root.worldToLocal(tmp);
    if (tmp.x < -BED.halfW - 0.5 || tmp.x > BED.halfW + 0.5) return false;
    if (tmp.z < BED.zBack - 0.4 || tmp.z > BED.zFront + 0.4) return false;
    const top = BED.floorY + 0.25 + this.fill * 1.05;
    return tmp.y <= top && tmp.y > BED.floorY - 0.6;
  }

  addSnow(amount, worldPoint, tmp) {
    this.fill = Math.min(1, this.fill + amount);
    // remember a few lumps where the snow actually hit
    if (this._lumpData.length < 48 && Math.random() < 0.5 && worldPoint) {
      tmp.copy(worldPoint);
      this.bed.worldToLocal(tmp);
      const clampX = Math.max(-BED.halfW * 0.8, Math.min(BED.halfW * 0.8, tmp.x));
      const clampZ = Math.max(0.3, Math.min(this.L - 0.3, tmp.z));
      this._lumpData.push({
        x: clampX, z: clampZ,
        s: 0.6 + Math.random() * 0.8,
        rx: Math.random() * 3, ry: Math.random() * 3, rz: Math.random() * 3,
        atFill: this.fill,
      });
    }
  }

  reset() {
    this.fill = 0;
    this._lumpData.length = 0;
    this.lumps.count = 0;
    this.heap.visible = false;
  }

  update(dt, opts = {}) {
    const { speed = 0, running = true } = opts;
    this._t += dt;
    this.speed = speed;
    const roll = (speed * dt) / 0.62;
    for (const w of this.wheels) w.rotation.x += roll;

    this.beacon.rotation.y += dt * 5.5;
    this.beaconLight.intensity = running ? 2 + (Math.sin(this._t * 5.5) * 0.5 + 0.5) * 5 : 0;

    // suspension jiggle scaled by how loaded it is
    const bob = Math.sin(this._t * 9) * 0.004 * (0.5 + speed * 0.1);
    this.root.position.y = bob - this.fill * 0.05;
    this.root.rotation.z = Math.sin(this._t * 4.2) * 0.003;

    // bed tilt: the nose of the bed lifts, the load slides out over the tail
    this.bed.rotation.x = -this.tilt * 0.85;
    this.gate.rotation.x = Math.min(1, this.tilt * 2.2) * 1.5;
    this.hoist.rotation.x = -this.tilt * 0.42;
    this.hoistRod.position.y = 1.2 + this.tilt * 1.5;
    this.hoistRod.scale.y = 1 + this.tilt * 1.6;

    // snow load visual
    const f = this.fill;
    this.heap.visible = f > 0.005;
    if (this.heap.visible) {
      const h = 0.12 + f * 1.05;
      this.heap.scale.set(0.72 + f * 0.28, h, 0.66 + f * 0.34);
      // as the bed tips the load slumps back toward the tailgate
      this.heap.position.set(0, 0.16, this.cz - (1 - f) * 0.25 - this.tilt * this.L * 0.32);
    }
    // reveal lumps as the load grows
    let n = 0;
    for (const d of this._lumpData) {
      if (d.atFill > this.fill + 0.02) continue;
      const y = 0.16 + (0.12 + this.fill * 1.0) *
        Math.max(0.15, 1 - (Math.abs(d.x) / BED.halfW) ** 2 * 0.7) * 0.92;
      this._v.set(d.x, y, d.z);
      this._q.setFromEuler(new THREE.Euler(d.rx, d.ry, d.rz));
      this._s.setScalar(d.s);
      this._m4.compose(this._v, this._q, this._s);
      this.lumps.setMatrixAt(n, this._m4);
      n++;
    }
    this.lumps.count = n;
    this.lumps.instanceMatrix.needsUpdate = true;
  }
}
