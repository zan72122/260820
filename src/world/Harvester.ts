import * as THREE from 'three';
import { Materials } from '../gfx/materials';
import { beltLoop, roundedBox, ribbon } from '../gfx/geo';

/**
 * Machine-space layout (metres). +Z is forward, +X is the side the camera works
 * from — that whole flank is deliberately left open so a four-year-old can see
 * the belt grip, the knife and the crate without anything in the way.
 */
export const MACHINE = {
  pivot: new THREE.Vector3(0, 1.17, 0.14),
  convLen: 1.412,
  angleDown: 0.6549,
  angleUp: 0.3549,
  /** distance from the pivot at which the rotary knife crosses the neck */
  cutU: 0.13,
  /** distance from the pivot at which leaves first enter the grip */
  entryU: 1.412,
  /** the crown hangs this far below the belt pinch line */
  hangDrop: 0.145,
  dischargeY: 0.78,
  dischargeZ0: 0.2,
  dischargeZ1: -0.82,
  dischargeSpeed: 0.62,
  crateCentre: new THREE.Vector3(0, 0.18, -1.2),
  trackX: 0.5,
};

function aimSegment(mesh: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, unitLength = 1) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.scale.y = len / unitLength;
}

export class Harvester {
  readonly root = new THREE.Group();
  readonly head = new THREE.Group();

  private trackTex: THREE.Texture[] = [];
  private beltTexL!: THREE.Texture;
  private beltTexR!: THREE.Texture;
  private dischargeTex!: THREE.Texture;
  private blade!: THREE.Mesh;
  private ramRod!: THREE.Mesh;
  private ramFrom = new THREE.Vector3(-0.3, 0.95, -0.16);
  private ramHeadLocal = new THREE.Vector3(-0.2, 0.12, 0.66);
  private beacon!: THREE.Mesh;
  private headT = 0;
  private tmp = new THREE.Vector3();

  constructor(private mats: Materials) {
    this.root.add(this.head);
    this.head.position.copy(MACHINE.pivot);
    this.buildTracks();
    this.buildChassis();
    this.buildHead();
    this.buildDischarge();
    this.buildCrateRack();
    this.buildRam();
    this.setHead(0);
  }

