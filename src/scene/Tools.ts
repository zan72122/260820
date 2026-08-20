import * as THREE from 'three';
import { clamp, damp, lerp } from '../util/math';
import { paintTexture } from '../util/textures';

const steel = () => new THREE.MeshStandardMaterial({ color: 0x8b8f93, roughness: 0.45, metalness: 0.78 });
const darkPoly = () => new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.72, metalness: 0.05 });
const rubber = () => new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.92, metalness: 0 });

/** Common base: origin sits at the working tip, body extends up and back. */
export class ToolBase {
  readonly group = new THREE.Group();
  readonly gripFront = new THREE.Object3D();
  readonly gripBack = new THREE.Object3D();
  readonly tip = new THREE.Object3D();

  constructor() {
    this.group.add(this.gripFront, this.gripBack, this.tip);
    this.group.visible = false;
  }

  setVisible(v: boolean) {
    this.group.visible = v;
  }

  /** Place the tip at a world point, leaning back toward the operator. */
  aim(tipWorld: THREE.Vector3, fromWorld: THREE.Vector3, tilt: number, dt: number, instant = false) {
    const yaw = Math.atan2(fromWorld.x - tipWorld.x, fromWorld.z - tipWorld.z);
    if (instant) {
      this.group.position.copy(tipWorld);
      this.group.rotation.set(tilt, yaw, 0);
      return;
    }
    this.group.position.x = damp(this.group.position.x, tipWorld.x, 13, dt);
    this.group.position.y = damp(this.group.position.y, tipWorld.y, 13, dt);
    this.group.position.z = damp(this.group.position.z, tipWorld.z, 13, dt);
    let d = yaw - this.group.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.group.rotation.y += d * (1 - Math.exp(-9 * dt));
    this.group.rotation.x = damp(this.group.rotation.x, tilt, 9, dt);
  }

  gripWorld(front: THREE.Vector3, back: THREE.Vector3) {
    this.group.updateMatrixWorld();
    this.gripFront.getWorldPosition(front);
    this.gripBack.getWorldPosition(back);
  }
}

/** Cable / pipe locator wand with a physical needle gauge. */
export class Detector extends ToolBase {
  private needle: THREE.Mesh;
  private headPlate: THREE.Mesh;
  private shake = new THREE.Group();
  private signal = 0;

  constructor() {
    super();
    const body = new THREE.Group();
    this.group.add(this.shake);
    this.shake.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.055, 0.16), darkPoly());
    head.position.y = 0.05;
    head.castShadow = true;
    body.add(head);
    this.headPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.02, 0.13),
      new THREE.MeshStandardMaterial({ color: 0x53595f, roughness: 0.6, metalness: 0.35 })
    );
    this.headPlate.position.y = 0.022;
    body.add(this.headPlate);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.024, 0.86, 10), steel());
    shaft.position.set(0, 0.5, 0.1);
    shaft.rotation.x = -0.13;
    shaft.castShadow = true;
    body.add(shaft);

    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.19, 0.09), paintPoly(0xd8a11c));
    housing.position.set(0, 0.94, 0.16);
    housing.castShadow = true;
    body.add(housing);

    const dial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.056, 0.056, 0.012, 16),
      new THREE.MeshStandardMaterial({ color: 0xe9e6dc, roughness: 0.5 })
    );
    dial.rotation.x = Math.PI / 2 - 0.35;
    dial.position.set(0, 0.955, 0.212);
    body.add(dial);
    // simple arc of tick marks; no numerals to read
    for (let i = 0; i < 7; i++) {
      const a = lerp(-1.05, 1.05, i / 6);
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(0.005, 0.016, 0.004),
        new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.8 })
      );
      tick.position.set(Math.sin(a) * 0.042, 0.955 + Math.cos(a) * 0.042 * 0.94, 0.219);
      tick.rotation.z = -a;
      body.add(tick);
    }
    this.needle = new THREE.Mesh(
      new THREE.BoxGeometry(0.005, 0.078, 0.004),
      new THREE.MeshStandardMaterial({ color: 0xb8341c, roughness: 0.6 })
    );
    this.needle.geometry.translate(0, 0.033, 0);
    this.needle.position.set(0, 0.925, 0.222);
    body.add(this.needle);

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.12, 8), rubber());
    grip.position.set(0, 1.07, 0.18);
    grip.rotation.x = -0.13;
    body.add(grip);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.2, 8), rubber());
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 0.66, 0.12);
    body.add(bar);

    this.gripFront.position.set(-0.07, 0.66, 0.12);
    this.gripBack.position.set(0.02, 1.08, 0.18);
    this.tip.position.set(0, 0.03, 0);
  }

  setSignal(s: number) {
    this.signal = clamp(s, 0, 1);
  }

  animate(dt: number, t: number) {
    const target = lerp(-1.0, 1.0, this.signal);
    this.needle.rotation.z = damp(this.needle.rotation.z, -target, 12, dt) + Math.sin(t * 22) * 0.02 * this.signal;
    const amp = this.signal * this.signal * 0.012;
    this.shake.position.x = Math.sin(t * 34) * amp;
    this.shake.position.y = Math.sin(t * 41 + 1) * amp * 0.7;
    (this.headPlate.material as THREE.MeshStandardMaterial).roughness = 0.6 - this.signal * 0.2;
  }
}

