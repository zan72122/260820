import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MaterialKit } from './materials';

/**
 * Local maintenance control cabinet (現地扱い操作盤) standing at the walkway
 * gate inside the safety railing — a guarded two-position selector handle on
 * a sloped desk, with a mimic diagram of the two routes above it. No text,
 * no toy styling: pictorial route lamps only.
 */

export class ControlPanel {
  readonly group = new THREE.Group();
  readonly lever = new THREE.Group();
  /** -1 = straight (left detent) ... +1 = curve (right detent) */
  leverValue = 1;
  private lampStraight: THREE.MeshStandardMaterial;
  private lampCurve: THREE.MeshStandardMaterial;
  /** desk slopes down towards the operator; the mimic row stands tallest */
  private deskTilt = 0.44;
  readonly hand: WorkerHand;

  constructor(m: MaterialKit) {
    // cabinet body on a stand, cable entry down into the deck trench
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.5, 0.42), m.cabinet);
    body.position.y = 0.78;
    body.castShadow = true;
    this.group.add(body);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.56, 0.34), m.cabinet);
    stand.position.y = 0.28;
    stand.castShadow = true;
    this.group.add(stand);
    const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.32, 8), m.galv);
    conduit.position.set(0.18, 0.1, -0.12);
    this.group.add(conduit);
    // vent louvres
    for (let i = 0; i < 3; i++) {
      const louvre = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.016, 0.02), m.steelDark);
      louvre.position.set(-0.18, 0.62 + i * 0.05, 0.215);
      this.group.add(louvre);
    }

    // sloped desk face (tilted towards the walkway / camera)
    const desk = new THREE.Group();
    desk.position.set(0, 1.02, 0.12);
    desk.rotation.x = this.deskTilt;
    this.group.add(desk);
    const deskPlate = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.05, 0.5), m.cabinet);
    deskPlate.castShadow = true;
    desk.add(deskPlate);

    // ---- mimic diagram: engraved route lines + two lamps -------------------
    const mimic = new THREE.Group();
    mimic.position.set(0, 0.028, -0.14);
    desk.add(mimic);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.012, 0.19),
      new THREE.MeshStandardMaterial({ color: 0x22282c, roughness: 0.55 }));
    mimic.add(plate);
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xcfd6d8, roughness: 0.4 });
    // common approach line (bottom centre going up)
    const seg = (x: number, z: number, len: number, yaw: number) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.006, len), lineMat);
      s.position.set(x, 0.009, z);
      s.rotation.y = yaw;
      mimic.add(s);
    };
    seg(0, 0.055, 0.07, 0);
    seg(-0.028, -0.01, 0.09, 0.5);   // branch to the left lamp = straight route
    seg(-0.062, -0.062, 0.05, 0.5);
    seg(0.028, -0.01, 0.09, -0.5);   // branch to the right lamp = curved route
    seg(0.062, -0.062, 0.05, -0.5);
    const lampGeo = new THREE.SphereGeometry(0.02, 10, 8);
    this.lampStraight = new THREE.MeshStandardMaterial({ color: 0x1e2325, emissive: 0x000000 });
    this.lampCurve = new THREE.MeshStandardMaterial({ color: 0x1e2325, emissive: 0x000000 });
    const l1 = new THREE.Mesh(lampGeo, this.lampStraight);
    l1.position.set(-0.085, 0.012, -0.075);
    mimic.add(l1);
    const l2 = new THREE.Mesh(lampGeo, this.lampCurve);
    l2.position.set(0.085, 0.012, -0.075);
    mimic.add(l2);

    // ---- guarded selector handle ------------------------------------------
    // pivot at desk surface; handle sweeps left-right between two detents
    this.lever.position.set(0, 0.03, 0.12);
    desk.add(this.lever);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.16, 10), m.machined);
    shaft.position.y = 0.08;
    this.lever.add(shaft);
    const grip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.55 }));
    grip.position.y = 0.165;
    grip.scale.y = 1.25;
    this.lever.add(grip);
    // collar
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.03, 12), m.steelDark);
    collar.position.set(0, 0.012, 0.12);
    desk.add(collar);
    // guard hoops either side of the slot
    for (const s of [-1, 1]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.011, 8, 14, Math.PI), m.galv);
      hoop.position.set(s * 0.15, 0.02, 0.12);
      hoop.rotation.z = 0;
      hoop.rotation.y = Math.PI / 2;
      desk.add(hoop);
    }
    // detent markers: small pictorial route glyphs at slot ends
    const glyph = (x: number, curve: boolean) => {
      const gm = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.004, 0.055), lineMat);
      gm.position.set(x, 0.028, 0.2);
      if (curve) gm.rotation.y = -0.55;
      desk.add(gm);
    };
    glyph(-0.115, false);
    glyph(0.115, true);

    // guarded emergency stop, peripheral (clicks but has no game effect)
    const eGuard = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.035, 12, 1, true), m.galv);
    eGuard.position.set(0.26, 0.04, -0.02);
    desk.add(eGuard);
    const eBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12),
      new THREE.MeshStandardMaterial({ color: 0xa03028, roughness: 0.5 }));
    eBtn.position.set(0.26, 0.045, -0.02);
    desk.add(eBtn);

    this.hand = new WorkerHand(m);
    this.group.add(this.hand.group);

    this.setLever(this.leverValue);
  }

  /** v in [-1, 1]; sweeps the handle between the detents (~±33°) */
  setLever(v: number): void {
    this.leverValue = THREE.MathUtils.clamp(v, -1, 1);
    this.lever.rotation.z = -this.leverValue * 0.58;
  }

  setLamp(side: 'straight' | 'curve' | null): void {
    const set = (mat: THREE.MeshStandardMaterial, on: boolean, color: number) => {
      mat.emissive.setHex(on ? color : 0x000000);
      mat.emissiveIntensity = 1.4;
      mat.color.setHex(on ? 0x333333 : 0x1e2325);
    };
    set(this.lampStraight, side === 'straight', 0xffb63d);
    set(this.lampCurve, side === 'curve', 0xffb63d);
  }

  /** world position of the lever grip (camera + hint targeting) */
  gripWorld(out: THREE.Vector3): THREE.Vector3 {
    this.lever.updateWorldMatrix(true, false);
    return out.setFromMatrixPosition(this.lever.matrixWorld).add(
      new THREE.Vector3(0, 0.12, 0));
  }
}

