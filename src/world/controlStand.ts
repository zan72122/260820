import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { MaterialLibrary } from '../render/materials';
import { roundedBox } from '../objects/geometry';
import { clamp, damp, deg, lerp } from '../core/math';

/**
 * The experiment console. Both controls are physical levers rather than
 * buttons: a big one that lifts the gate, and a smaller one that fetches the
 * object back for another go. The console turns to face the camera so the
 * pull direction is the same gesture in either screen orientation.
 */
export class ControlStand {
  readonly root = new Group();
  readonly gateLever = new Group();
  readonly resetLever = new Group();
  /** Grab proxies: generous invisible volumes for small fingers. */
  readonly gateGrab: Mesh;
  readonly resetGrab: Mesh;
  readonly linkage: Mesh;

  /** 0 = at rest, 1 = fully pulled. */
  gatePull = 0;
  resetPull = 0;
  private gateVisual = 0;
  private resetVisual = 0;
  private yaw = 0;
  private linkTarget = new Vector3();

  private static readonly SWING = deg(62);

  constructor(lib: MaterialLibrary, position: Vector3) {
    this.root.name = 'controlStand';
    this.root.position.copy(position);

    const paint = lib.paint('#c9c2b2', 'console');
    const frame = lib.paint('#4d94a4', 'frame');

    // Post and splayed foot.
    const post = new Mesh(new CylinderGeometry(0.05, 0.062, 0.62, 14), frame);
    post.position.y = 0.31;
    post.castShadow = true;
    post.receiveShadow = true;
    this.root.add(post);
    const foot = new Mesh(new CylinderGeometry(0.24, 0.27, 0.035, 20), frame);
    foot.position.y = 0.018;
    foot.receiveShadow = true;
    this.root.add(foot);

    // Slanted console top.
    const top = new Mesh(roundedBox(0.56, 0.05, 0.34, 0.018, 3), paint);
    top.position.set(0, 0.65, 0.03);
    top.rotation.x = deg(-16);
    top.castShadow = true;
    top.receiveShadow = true;
    this.root.add(top);

    // --- gate lever -------------------------------------------------------
    this.gateLever.position.set(-0.14, 0.7, 0.03);
    this.root.add(this.gateLever);
    const shaft = new Mesh(new CylinderGeometry(0.017, 0.019, 0.34, 12), lib.bareSteel(0.28));
    shaft.position.set(0, 0.17, 0);
    shaft.castShadow = true;
    this.gateLever.add(shaft);
    const knob = new Mesh(new SphereGeometry(0.062, 20, 14), lib.rubber('#d8503c'));
    knob.position.set(0, 0.36, 0);
    knob.castShadow = true;
    this.gateLever.add(knob);
    const collar = new Mesh(new CylinderGeometry(0.045, 0.05, 0.03, 14), lib.paint('#4d94a4', 'frame'));
    this.gateLever.add(collar);
    this.gateGrab = new Mesh(new SphereGeometry(0.23, 8, 6), invisible());
    this.gateGrab.position.set(0, 0.32, 0);
    this.gateGrab.name = 'grab:gate';
    this.gateLever.add(this.gateGrab);

    // --- reset lever ------------------------------------------------------
    this.resetLever.position.set(0.17, 0.68, 0.06);
    this.root.add(this.resetLever);
    const rShaft = new Mesh(new CylinderGeometry(0.014, 0.016, 0.24, 10), lib.bareSteel(0.3));
    rShaft.position.set(0, 0.12, 0);
    rShaft.castShadow = true;
    this.resetLever.add(rShaft);
    const rKnob = new Mesh(new SphereGeometry(0.046, 16, 12), lib.wood());
    rKnob.position.set(0, 0.26, 0);
    rKnob.castShadow = true;
    this.resetLever.add(rKnob);
    this.resetGrab = new Mesh(new SphereGeometry(0.2, 8, 6), invisible());
    this.resetGrab.position.set(0, 0.24, 0);
    this.resetGrab.name = 'grab:reset';
    this.resetLever.add(this.resetGrab);

    // Little painted plate under each lever, worn where hands land.
    for (const [x, hex] of [
      [-0.14, '#d8503c'],
      [0.17, '#7fa05a'],
    ] as [number, string][]) {
      const plate = new Mesh(new BoxGeometry(0.16, 0.008, 0.12), lib.paint(hex, `plate${hex}`));
      plate.position.set(x, 0.664, 0.03);
      plate.rotation.x = deg(-16);
      plate.receiveShadow = true;
      this.root.add(plate);
    }

    // --- linkage rod to the gate -----------------------------------------
    // A visible pull cable, so the lever and the gate are obviously one
    // mechanism rather than a button wired to nothing.
    this.linkage = new Mesh(new CylinderGeometry(0.0065, 0.0065, 1, 6), lib.matte('#2b3338', 0.55, 0.35));
    this.linkage.castShadow = true;
    this.linkage.name = 'gateLinkage';
  }

