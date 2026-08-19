import * as THREE from 'three';
import { Materials } from '../gfx/materials';
import { makeLeafMaterial } from '../world/DaikonModel';
import { Harvester, MACHINE } from '../world/Harvester';
import { Effects } from '../fx/Effects';
import { CrateUnit } from '../world/Crate';
import { CFG, bedTopY, plantY } from './config';
import type { CropSlot } from '../world/Field';

export type DaikonState =
  | 'idle'
  | 'standing'
  | 'grab'
  | 'strain'
  | 'pop'
  | 'ride'
  | 'fall'
  | 'convey'
  | 'drop';

export const TIMING = { grab: 0.15, strain: 0.21, pop: 0.23 };

const easeOutBack = (t: number) => {
  const c1 = 2.05;
  const c3 = c1 + 1;
  const p = t - 1;
  return 1 + c3 * p * p * p + c1 * p * p;
};
const easeInOut = (t: number) => t * t * (3 - 2 * t);

export interface DaikonHooks {
  harvester: Harvester;
  effects: Effects;
  crate: () => CrateUnit;
  onPop: (d: Daikon) => void;
  onGrab: (d: Daikon) => void;
  onCut: (d: Daikon) => void;
  onCollected: (d: Daikon) => void;
}

export class Daikon {
  readonly group = new THREE.Group();
  readonly rootMesh: THREE.Mesh;
  private cutFace: THREE.Mesh;
  private leaves: THREE.Mesh;
  private leafUniforms: { uGrab: { value: number }; uPinchY: { value: number } };

  state: DaikonState = 'idle';
  slot: CropSlot | null = null;
  /** belt parameter, metres from the conveyor pivot */
  private u = MACHINE.entryU;
  private t = 0;
  private anchor = new THREE.Vector3();
  private popFrom = new THREE.Vector3();
  private swing = 0;
  private swingV = 0;
  private heaveId = -1;
  private vel = new THREE.Vector3();
  private dropT = 0;
  private dropFrom = new THREE.Vector3();
  private dropRotFrom = new THREE.Quaternion();
  private dropRotTo = new THREE.Quaternion();
  private dropTargetLocal = new THREE.Vector3();
  private seed = 0;

  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();

  constructor(
    mats: Materials,
    rootGeo: THREE.BufferGeometry,
    cutGeo: THREE.BufferGeometry,
    leafGeo: THREE.BufferGeometry,
    private hooks: DaikonHooks,
  ) {
    this.rootMesh = new THREE.Mesh(rootGeo, mats.daikon);
    this.rootMesh.castShadow = true;
    this.rootMesh.receiveShadow = true;
    this.group.add(this.rootMesh);

    this.cutFace = new THREE.Mesh(cutGeo, mats.daikonCutFace);
    this.cutFace.visible = false;
    this.group.add(this.cutFace);

    const lm = makeLeafMaterial(mats.leaf);
    this.leafUniforms = lm.uniforms;
    this.leaves = new THREE.Mesh(leafGeo, lm.material);
    this.leaves.castShadow = true;
    this.group.add(this.leaves);

    this.group.visible = false;
  }

  get active(): boolean {
    return this.state !== 'idle';
  }

  /** Put a real, animatable daikon at a crop slot. */
  arm(slot: CropSlot, seed: number) {
    this.slot = slot;
    this.seed = seed;
    this.state = 'standing';
    this.anchor.set(slot.x, plantY, slot.z);
    this.group.position.copy(this.anchor);
    this.group.rotation.set(slot.tilt * 0.6, slot.yaw, slot.tilt * 0.6);
    this.group.scale.setScalar(slot.scale);
    this.group.visible = true;
    this.leaves.visible = true;
    this.cutFace.visible = false;
    this.leafUniforms.uGrab.value = 0;
    this.leafUniforms.uPinchY.value = 0.3;
    this.swing = 0;
    this.swingV = 0;
    this.t = 0;
  }

  release() {
    this.state = 'idle';
    this.slot = null;
    this.group.visible = false;
    if (this.heaveId >= 0) {
      this.hooks.effects.releaseHeave(this.heaveId);
      this.heaveId = -1;
    }
  }

