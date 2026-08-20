import * as THREE from 'three';
import { clamp, damp, lerp } from '../util/math';
import { gaugeTexture, paintTexture } from '../util/textures';

const UP = new THREE.Vector3(0, 1, 0);

/** Cylinder spanning two local points; keeps hand-built tools from drifting apart. */
function link(
  from: [number, number, number],
  to: [number, number, number],
  r1: number,
  r2: number,
  mat: THREE.Material,
  seg = 10
): THREE.Mesh {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, seg), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  m.castShadow = true;
  return m;
}

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
  private searchHead: THREE.Mesh;
  private shake = new THREE.Group();
  private signal = 0;

  constructor() {
    super();
    this.group.add(this.shake);
    const body = new THREE.Group();
    this.shake.add(body);

    const shell = darkPoly();
    // flat search head, held a few centimetres off the ground
    this.searchHead = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.145, 0.038, 20), shell);
    this.searchHead.position.y = 0.03;
    this.searchHead.castShadow = true;
    body.add(this.searchHead);
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.012, 20), rubber());
    skid.position.y = 0.008;
    body.add(skid);

    const shaftMat = steel();
    body.add(link([0, 0.05, 0.02], [0, 0.3, 0.14], 0.016, 0.018, shaftMat));
    body.add(link([0, 0.3, 0.14], [0, 0.98, 0.53], 0.018, 0.02, shaftMat));

    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.17, 0.075), paintPoly(0xd0a51f));
    housing.position.set(0, 0.79, 0.4);
    housing.rotation.x = -0.55;
    housing.castShadow = true;
    body.add(housing);

    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.108, 0.108),
      new THREE.MeshStandardMaterial({ map: gaugeTexture(128), roughness: 0.55, metalness: 0 })
    );
    face.position.set(0, 0.04, 0.039);
    housing.add(face);

    this.needle = new THREE.Mesh(
      new THREE.BoxGeometry(0.004, 0.062, 0.003),
      new THREE.MeshStandardMaterial({ color: 0xb8341c, roughness: 0.55 })
    );
    this.needle.geometry.translate(0, 0.028, 0);
    this.needle.position.set(0, -0.008, 0.043);
    housing.add(this.needle);

    const foreGrip = link([0, 0.46, 0.24], [0, 0.63, 0.33], 0.026, 0.026, rubber(), 8);
    body.add(foreGrip);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.16, 8), rubber());
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, 1.0, 0.56);
    handle.castShadow = true;
    body.add(handle);

    this.gripFront.position.set(-0.03, 0.55, 0.285);
    this.gripBack.position.set(0.04, 1.0, 0.56);
    this.tip.position.set(0, 0.03, 0);
  }

  setSignal(s: number) {
    this.signal = clamp(s, 0, 1);
  }

  animate(dt: number, t: number) {
    const target = lerp(-0.95, 0.95, this.signal);
    this.needle.rotation.z = damp(this.needle.rotation.z, -target, 12, dt) + Math.sin(t * 22) * 0.02 * this.signal;
    const amp = this.signal * this.signal * 0.011;
    this.shake.position.x = Math.sin(t * 34) * amp;
    this.shake.position.y = Math.sin(t * 41 + 1) * amp * 0.7;
    (this.searchHead.material as THREE.MeshStandardMaterial).roughness = 0.72 - this.signal * 0.16;
  }
}

/** High-pressure water lance. Water only flows while the finger is down. */
export class WaterLance extends ToolBase {
  readonly inlet = new THREE.Object3D();
  private trigger: THREE.Mesh;

  constructor() {
    super();
    const tube = steel();
    // orifice sits at the tool origin; the lance runs up and back to the grip
    this.group.add(link([0, 0.015, 0.005], [0, 0.5, 0.6], 0.015, 0.017, tube));
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.025, 0.075, 12), darkPoly());
    tip.position.set(0, 0.03, 0.028);
    tip.quaternion.setFromUnitVectors(UP, new THREE.Vector3(0, 0.62, 0.78).normalize());
    tip.castShadow = true;
    this.group.add(tip);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 5, 12), tube);
    collar.position.set(0, 0.075, 0.065);
    collar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.62, 0.78).normalize());
    this.group.add(collar);

    const foreGrip = link([0, 0.26, 0.32], [0, 0.38, 0.47], 0.025, 0.025, rubber(), 8);
    this.group.add(foreGrip);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.15, 0.062), paintPoly(0x2f5f86));
    grip.position.set(0, 0.55, 0.78);
    grip.rotation.x = 0.5;
    grip.castShadow = true;
    this.group.add(grip);
    this.trigger = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.07, 0.018), darkPoly());
    this.trigger.position.set(0, 0.58, 0.715);
    this.group.add(this.trigger);
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 5, 12, Math.PI), tube);
    guard.position.set(0, 0.575, 0.735);
    guard.rotation.set(0.5, Math.PI / 2, -0.35);
    this.group.add(guard);
    this.group.add(link([0, 0.5, 0.6], [0, 0.62, 0.72], 0.017, 0.017, tube, 8));

    this.inlet.position.set(0, 0.62, 0.86);
    this.group.add(this.inlet);
    this.gripFront.position.set(-0.02, 0.32, 0.4);
    this.gripBack.position.set(0.03, 0.56, 0.77);
    this.tip.position.set(0, 0.01, 0.002);
  }

  setFlow(on: boolean, dt: number) {
    this.trigger.position.z = damp(this.trigger.position.z, on ? 0.73 : 0.715, 20, dt);
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