/** Gloved maintenance-worker hand used for the staged idle hint. */
export class WorkerHand {
  readonly group = new THREE.Group();
  private mats: THREE.MeshStandardMaterial[] = [];

  constructor(m: MaterialKit) {
    const glove = new THREE.MeshStandardMaterial({
      color: 0xd8d4c8, roughness: 0.95, transparent: true, opacity: 0,
    });
    const cuff = new THREE.MeshStandardMaterial({
      color: 0xdd7e1f, roughness: 0.9, transparent: true, opacity: 0, // hi-vis sleeve
    });
    this.mats = [glove, cuff];

    // palm
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.03, 0.1), glove);
    this.group.add(palm);
    // fingers: slightly curled
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0105, 0.055, 3, 6), glove);
      f.position.set(-0.032 + i * 0.021, -0.008, -0.075);
      f.rotation.x = 1.25;
      this.group.add(f);
    }
    // thumb
    const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.045, 3, 6), glove);
    th.position.set(0.052, -0.01, -0.02);
    th.rotation.z = -0.9;
    th.rotation.x = 0.6;
    this.group.add(th);
    // wrist + hi-vis cuff
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.09, 10), glove);
    wrist.rotation.x = Math.PI / 2 - 0.35;
    wrist.position.set(0, 0.015, 0.08);
    this.group.add(wrist);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.14, 10), cuff);
    sleeve.rotation.x = Math.PI / 2 - 0.35;
    sleeve.position.set(0, 0.045, 0.175);
    this.group.add(sleeve);

    this.group.visible = false;
  }

  setOpacity(o: number): void {
    for (const m of this.mats) m.opacity = o;
    this.group.visible = o > 0.01;
  }
}
