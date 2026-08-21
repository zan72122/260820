import * as THREE from 'three';
import { mergeGeoms, softBox, transformed } from './geomUtil';
import type { ShopMaterials } from './materials';
import type { StepId } from '../game/defects';

/**
 * The five service heads.
 *
 * Every head is modelled with its working tip at the local origin, its contact
 * face lying on the local XY plane and its body running back along +Z, so one
 * placement routine can aim any of them at a point on the flume wall.
 */
export class ToolKit {
  readonly group = new THREE.Group();
  readonly heads: Partial<Record<StepId, THREE.Group>> = {};
  current: StepId | null = null;
  /** 0 = hovering, 1 = pressed into the surface. */
  press = 0;

  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private x = new THREE.Vector3();
  private y = new THREE.Vector3();
  private z = new THREE.Vector3();

  constructor(private mat: ShopMaterials) {
    this.group.name = 'tools';
    this.heads.peel = this.buildScraper();
    this.heads.brush = this.buildBrush();
    this.heads.fill = this.buildNozzle();
    this.heads.smooth = this.buildSpatula();
    this.heads.polish = this.buildPad();
    for (const h of Object.values(this.heads)) {
      if (h) {
        h.visible = false;
        this.group.add(h);
      }
    }
    this.group.visible = false;
  }

  private shaft(len: number, r: number, m: THREE.Material, yLift: number): THREE.Mesh {
    const geo = new THREE.CylinderGeometry(r, r * 1.05, len, 12, 1);
    geo.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(0, yLift, len / 2);
    return mesh;
  }

  private buildScraper(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'tool-scraper';
    const blade = new THREE.Mesh(softBox(0.115, 0.005, 0.062, 0.002), this.mat.aluminium);
    blade.position.set(0, 0.0035, 0.031);
    blade.rotation.x = -0.09;
    const heel = new THREE.Mesh(softBox(0.1, 0.028, 0.03, 0.008), this.mat.plastic(0xf2b23a));
    heel.position.set(0, 0.021, 0.075);
    const body = this.shaft(0.13, 0.014, this.mat.plastic(0xf2b23a), 0.036);
    body.position.z = 0.14;
    body.rotation.x = -0.2;
    const grip = this.shaft(0.07, 0.019, this.mat.grip, 0.062);
    grip.position.z = 0.215;
    grip.rotation.x = -0.2;
    g.add(blade, heel, body, grip);
    return g;
  }

