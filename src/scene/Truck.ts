import * as THREE from 'three';
import { paintTexture, concreteTexture } from '../util/textures';
import { clamp, damp } from '../util/math';

/**
 * Vacuum excavation unit: cab, debris tank, water tank, hose reel and a
 * slewing telescopic boom. The boom is what carries the working hose, so the
 * path from tank to nozzle stays readable.
 */
export class Truck {
  readonly group = new THREE.Group();
  readonly boomTip = new THREE.Object3D();
  readonly reelPoint = new THREE.Object3D();
  readonly waterOutlet = new THREE.Object3D();

  private yawGroup = new THREE.Group();
  private pitchGroup = new THREE.Group();
  private extendGroup = new THREE.Group();
  private reelDrum: THREE.Object3D;
  private targetYaw = 0;
  private targetPitch = -0.1;
  private targetExt = 0.6;
  private yaw = 0;
  private pitch = -0.1;
  private ext = 0.6;
  private readonly baseLen = 2.5;
  private readonly maxExt = 4.6;
  /** Absolute slew/extend rate this frame, for hydraulic audio. */
  motion = 0;

  private tmpV = new THREE.Vector3();
  private tmpM = new THREE.Matrix4();

  constructor(quality: number) {
    const seg = quality >= 1 ? 20 : 10;
    const bodyMat = new THREE.MeshStandardMaterial({
      map: paintTexture(0xa8a79f, 256),
      roughness: 0.66,
      metalness: 0.12,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      map: paintTexture(0x2f4d6b, 256),
      roughness: 0.6,
      metalness: 0.2,
    });
    const steel = new THREE.MeshStandardMaterial({ color: 0x6d7175, roughness: 0.55, metalness: 0.72 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x3a3d41, roughness: 0.7, metalness: 0.5 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.95, metalness: 0 });
    const grime = new THREE.MeshStandardMaterial({
      map: concreteTexture(128),
      color: 0x6a563d,
      roughness: 1,
      metalness: 0,
    });

    // chassis
    const frame = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.24, 1.9), darkSteel);
    frame.position.set(0, 0.86, 0);
    frame.castShadow = true;
    this.group.add(frame);

    // cab
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.6, 2.28), bodyMat);
    cab.position.set(2.5, 1.78, 0);
    cab.castShadow = true;
    cab.receiveShadow = true;
    this.group.add(cab);
    const glass = new THREE.MeshStandardMaterial({
      color: 0x2b3a45,
      roughness: 0.18,
      metalness: 0.35,
    });
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.8, 2.0), glass);
    windshield.position.set(3.44, 2.05, 0);
    this.group.add(windshield);
    for (const z of [-1.16, 1.16]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.06), glass);
      side.position.set(2.62, 2.05, z);
      this.group.add(side);
    }
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 2.3), steel);
    bumper.position.set(3.55, 1.02, 0);
    bumper.castShadow = true;
    this.group.add(bumper);
    // parked amber beacon, unlit
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.1, 0.13, 10),
      new THREE.MeshStandardMaterial({ color: 0xb07a1c, roughness: 0.45, metalness: 0.1 })
    );
    beacon.position.set(2.5, 2.65, 0.78);
    this.group.add(beacon);

    // debris tank: the spoil ends up in here
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.02, 3.5, seg), bodyMat);
    tank.rotation.z = Math.PI / 2;
    tank.position.set(-0.15, 2.05, 0);
    tank.castShadow = true;
    tank.receiveShadow = true;
    this.group.add(tank);
    for (const x of [-1.9, 1.6]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.04, 0.96, 0.24, seg), accentMat);
      cap.rotation.z = Math.PI / 2;
      cap.position.set(x, 2.05, 0);
      cap.castShadow = true;
      this.group.add(cap);
    }
    // reinforcing bands: the tank has to take full vacuum
    for (const x of [-1.25, -0.15, 0.95]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(1.035, 0.05, 6, seg), steel);
      band.rotation.y = Math.PI / 2;
      band.position.set(x, 2.05, 0);
      band.castShadow = true;
      this.group.add(band);
    }
    const walkway = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.05, 0.5), darkSteel);
    walkway.position.set(-0.15, 2.98, 0.42);
    walkway.castShadow = true;
    this.group.add(walkway);
    for (const x of [-1.5, 1.1]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 6), steel);
      rail.position.set(x, 3.4, 0.62);
      this.group.add(rail);
    }
    const topRail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.7, 6), steel);
    topRail.rotation.z = Math.PI / 2;
    topRail.position.set(-0.2, 3.82, 0.62);
    this.group.add(topRail);

    // mud splash along the bottom of the tank
    const splash = new THREE.Mesh(new THREE.CylinderGeometry(1.045, 1.045, 3.3, seg, 1, true, 3.6, 2.1), grime);
    splash.rotation.z = Math.PI / 2;
    splash.position.set(-0.15, 2.05, 0);
    this.group.add(splash);

    // water tank feeding the lance
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 1.7, seg), accentMat);
    water.rotation.x = Math.PI / 2;
    water.position.set(1.35, 1.28, 0);
    water.castShadow = true;
    this.group.add(water);
    this.waterOutlet.position.set(1.35, 1.35, -0.85);
    this.group.add(this.waterOutlet);

    // hose reel at the rear
    const reel = new THREE.Group();
    reel.position.set(-2.35, 1.72, 0);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, seg), darkSteel);
    drum.rotation.x = Math.PI / 2;
    drum.castShadow = true;
    reel.add(drum);
    for (const z of [-0.53, 0.53]) {
      const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.06, seg), steel);
      flange.rotation.x = Math.PI / 2;
      flange.position.z = z;
      flange.castShadow = true;
      reel.add(flange);
    }
    const coil = new THREE.Mesh(
      new THREE.TorusGeometry(0.53, 0.1, 6, seg),
      new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.8 })
    );
    coil.rotation.y = Math.PI / 2;
    coil.castShadow = true;
    reel.add(coil);
    this.reelDrum = reel;
    this.group.add(reel);
    this.reelPoint.position.set(-2.35, 2.28, -0.1);
    this.group.add(this.reelPoint);

    // toolboxes and ladder
    for (const x of [0.65, -1.15]) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.36), steel);
      box.position.set(x, 1.22, 0.92);
      box.castShadow = true;
      this.group.add(box);
    }
    const ladder = new THREE.Group();
    for (const y of [1.2, 1.55, 1.9, 2.25]) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.4), steel);
      rung.position.set(-2.95, y, 0);
      ladder.add(rung);
    }
    for (const z of [-0.2, 0.2]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.3, 0.05), steel);
      rail.position.set(-2.95, 1.72, z);
      ladder.add(rail);
    }
    this.group.add(ladder);

    // wheels
    const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.34, quality >= 1 ? 18 : 10);
    wheelGeo.rotateX(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.36, quality >= 1 ? 12 : 8);
    hubGeo.rotateX(Math.PI / 2);
    const axles = [2.3, -1.1, -1.95];
    const wheels = new THREE.InstancedMesh(wheelGeo, rubber, axles.length * 2);
    const hubs = new THREE.InstancedMesh(hubGeo, steel, axles.length * 2);
    wheels.castShadow = true;
    let i = 0;
    for (const x of axles) {
      for (const z of [-1.03, 1.03]) {
        this.tmpM.makeTranslation(x, 0.55, z);
        wheels.setMatrixAt(i, this.tmpM);
        hubs.setMatrixAt(i, this.tmpM);
        i++;
      }
    }
    wheels.instanceMatrix.needsUpdate = true;
    hubs.instanceMatrix.needsUpdate = true;
    this.group.add(wheels, hubs);
    for (const x of axles) {
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 0.44), grime);
      flap.position.set(x - 0.62, 0.34, 1.03);
      this.group.add(flap);
    }

    // ---- boom ------------------------------------------------------------
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.7, seg), steel);
    pedestal.position.set(-2.9, 1.35, 0);
    pedestal.castShadow = true;
    this.group.add(pedestal);

    this.yawGroup.position.set(-2.9, 1.72, 0);
    this.group.add(this.yawGroup);

    const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.42, 10), darkSteel);
    knuckle.rotation.x = Math.PI / 2;
    knuckle.castShadow = true;
    this.yawGroup.add(knuckle);
    this.yawGroup.add(this.pitchGroup);

    const arm1 = new THREE.Mesh(new THREE.BoxGeometry(this.baseLen, 0.3, 0.34), accentMat);
    arm1.position.x = this.baseLen / 2;
    arm1.castShadow = true;
    this.pitchGroup.add(arm1);
    const ram = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 8), steel);
    ram.rotation.z = Math.PI / 2;
    ram.position.set(0.75, -0.26, 0);
    ram.castShadow = true;
    this.pitchGroup.add(ram);

    this.pitchGroup.add(this.extendGroup);
    const arm2 = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.22, 0.25), steel);
    arm2.position.x = 1.3;
    arm2.castShadow = true;
    this.extendGroup.add(arm2);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.36), darkSteel);
    head.position.x = 2.62;
    head.castShadow = true;
    this.extendGroup.add(head);
    const guideRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 6, 14), steel);
    guideRing.rotation.y = Math.PI / 2;
    guideRing.position.set(2.62, -0.12, 0);
    guideRing.castShadow = true;
    this.extendGroup.add(guideRing);
    this.boomTip.position.set(2.62, -0.2, 0);
    this.extendGroup.add(this.boomTip);

    this.group.position.set(4.6, 0, 4.4);
    this.group.rotation.y = 0.3;
    this.applyBoom();
  }

  /** Point the boom head above a world position so the hose reaches it. */
  aimAt(world: THREE.Vector3, lift = 1.65) {
    this.tmpV.copy(world);
    this.tmpV.y += lift;
    this.group.updateMatrixWorld();
    this.yawGroup.parent!.worldToLocal(this.tmpV);
    const v = this.tmpV.clone().sub(this.yawGroup.position);
    this.targetYaw = Math.atan2(-v.z, v.x);
    const h = Math.hypot(v.x, v.z);
    this.targetPitch = clamp(Math.atan2(v.y, h), -0.5, 0.75);
    const len = Math.hypot(h, v.y);
    this.targetExt = clamp(len - this.baseLen - 0.3, 0.1, this.maxExt);
  }

  update(dt: number) {
    const y0 = this.yaw;
    const p0 = this.pitch;
    const e0 = this.ext;
    this.yaw = damp(this.yaw, this.targetYaw, 2.4, dt);
    this.pitch = damp(this.pitch, this.targetPitch, 2.4, dt);
    this.ext = damp(this.ext, this.targetExt, 2.0, dt);
    this.motion =
      (Math.abs(this.yaw - y0) * 2.2 + Math.abs(this.pitch - p0) * 1.6 + Math.abs(this.ext - e0)) / Math.max(dt, 1e-4);
    this.applyBoom();
    this.reelDrum.rotation.z += this.motion * 0.02 * dt;
  }

  private applyBoom() {
    this.yawGroup.rotation.y = this.yaw;
    this.pitchGroup.rotation.z = this.pitch;
    this.extendGroup.position.x = this.baseLen * 0.72 + this.ext;
  }

  boomTipWorld(out: THREE.Vector3) {
    this.boomTip.getWorldPosition(out);
    return out;
  }

  reelWorld(out: THREE.Vector3) {
    this.reelPoint.getWorldPosition(out);
    return out;
  }

  waterOutletWorld(out: THREE.Vector3) {
    this.waterOutlet.getWorldPosition(out);
    return out;
  }
}