/** High-pressure water lance. Water only flows while the finger is down. */
export class WaterLance extends ToolBase {
  readonly inlet = new THREE.Object3D();
  private trigger: THREE.Mesh;

  constructor() {
    super();
    const wand = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.76, 10), steel());
    wand.position.set(0, 0.36, 0.14);
    wand.rotation.x = -0.36;
    wand.castShadow = true;
    this.group.add(wand);

    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.026, 0.09, 10), darkPoly());
    nozzle.position.set(0, 0.05, 0.02);
    nozzle.rotation.x = -0.36;
    nozzle.castShadow = true;
    this.group.add(nozzle);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.007, 6, 12), steel());
    collar.rotation.x = Math.PI / 2 - 0.36;
    collar.position.set(0, 0.1, 0.035);
    this.group.add(collar);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.16, 0.07), paintPoly(0x2f5f86));
    grip.position.set(0, 0.72, 0.36);
    grip.rotation.x = 0.32;
    grip.castShadow = true;
    this.group.add(grip);
    this.trigger = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.075, 0.02), darkPoly());
    this.trigger.position.set(0, 0.72, 0.31);
    this.group.add(this.trigger);
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.008, 5, 10, Math.PI), steel());
    guard.position.set(0, 0.73, 0.33);
    guard.rotation.set(0, Math.PI / 2, -0.4);
    this.group.add(guard);

    const foreGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.13, 8), rubber());
    foreGrip.position.set(0, 0.44, 0.2);
    foreGrip.rotation.x = -0.36;
    this.group.add(foreGrip);

    this.inlet.position.set(0, 0.8, 0.44);
    this.group.add(this.inlet);
    this.gripFront.position.set(-0.02, 0.44, 0.2);
    this.gripBack.position.set(0.02, 0.71, 0.37);
    this.tip.position.set(0, 0.02, 0.005);
  }

  setFlow(on: boolean, dt: number) {
    this.trigger.position.z = damp(this.trigger.position.z, on ? 0.325 : 0.31, 20, dt);
  }

  inletWorld(out: THREE.Vector3) {
    this.group.updateMatrixWorld();
    return this.inlet.getWorldPosition(out);
  }
}

/** The business end of the big suction hose: wide mouth, heavy cuff. */
export class VacuumNozzle extends ToolBase {
  readonly inlet = new THREE.Object3D();
  private mouth: THREE.Mesh;