  private buildBrush(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'tool-brush';
    const bristles: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 4; j++) {
        const x = -0.056 + (0.112 * i) / 8;
        const z = 0.012 + (0.042 * j) / 3;
        const h = 0.03 + (j % 2) * 0.003;
        bristles.push(
          transformed(new THREE.BoxGeometry(0.0075, h, 0.0075), [x, h / 2, z], [
            (j - 1.5) * 0.06,
            0,
            (i - 4) * 0.02,
          ]),
        );
      }
    }
    const brush = new THREE.Mesh(mergeGeoms(bristles), this.mat.foam);
    const back = new THREE.Mesh(softBox(0.125, 0.016, 0.058, 0.006), this.mat.plastic(0x59c3d8));
    back.position.set(0, 0.04, 0.031);
    const body = this.shaft(0.12, 0.015, this.mat.plastic(0x59c3d8), 0.058);
    body.position.z = 0.115;
    body.rotation.x = -0.24;
    const grip = this.shaft(0.068, 0.02, this.mat.grip, 0.085);
    grip.position.z = 0.185;
    grip.rotation.x = -0.24;
    g.add(brush, back, body, grip);
    return g;
  }

  private buildNozzle(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'tool-nozzle';
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0165, 0.005, 0.058, 14, 1, true),
      this.mat.plastic(0xf0f2ea),
    );
    cone.geometry.rotateX(-Math.PI / 2);
    cone.position.set(0, 0.012, 0.028);
    cone.rotation.x = -0.4;
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.021, 0.021, 0.016, 14),
      this.mat.aluminium,
    );
    collar.geometry.rotateX(Math.PI / 2);
    collar.position.set(0, 0.026, 0.062);
    collar.rotation.x = -0.4;
    const barrel = this.shaft(0.16, 0.026, this.mat.aluminium, 0.05);
    barrel.position.z = 0.14;
    barrel.rotation.x = -0.32;
    const trigger = new THREE.Mesh(softBox(0.016, 0.05, 0.02, 0.005), this.mat.plastic(0xf2b23a));
    trigger.position.set(0, 0.026, 0.135);
    const grip = this.shaft(0.06, 0.022, this.mat.grip, 0.108);
    grip.position.z = 0.235;
    grip.rotation.x = -0.32;
    g.add(cone, collar, barrel, trigger, grip);
    return g;
  }

  private buildSpatula(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'tool-spatula';
    const blade = new THREE.Mesh(softBox(0.13, 0.0035, 0.078, 0.0015), this.mat.steel);
    blade.position.set(0, 0.0032, 0.039);
    blade.rotation.x = -0.14;
    const ferrule = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.011, 0.03, 12),
      this.mat.aluminium,
    );
    ferrule.geometry.rotateX(Math.PI / 2);
    ferrule.position.set(0, 0.02, 0.09);
    ferrule.rotation.x = -0.24;
    const body = this.shaft(0.11, 0.016, this.mat.plastic(0xe4643c), 0.038);
    body.position.z = 0.145;
    body.rotation.x = -0.24;
    const grip = this.shaft(0.062, 0.021, this.mat.grip, 0.072);
    grip.position.z = 0.215;
    grip.rotation.x = -0.24;
    g.add(blade, ferrule, body, grip);
    return g;
  }

  private buildPad(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'tool-pad';
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.056, 0.02, 22), this.mat.foam);
    pad.position.set(0, 0.01, 0);
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.038, 0.016, 18),
      this.mat.plastic(0x9b6ce0),
    );
    hub.position.set(0, 0.026, 0);
    const body = this.shaft(0.12, 0.017, this.mat.plastic(0x9b6ce0), 0.05);
    body.position.z = 0.078;
    body.rotation.x = -0.36;
    const grip = this.shaft(0.062, 0.022, this.mat.grip, 0.088);
    grip.position.z = 0.15;
    grip.rotation.x = -0.36;
    g.add(pad, hub, body, grip);
    return g;
  }

  show(id: StepId | null): void {
    this.current = id;
    for (const [key, head] of Object.entries(this.heads)) {
      if (head) head.visible = key === id;
    }
    this.group.visible = id !== null;
  }

  /**
   * Aims the active head at a point on the wall.
   * `alongS` runs with the seam, `normal` points away from the wall.
   */
  place(
    tip: THREE.Vector3,
    normal: THREE.Vector3,
    alongS: THREE.Vector3,
    towards: THREE.Vector3,
    roll = 0,
  ): void {
    const head = this.current ? this.heads[this.current] : null;
    if (!head) return;
    this.y.copy(normal).normalize();
    this.x.copy(alongS).addScaledVector(this.y, -alongS.dot(this.y)).normalize();
    this.z.crossVectors(this.x, this.y).normalize();
    if (this.z.dot(towards) < 0) {
      this.z.negate();
      this.x.negate();
    }
    this.tmpM.makeBasis(this.x, this.y, this.z);
    this.tmpQ.setFromRotationMatrix(this.tmpM);
    // lean the shaft back so the operator's view stays clear of the contact point
    const lean = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.34);
    const rollQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), roll);
    this.tmpQ.multiply(rollQ).multiply(lean);
    this.group.quaternion.copy(this.tmpQ);
    this.group.position.copy(tip).addScaledVector(this.y, 0.004 + (1 - this.press) * 0.022);
  }
}