  private mesh(g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  /* ----------------------------------------------------------------- */

  private buildTracks() {
    const loop = beltLoop(1.2, 0.15, 0.19, 12);
    for (const sx of [-1, 1]) {
      const tex = this.mats.rubberSet.map.clone();
      tex.repeat.set(1, 10);
      tex.needsUpdate = true;
      const nrm = this.mats.rubberSet.normalMap!.clone();
      nrm.repeat.set(1, 10);
      nrm.needsUpdate = true;
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        normalMap: nrm,
        normalScale: new THREE.Vector2(1.9, 1.9),
        color: 0xb4b4b4,
        roughness: 0.97,
        metalness: 0,
      });
      this.trackTex.push(tex);
      const belt = this.mesh(loop, mat, this.root, sx * MACHINE.trackX, 0.17, -0.24);

      const wheelG = new THREE.CylinderGeometry(0.098, 0.098, 0.14, 12);
      wheelG.rotateZ(Math.PI / 2);
      for (const dz of [-0.72, -0.34, 0.04, 0.42]) {
        this.mesh(wheelG, this.mats.frameSteel, this.root, sx * MACHINE.trackX, 0.165, -0.24 + dz);
      }
      const sprocket = this.mesh(
        new THREE.CylinderGeometry(0.135, 0.135, 0.17, 10),
        this.mats.bodyPaintDark,
        this.root,
        sx * MACHINE.trackX,
        0.17,
        -0.84,
      );
      sprocket.geometry.rotateZ(Math.PI / 2);
      // track frame beam
      this.mesh(roundedBox(0.1, 0.1, 1.24, 0.02), this.mats.bodyPaintDark, this.root, sx * MACHINE.trackX, 0.17, -0.24);
      void belt;

      // real shadow maps carry the contact; no fake blob needed
    }
  }

  private buildChassis() {
    const R = this.root;
    // deck
    this.mesh(roundedBox(1.06, 0.14, 1.66, 0.025), this.mats.bodyPaintDark, R, 0, 0.42, -0.22);
    this.mesh(roundedBox(1.02, 0.11, 0.52, 0.02), this.mats.bodyPaint, R, 0, 0.54, 0.3);

    // engine bay: a solid painted mass, entirely on the far side
    this.mesh(roundedBox(0.46, 0.56, 0.92, 0.06), this.mats.bodyPaint, R, -0.29, 0.77, -0.06);
    this.mesh(roundedBox(0.44, 0.1, 0.9, 0.03), this.mats.bodyPaintDark, R, -0.29, 1.07, -0.06);
    for (let i = 0; i < 7; i++) {
      this.mesh(roundedBox(0.014, 0.034, 0.5, 0.004), this.mats.bodyPaintDark, R, -0.522, 0.6 + i * 0.05, -0.06);
    }
    // hydraulic tank behind the engine
    this.mesh(roundedBox(0.34, 0.26, 0.34, 0.05), this.mats.bodyPaintDark, R, -0.3, 0.68, -0.72);
    // low skirt on the working side: gives the machine a flank without hiding the belt
    this.mesh(roundedBox(0.03, 0.2, 1.0, 0.014), this.mats.bodyPaint, R, 0.46, 0.6, -0.05);
    const pipe = this.mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.4, 10), this.mats.frameSteel, R, -0.46, 1.06, 0.2);
    pipe.rotation.z = 0.07;
    this.mesh(new THREE.CylinderGeometry(0.036, 0.028, 0.06, 10), this.mats.frameSteel, R, -0.46, 1.28, 0.2);

    // mast carrying the head pivot: one solid post on the far side, one slim on the near
    const postF = this.mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.78, 10), this.mats.bodyPaintDark, R, -0.3, 0.79, 0.14);
    postF.rotation.x = -0.03;
    const postN = this.mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.78, 8), this.mats.frameSteel, R, 0.3, 0.79, 0.14);
    postN.rotation.x = -0.03;
    const cross = this.mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.66, 8), this.mats.frameSteel, R, 0, 1.17, 0.14);
    cross.rotation.z = Math.PI / 2;

    // low kick rail on the working side: below every sightline that matters
    const rail = this.mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.06, 8), this.mats.frameSteel, R, 0.53, 0.78, -0.1);
    rail.rotation.x = Math.PI / 2;
    for (const dz of [0.38, -0.58]) {
      this.mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.24, 6), this.mats.frameSteel, R, 0.53, 0.68, dz);
    }

    // handlebars: human scale without modelling an operator
    for (const sx of [-1, 1]) {
      const bar = this.mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.78, 8), this.mats.frameSteel, R, sx * 0.22, 0.84, -1.0);
      bar.rotation.x = 0.66;
      const grip = this.mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.14, 8), this.mats.rubber, R, sx * 0.22, 1.06, -1.24);
      grip.rotation.x = 0.66;
    }

    this.beacon = this.mesh(
      new THREE.CylinderGeometry(0.033, 0.04, 0.07, 10),
      new THREE.MeshStandardMaterial({ color: 0xff9a2e, emissive: 0xff7a10, emissiveIntensity: 1.5, roughness: 0.35 }),
      R,
      -0.3,
      1.15,
      -0.22,
    );
  }

  private buildHead() {
    const L = MACHINE.convLen;
    const H = this.head;

    // solid side plate + top cowl on the far side only
    this.mesh(roundedBox(0.026, 0.36, L * 0.94, 0.02), this.mats.bodyPaint, H, -0.21, 0.02, L * 0.5);
    this.mesh(roundedBox(0.034, 0.11, L * 0.98, 0.014), this.mats.bodyPaintDark, H, -0.21, 0.21, L * 0.5);
    this.mesh(roundedBox(0.24, 0.05, L * 0.8, 0.016), this.mats.bodyPaint, H, -0.11, 0.2, L * 0.46);
    // furrow skid on the far side only: the working side stays completely clear
    const skid = this.mesh(roundedBox(0.05, 0.05, 0.3, 0.02), this.mats.bodyPaint, H, -0.33, -0.27, L - 0.04);
    skid.rotation.x = -0.3;

    // near side: a single top rail and its ties, all above the pinch line
    const rail = this.mesh(new THREE.CylinderGeometry(0.017, 0.017, L * 0.9, 8), this.mats.frameSteel, H, 0.25, 0.19, L * 0.5);
    rail.rotation.x = Math.PI / 2;
    for (const dz of [0.42, 1.3]) {
      const tie = this.mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.46, 6), this.mats.frameSteel, H, 0.03, 0.19, dz);
      tie.rotation.z = Math.PI / 2;
    }

    // the two gripping belts: horizontal loops with vertical faces, pinching at x = 0
    const gap = 0.03;
    const pulleyR = 0.052;
    const straight = L - 0.32;
    const midZ = L * 0.5 + 0.05;
    for (const sx of [-1, 1]) {
      const g = beltLoop(straight, pulleyR, 0.11, 10);
      g.rotateZ(Math.PI / 2); // loop lies in XZ, swept along Y
      const tex = this.mats.rubberSet.map.clone();
      tex.repeat.set(1, 8);
      tex.needsUpdate = true;
      const nrm = this.mats.rubberSet.normalMap!.clone();
      nrm.repeat.set(1, 8);
      nrm.needsUpdate = true;
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        normalMap: nrm,
        normalScale: new THREE.Vector2(1.5, 1.5),
        color: 0xbdbdbd,
        roughness: 0.95,
        metalness: 0,
        side: THREE.DoubleSide,
      });
      if (sx < 0) this.beltTexL = tex;
      else this.beltTexR = tex;
      this.mesh(g, mat, H, sx * (pulleyR + gap * 0.5), 0, midZ);

      for (const dz of [-straight / 2, straight / 2]) {
        this.mesh(
          new THREE.CylinderGeometry(pulleyR * 0.84, pulleyR * 0.84, 0.125, 12),
          this.mats.frameSteel,
          H,
          sx * (pulleyR + gap * 0.5),
          0,
          midZ + dz,
        );
      }
      // intake fingers funnel the tops into the mouth; the near pair sits low
      // on the working side the funnel finger sits above the pinch line so it
      // never crosses the plant the camera is watching
      const near = sx > 0;
      for (const dy of near ? [0.085] : [-0.05, 0.05]) {
        const finger = this.mesh(
          new THREE.CylinderGeometry(0.0085, 0.0085, 0.4, 6),
          this.mats.frameSteel,
          H,
          sx * 0.155,
          dy,
          L + 0.02,
        );
        finger.rotation.x = Math.PI / 2;
        finger.rotation.z = sx * 0.46;
      }
    }

    // lifting shares work the ridge just ahead of the grip: the reason it lets go
    for (const sx of [-1, 1]) {
      const share = this.mesh(roundedBox(0.011, 0.18, 0.34, 0.007), this.mats.share, H, sx * 0.2, -0.52, L - 0.28);
      share.rotation.x = -0.3;
      share.rotation.z = sx * 0.2;
      const shank = this.mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.44, 6), this.mats.share, H, sx * 0.2, -0.3, L - 0.36);
      shank.rotation.x = 0.12;
    }
    // ridge gauge wheels ride the furrow, set wide so they never cross the plant
    for (const sx of [-1, 1]) {
      const w = this.mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.042, 12), this.mats.tyre, H, sx * 0.46, -0.32, L - 0.62);
      w.rotation.z = Math.PI / 2;
      this.mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.26, 6), this.mats.frameSteel, H, sx * 0.46, -0.2, L - 0.62);
    }

    // rotary knife just below the pinch line
    this.blade = this.mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.005, 26), this.mats.blade, H, -0.135, -0.055, MACHINE.cutU);
    const teeth = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.0075, 5, 30), this.mats.blade);
    teeth.rotation.x = Math.PI / 2;
    teeth.position.copy(this.blade.position);
    H.add(teeth);
    this.mesh(new THREE.CylinderGeometry(0.028, 0.033, 0.11, 10), this.mats.frameSteel, H, -0.135, 0.005, MACHINE.cutU);
    const guard = this.mesh(roundedBox(0.22, 0.1, 0.07, 0.02), this.mats.bodyPaint, H, -0.2, -0.055, MACHINE.cutU + 0.1);
    guard.rotation.y = 0.5;

    // apron that turns the falling root back toward the discharge belt
    const pts: THREE.Vector3[] = [];
    const sides: THREE.Vector3[] = [];
    const hw: number[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push(new THREE.Vector3(0, -0.19 - t * 0.16, MACHINE.cutU - 0.06 - t * 0.3 - t * t * 0.1));
      sides.push(new THREE.Vector3(1, 0, 0));
      hw.push(0.13 + t * 0.04);
    }
    const apronMat = this.mats.bodyPaintDark.clone();
    apronMat.side = THREE.DoubleSide;
    this.mesh(ribbon({ points: pts, halfWidths: hw, sides, widthSegs: 2 }), apronMat, H, 0, 0, 0);
  }

  private buildDischarge() {
    const len = MACHINE.dischargeZ0 - MACHINE.dischargeZ1;
    const midZ = (MACHINE.dischargeZ0 + MACHINE.dischargeZ1) * 0.5;
    const g = beltLoop(len - 0.14, 0.07, 0.3, 8);
    const tex = this.mats.rubberSet.map.clone();
    tex.repeat.set(1, 7);
    tex.needsUpdate = true;
    const nrm = this.mats.rubberSet.normalMap!.clone();
    nrm.repeat.set(1, 7);
    nrm.needsUpdate = true;
    this.dischargeTex = tex;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      normalMap: nrm,
      normalScale: new THREE.Vector2(1.3, 1.3),
      color: 0xb8b8b8,
      roughness: 0.95,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    this.mesh(g, mat, this.root, 0, MACHINE.dischargeY - 0.07, midZ);

    // tall guide on the far side, a low lip on the working side so the roots
    // stay visible all the way along the belt
    this.mesh(roundedBox(0.014, 0.11, len - 0.02, 0.008), this.mats.bodyPaint, this.root, -0.16, MACHINE.dischargeY + 0.035, midZ);
    this.mesh(roundedBox(0.014, 0.045, len - 0.02, 0.006), this.mats.bodyPaint, this.root, 0.16, MACHINE.dischargeY + 0.002, midZ);
    for (const dz of [MACHINE.dischargeZ0 - 0.07, MACHINE.dischargeZ1 + 0.07]) {
      const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.32, 12), this.mats.frameSteel);
      roller.geometry.rotateZ(Math.PI / 2);
      roller.position.set(0, MACHINE.dischargeY - 0.07, dz);
      roller.castShadow = true;
      this.root.add(roller);
    }
    // legs down to the deck
    for (const dz of [0.1, -0.7]) {
      const leg = this.mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), this.mats.frameSteel, this.root, -0.14, 0.6, dz);
      leg.rotation.z = 0.18;
      const leg2 = this.mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 6), this.mats.frameSteel, this.root, 0.14, 0.6, dz);
      leg2.rotation.z = -0.18;
    }
  }

  private buildCrateRack() {
    const c = MACHINE.crateCentre;
    this.mesh(roundedBox(0.62, 0.05, 0.8, 0.012), this.mats.bodyPaintDark, this.root, 0, c.y - 0.03, c.z);
    // support arms sit outside the crate so nothing crosses the reveal shot
    for (const sx of [-1, 1]) {
      const arm = this.mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.72, 8), this.mats.frameSteel, this.root, sx * 0.36, 0.3, c.z + 0.32);
      arm.rotation.x = 1.0;
      this.mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 6), this.mats.frameSteel, this.root, sx * 0.36, c.y - 0.12, c.z - 0.28);
    }
    // low stop bar keeps the crate on its rack without cutting across it
    const bar = this.mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.72, 6), this.mats.frameSteel, this.root, 0, c.y + 0.05, c.z - 0.42);
    bar.rotation.z = Math.PI / 2;
  }

  private buildRam() {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.3, 10), this.mats.bodyPaintDark);
    barrel.castShadow = true;
    this.root.add(barrel);
    aimSegment(barrel, this.ramFrom, new THREE.Vector3(-0.24, 0.74, 0.48), 0.3);
    this.ramRod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 8), this.mats.frameSteel);
    this.ramRod.castShadow = true;
    this.root.add(this.ramRod);
  }

  /* ----------------------------------------------------------------- */

  /** t: 0 = head lifted clear of the crop, 1 = head working in the ridge. */
  setHead(t: number) {
    this.headT = t;
    this.head.rotation.x = THREE.MathUtils.lerp(MACHINE.angleUp, MACHINE.angleDown, t);
    this.head.updateMatrixWorld(true);
    const to = this.head.localToWorld(this.ramHeadLocal.clone());
    this.root.worldToLocal(to);
    aimSegment(this.ramRod, this.ramFrom, to, 1);
  }

  get headDown(): number {
    return this.headT;
  }

  /** World-space point on the belt pinch line, `u` metres from the pivot. */
  pinchWorld(u: number, out = new THREE.Vector3()): THREE.Vector3 {
    out.set(0, 0, u);
    this.head.localToWorld(out);
    return out;
  }

  /** Where the crown of a carried daikon sits for belt parameter `u` (world). */
  carryWorld(u: number, out = new THREE.Vector3()): THREE.Vector3 {
    this.pinchWorld(u, out);
    out.y -= MACHINE.hangDrop;
    return out;
  }

  mouthWorld(out = new THREE.Vector3()): THREE.Vector3 {
    return this.pinchWorld(MACHINE.entryU, out);
  }

  dischargeWorld(z: number, out = new THREE.Vector3()): THREE.Vector3 {
    out.set(0, MACHINE.dischargeY, z);
    this.root.localToWorld(out);
    return out;
  }

  update(dt: number, travelled: number, running: boolean) {
    const drive = running ? 1 : 0;
    const tr = -travelled / (2 * Math.PI * 0.15);
    for (const t of this.trackTex) t.offset.y = tr;
    const beltPhase = (performance.now() / 1000) * 0.66 * drive;
    if (this.beltTexL) this.beltTexL.offset.y = -beltPhase * 0.9;
    if (this.beltTexR) this.beltTexR.offset.y = beltPhase * 0.9;
    if (this.dischargeTex) this.dischargeTex.offset.y = -beltPhase * 0.8;
    if (this.blade) this.blade.rotation.y += dt * (running ? 46 : 6);
    if (this.beacon) {
      const m = this.beacon.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 1.0 + Math.sin(performance.now() / 160) * 0.8;
    }
    const shake = running ? 0.0016 : 0.0009;
    this.tmp.set(Math.sin(performance.now() / 47) * shake, Math.sin(performance.now() / 31) * shake, 0);
    this.head.position.set(MACHINE.pivot.x + this.tmp.x, MACHINE.pivot.y + this.tmp.y, MACHINE.pivot.z);
  }
}