  constructor(radius: number) {
    super();
    const bell = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.98, radius * 1.35, 0.3, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x33363b, roughness: 0.74, metalness: 0.18, side: THREE.DoubleSide })
    );
    bell.position.y = 0.16;
    bell.castShadow = true;
    this.mouth = bell;
    this.group.add(bell);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.35, 0.022, 6, 20), steel());
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.012;
    rim.castShadow = true;
    this.group.add(rim);
    // soft skirt so the mouth never scrapes hard onto buried plant
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.38, radius * 1.42, 0.03, 16, 1, true),
      rubber()
    );
    skirt.position.y = 0.012;
    this.group.add(skirt);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.98, radius * 0.98, 0.34, 16),
      new THREE.MeshStandardMaterial({ color: 0x2a2d32, roughness: 0.78, metalness: 0.1 })
    );
    barrel.position.y = 0.46;
    barrel.castShadow = true;
    this.group.add(barrel);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, 0.09, 16), steel());
    cuff.position.y = 0.62;
    cuff.castShadow = true;
    this.group.add(cuff);

    for (const side of [-1, 1]) {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.2, 8), rubber());
      handle.rotation.z = Math.PI / 2;
      handle.position.set(side * (radius + 0.13), 0.52, 0.04);
      handle.castShadow = true;
      this.group.add(handle);
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.03), steel());
      stem.position.set(side * (radius + 0.05), 0.52, 0.04);
      this.group.add(stem);
    }

    this.inlet.position.set(0, 0.68, 0);
    this.group.add(this.inlet);
    this.gripFront.position.set(-(radius + 0.13), 0.52, 0.04);
    this.gripBack.position.set(radius + 0.13, 0.52, 0.04);
    this.tip.position.set(0, 0.01, 0);
  }

  setSuction(power: number) {
    (this.mouth.material as THREE.MeshStandardMaterial).color.setHex(power > 0.2 ? 0x2a2c30 : 0x33363b);
  }

  inletWorld(out: THREE.Vector3) {
    this.group.updateMatrixWorld();
    return this.inlet.getWorldPosition(out);
  }
}

/**
 * Banded depth rod. The player reads the depth by how many bands disappear
 * below the ground line, never by a number.
 */
export class DepthRod extends ToolBase {
  private bands: THREE.Mesh[] = [];
  private groundRing: THREE.Mesh;
  readonly length = 1.1;

  constructor() {
    super();
    const bandCount = 11;
    const h = this.length / bandCount;
    for (let i = 0; i < bandCount; i++) {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.026, h, 10),
        new THREE.MeshStandardMaterial({
          color: i % 2 === 0 ? 0xe0b528 : 0x24262a,
          roughness: 0.6,
          metalness: 0.15,
        })
      );
      m.position.y = h * (i + 0.5);
      m.castShadow = true;
      this.group.add(m);
      this.bands.push(m);
    }
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.03, 12), rubber());
    foot.position.y = 0.015;
    this.group.add(foot);
    const tHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8), rubber());
    tHandle.rotation.z = Math.PI / 2;
    tHandle.position.y = this.length + 0.03;
    tHandle.castShadow = true;
    this.group.add(tHandle);

    this.groundRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.05, 0.011, 6, 16),
      new THREE.MeshStandardMaterial({ color: 0xd8452a, roughness: 0.55 })
    );
    this.groundRing.rotation.x = Math.PI / 2;
    this.groundRing.position.y = 0.4;
    this.group.add(this.groundRing);

    this.gripFront.position.set(-0.09, this.length + 0.03, 0);
    this.gripBack.position.set(0.09, this.length + 0.03, 0);
    this.tip.position.set(0, 0, 0);
  }

  /** Slide the red collar to the current ground line above the tip. */
  setGroundLine(height: number) {
    this.groundRing.position.y = clamp(height, 0.02, this.length);
  }

  highlightSubmerged(height: number) {
    const h = this.length / this.bands.length;
    this.bands.forEach((b, i) => {
      const mat = b.material as THREE.MeshStandardMaterial;
      const below = h * (i + 0.5) < height;
      mat.emissive.setHex(0x000000);
      mat.color.setHex(i % 2 === 0 ? (below ? 0xf0c840 : 0xe0b528) : below ? 0x36393e : 0x24262a);
    });
  }
}

function paintPoly(hex: number) {
  return new THREE.MeshStandardMaterial({ map: paintTexture(hex, 128), roughness: 0.62, metalness: 0.06 });
}