  /** World position of the gate lever knob, used for framing and hints. */
  gateKnobWorld(out = new Vector3()): Vector3 {
    out.set(0, 0.36, 0);
    this.gateLever.localToWorld(out);
    return out;
  }

  resetKnobWorld(out = new Vector3()): Vector3 {
    out.set(0, 0.26, 0);
    this.resetLever.localToWorld(out);
    return out;
  }

  /** Screen-space pull axis is derived from these two poses. */
  gateKnobAt(pull: number, out = new Vector3()): Vector3 {
    const saved = this.gateLever.rotation.x;
    this.gateLever.rotation.x = ControlStand.SWING * pull;
    this.gateLever.updateMatrixWorld(true);
    this.gateKnobWorld(out);
    this.gateLever.rotation.x = saved;
    this.gateLever.updateMatrixWorld(true);
    return out;
  }

  setLinkTarget(p: Vector3): void {
    this.linkTarget.copy(p);
  }

  faceTowards(cameraPos: Vector3, dt: number): void {
    const dx = cameraPos.x - this.root.position.x;
    const dz = cameraPos.z - this.root.position.z;
    const want = Math.atan2(dx, dz);
    let d = want - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw = damp(this.yaw, this.yaw + d, 0.12, dt);
    this.root.rotation.y = this.yaw;
  }

  update(dt: number): void {
    this.gateVisual = damp(this.gateVisual, clamp(this.gatePull, 0, 1), 0.4, dt);
    this.resetVisual = damp(this.resetVisual, clamp(this.resetPull, 0, 1), 0.4, dt);
    this.gateLever.rotation.x = ControlStand.SWING * this.gateVisual;
    this.resetLever.rotation.x = ControlStand.SWING * 0.7 * this.resetVisual;

    // Stretch the rod between the crank and whichever gate is armed.
    const a = new Vector3(0, 0.06, 0);
    this.gateLever.localToWorld(a);
    const b = this.linkTarget;
    const len = a.distanceTo(b);
    if (len > 1e-3) {
      this.linkage.position.copy(a).lerp(b, 0.5);
      this.linkage.quaternion.setFromUnitVectors(
        new Vector3(0, 1, 0),
        b.clone().sub(a).normalize(),
      );
      this.linkage.scale.set(1, len, 1);
      this.linkage.visible = true;
    } else {
      this.linkage.visible = false;
    }
  }

  /** Nudge used by the second-stage hint: the lever and the object twitch. */
  nudge(amount: number): void {
    this.gateVisual = lerp(this.gateVisual, amount, 0.6);
    this.gateLever.rotation.x = ControlStand.SWING * this.gateVisual;
  }
}

let invisibleMat: MeshBasicMaterial | null = null;
function invisible(): MeshBasicMaterial {
  return (invisibleMat ??= new MeshBasicMaterial({
    visible: false,
    depthWrite: false,
  }));
}