  /** Called the moment the belt mouth reaches this plant. */
  grab() {
    if (this.state !== 'standing') return;
    this.state = 'grab';
    this.t = 0;
    this.u = MACHINE.entryU;
    this.heaveId = this.hooks.effects.acquireHeave();
    this.hooks.effects.crack(this.tmp.set(this.anchor.x, bedTopY + 0.008, this.anchor.z), 1.5, 0.42);
    this.hooks.onGrab(this);
  }

  /** World position of the crown — what the close-up camera frames. */
  crownWorld(out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(this.group.position);
  }

  update(dt: number, machineSpeed: number) {
    const H = this.hooks.harvester;
    const FX = this.hooks.effects;
    switch (this.state) {
      case 'idle':
      case 'standing':
        return;

      case 'grab': {
        this.t += dt;
        this.u -= CFG.beltSpeed * dt;
        const k = Math.min(1, this.t / TIMING.grab);
        this.leafUniforms.uGrab.value = easeInOut(k);
        const pinch = H.pinchWorld(this.u, this.tmp);
        this.leafUniforms.uPinchY.value = (pinch.y - this.group.position.y) / this.group.scale.y;
        this.group.position.x = this.anchor.x + Math.sin(this.t * 61) * 0.0035 * k;
        if (this.t >= TIMING.grab) {
          this.state = 'strain';
          this.t = 0;
        }
        return;
      }

      case 'strain': {
        this.t += dt;
        this.u -= CFG.beltSpeed * dt;
        const k = Math.min(1, this.t / TIMING.strain);
        const lift = 0.016 * easeInOut(k);
        this.group.position.set(
          this.anchor.x + Math.sin(this.t * 74) * 0.006 * k,
          this.anchor.y + lift,
          this.anchor.z + Math.sin(this.t * 53) * 0.004 * k,
        );
        this.group.rotation.z = this.slot!.tilt * 0.6 + Math.sin(this.t * 47) * 0.03 * k;
        const pinch = H.pinchWorld(this.u, this.tmp);
        this.leafUniforms.uPinchY.value = (pinch.y - this.group.position.y) / this.group.scale.y;
        FX.setHeave(this.heaveId, this.anchor, lift, 1);
        if (this.t > 0.06 && Math.random() < dt * 22) {
          FX.soilTrickle(this.tmp.set(this.anchor.x, bedTopY, this.anchor.z), bedTopY - 0.02);
        }
        if (this.t >= TIMING.strain) {
          this.state = 'pop';
          this.t = 0;
          this.popFrom.copy(this.group.position);
          this.swingV = -2.6;
          const at = this.tmp.set(this.anchor.x, bedTopY + 0.02, this.anchor.z);
          FX.soilBurst(at, 30, 1.5, bedTopY - 0.04);
          FX.dust(this.tmp2.set(this.anchor.x, bedTopY + 0.08, this.anchor.z), 0.46, 0.8);
          FX.dust(this.tmp2.set(this.anchor.x + 0.09, bedTopY + 0.04, this.anchor.z - 0.06), 0.34, 0.65);
          this.hooks.onPop(this);
        }
        return;
      }

      case 'pop': {
        this.t += dt;
        this.u -= CFG.beltSpeed * dt;
        const k = Math.min(1, this.t / TIMING.pop);
        const e = Math.min(1.06, easeOutBack(k));
        const target = H.carryWorld(this.u, this.tmp);
        this.group.position.lerpVectors(this.popFrom, target, e);
        const s0 = this.slot!.scale;
        const stretch = 1 + Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.075;
        this.group.scale.set(s0 / Math.sqrt(stretch), s0 * stretch, s0 / Math.sqrt(stretch));
        this.leafUniforms.uPinchY.value = MACHINE.hangDrop / this.group.scale.y;
        this.leafUniforms.uGrab.value = 1;
        FX.setHeave(this.heaveId, this.anchor, Math.min(0.06, this.t * 0.3), Math.max(0, 1 - k * 1.4));
        this.integrateSwing(dt);
        if (this.t >= TIMING.pop) {
          this.group.scale.setScalar(this.slot!.scale);
          this.state = 'ride';
          FX.releaseHeave(this.heaveId);
          this.heaveId = -1;
          this.t = 0;
        }
        return;
      }

      case 'ride': {
        this.u -= CFG.beltSpeed * dt;
        H.carryWorld(this.u, this.tmp);
        this.group.position.copy(this.tmp);
        this.integrateSwing(dt);
        this.leafUniforms.uGrab.value = 1;
        if (this.u <= MACHINE.cutU) this.cut();
        return;
      }

      case 'fall': {
        this.vel.y -= 9.81 * dt;
        this.group.position.addScaledVector(this.vel, dt);
        // tip over onto the discharge belt
        this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, Math.PI / 2, 1 - Math.pow(0.0015, dt));
        this.group.rotation.z *= Math.pow(0.2, dt);
        const beltTop = H.dischargeWorld(MACHINE.dischargeZ0, this.tmp).y + CFG.daikonRadius * 0.9;
        if (this.group.position.y <= beltTop) {
          this.group.position.y = beltTop;
          this.state = 'convey';
          this.group.rotation.set(Math.PI / 2, this.seed * 0.7, 0);
          this.hooks.effects.dust(this.group.position, 0.22, 0.5);
        }
        return;
      }

      case 'convey': {
        H.root.worldToLocal(this.tmp.copy(this.group.position));
        this.tmp.z -= MACHINE.dischargeSpeed * dt;
        this.tmp.x = THREE.MathUtils.lerp(this.tmp.x, 0, 1 - Math.pow(0.05, dt));
        this.tmp.y = MACHINE.dischargeY + CFG.daikonRadius * 0.9;
        const reachedEnd = this.tmp.z <= MACHINE.dischargeZ1;
        H.root.localToWorld(this.tmp);
        this.group.position.copy(this.tmp);
        this.group.rotation.z += dt * 1.1;
        if (reachedEnd) this.beginDrop();
        return;
      }

      case 'drop': {
        this.dropT += dt;
        const k = Math.min(1, this.dropT / 0.46);
        H.root.localToWorld(this.tmp.copy(this.dropTargetLocal));
        this.group.position.lerpVectors(this.dropFrom, this.tmp, k);
        // a real arc: fall fast at the end
        this.group.position.y = THREE.MathUtils.lerp(this.dropFrom.y, this.tmp.y, k * k) + Math.sin(k * Math.PI) * 0.03;
        this.group.quaternion.slerpQuaternions(this.dropRotFrom, this.dropRotTo, easeInOut(k));
        // the drop origin travels with the machine
        this.dropFrom.z += machineSpeed * dt;
        if (k >= 1) {
          this.hooks.crate().add();
          this.hooks.onCollected(this);
          this.release();
        }
        return;
      }
    }
  }

  private integrateSwing(dt: number) {
    this.swingV += (-this.swing * 46 - this.swingV * 4.4) * dt;
    this.swing += this.swingV * dt;
    this.group.rotation.set(this.swing, this.slot ? this.slot.yaw : 0, this.swing * 0.28);
  }

  private cut() {
    const H = this.hooks.harvester;
    this.state = 'fall';
    this.leaves.visible = false;
    this.cutFace.visible = true;
    // fling the tops clear of the machine, away from the viewer
    const lw = this.group.localToWorld(new THREE.Vector3(0, 0.16, 0));
    const v = H.root.localToWorld(new THREE.Vector3(-2.3, 1.25, 0.35));
    v.sub(H.root.getWorldPosition(new THREE.Vector3()));
    this.hooks.effects.throwLeaves(lw, v, (this.slot?.scale ?? 1) * 1.05);
    // the root leaves the belt with the conveyor's velocity
    const a = H.head.rotation.x;
    this.vel.set(0, 0, 0);
    this.vel.z = -CFG.beltSpeed * Math.cos(a) + 0.1;
    this.vel.y = CFG.beltSpeed * Math.sin(a) * 0.35;
    this.hooks.onCut(this);
  }

  private beginDrop() {
    const s = this.hooks.crate().peekSlot();
    this.dropTargetLocal.copy(s.pos).add(MACHINE.crateCentre);
    this.dropFrom.copy(this.group.position);
    this.dropRotFrom.copy(this.group.quaternion);
    this.dropRotTo.setFromEuler(s.rot);
    this.dropT = 0;
    this.state = 'drop';
  }
}
