import * as THREE from 'three';
import { clamp, damp, lerp } from '../core/util';
import { contactShadow } from '../core/textures';
import { softBox } from './geomUtil';
import type { ShopMaterials } from './materials';
import type { Slide } from './slide';

/**
 * The remote inspection crawler.
 *
 * It carries the raking inspection lamp and the service boom. The player never
 * enters the flume: everything that happens inside happens through this machine.
 */
export class Crawler {
  readonly group = new THREE.Group();
  readonly lamp: THREE.SpotLight;
  readonly lampTarget = new THREE.Object3D();
  readonly fill: THREE.PointLight;

  /** Arc-length parameter along the flume. */
  u = 0;
  speed = 0;
  /** Lamp aim in knob space, both axes -1..1. */
  aimX = 0;
  aimY = 0.62;

  private turret = new THREE.Group();
  private mast = new THREE.Group();
  private wheels: THREE.Mesh[] = [];
  private boom: THREE.Mesh;
  private boomPivot = new THREE.Group();
  private spin = 0;
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();

  constructor(
    private slide: Slide,
    mat: ShopMaterials,
  ) {
    this.group.name = 'crawler';

    const shellColor = 0xffc247;
    const chassis = new THREE.Mesh(softBox(0.3, 0.085, 0.38, 0.022), mat.aluminium);
    chassis.position.y = 0.085;
    const shell = new THREE.Mesh(softBox(0.26, 0.075, 0.3, 0.03), mat.plastic(shellColor));
    shell.position.y = 0.15;
    const strip = new THREE.Mesh(softBox(0.268, 0.014, 0.31, 0.006), mat.plastic(0x2c3b46));
    strip.position.y = 0.116;

    const axleGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.33, 8);
    axleGeo.rotateZ(Math.PI / 2);
    for (const z of [-0.13, 0.13]) {
      const axle = new THREE.Mesh(axleGeo.clone(), mat.aluminium);
      axle.position.set(0, 0.075, z);
      this.group.add(axle);
    }

    const tyreGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.055, 16);
    tyreGeo.rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.058, 10);
    hubGeo.rotateZ(Math.PI / 2);
    for (const x of [-0.16, 0.16]) {
      for (const z of [-0.13, 0.13]) {
        const w = new THREE.Mesh(tyreGeo.clone(), mat.rubber);
        w.position.set(x, 0.075, z);
        const hub = new THREE.Mesh(hubGeo.clone(), mat.aluminium);
        hub.position.set(x > 0 ? 0.004 : -0.004, 0, 0);
        w.add(hub);
        this.wheels.push(w);
        this.group.add(w);
      }
    }

    // pan and tilt lamp head
    this.mast.position.set(0, 0.19, 0.14);
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.016, 0.07, 10),
      mat.aluminium,
    );
    post.position.y = 0.035;
    this.mast.add(post);
    this.turret.position.y = 0.075;
    const head = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.05, 0.06, 16),
      mat.plastic(0x2c3b46),
    );
    head.geometry.rotateX(Math.PI / 2);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.04, 18), mat.glass);
    lens.position.z = 0.031;
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(0.05, 16),
      new THREE.MeshBasicMaterial({
        color: 0xfff2d0,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    );
    halo.position.z = 0.033;
    this.turret.add(head, lens, halo);
    this.mast.add(this.turret);
    this.group.add(this.mast);

    this.lamp = new THREE.SpotLight(0xfff5e4, 5.5, 9, 0.42, 0.55, 1.2);
    this.lamp.position.set(0, 0, 0.03);
    this.lamp.castShadow = true;
    this.lamp.shadow.mapSize.set(512, 512);
    this.lamp.shadow.camera.near = 0.08;
    this.lamp.shadow.camera.far = 4.2;
    this.lamp.shadow.bias = -0.0006;
    this.lamp.shadow.normalBias = 0.004;
    this.turret.add(this.lamp);
    this.lamp.target = this.lampTarget;

    this.fill = new THREE.PointLight(0xcfe6f2, 0.6, 5.5, 1.8);
    this.fill.position.set(0, 0.28, 0.05);
    this.group.add(this.fill);

    // service boom that reaches out to whatever head is in use
    this.boomPivot.position.set(0, 0.2, 0.19);
    this.boom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.014, 1, 8),
      mat.galv,
    );
    this.boom.geometry.translate(0, 0.5, 0);
    this.boom.scale.y = 0.2;
    this.boomPivot.add(this.boom);
    this.group.add(this.boomPivot);
    this.boomPivot.visible = false;

    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.6),
      new THREE.MeshBasicMaterial({
        map: contactShadow(),
        transparent: true,
        depthWrite: false,
        opacity: 0.75,
      }),
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.004;
    this.group.add(blob);

    this.group.add(chassis, shell, strip);
    this.setU(0);
  }

  /** Places the crawler on the flume floor at arc parameter `u`. */
  setU(u: number): void {
    this.u = clamp(u, 0, 0.995);
    const f = this.slide.frame(this.u);
    this.slide.floorAt(this.u, 0, this.tmp);
    this.group.position.copy(this.tmp);
    const n = this.slide.normalAt(this.u, 0, this.tmp2);
    const m = new THREE.Matrix4();
    const right = new THREE.Vector3().crossVectors(n, f.t).normalize();
    m.makeBasis(right, n, f.t);
    this.group.quaternion.setFromRotationMatrix(m);
  }

  /** World position of the lamp lens. */
  lampWorld(out = new THREE.Vector3()): THREE.Vector3 {
    return this.turret.getWorldPosition(out);
  }

  /** Where the beam lands on the flume wall, in slide coordinates. */
  aimSlide(): { u: number; theta: number } {
    const ahead = lerp(0.3, 3.2, (this.aimY + 1) / 2);
    return {
      u: clamp(this.u + this.slide.metersToU(ahead), 0, 1),
      theta: this.aimX * 0.75,
    };
  }

  aimWorld(out = new THREE.Vector3()): THREE.Vector3 {
    const a = this.aimSlide();
    return this.slide.pointAt(a.u, a.theta, 0, out);
  }

  /** Points the service boom at a world position, or stows it. */
  reachTo(target: THREE.Vector3 | null): void {
    if (!target) {
      this.boomPivot.visible = false;
      return;
    }
    this.boomPivot.visible = true;
    this.boomPivot.getWorldPosition(this.tmp);
    const dist = this.tmp.distanceTo(target);
    this.boom.scale.y = clamp(dist - 0.16, 0.08, 2.4);
    this.tmp2.copy(target).sub(this.tmp).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.tmp2);
    this.boomPivot.quaternion.copy(q);
    this.boomPivot.quaternion.premultiply(this.group.quaternion.clone().invert());
  }

  update(dt: number): void {
    this.spin += this.speed * dt * 13.4;
    for (const w of this.wheels) w.rotation.x = this.spin;

    const a = this.aimSlide();
    this.slide.pointAt(a.u, a.theta, 0, this.tmp);
    this.lampTarget.position.copy(this.tmp);

    // aim the visible head at the same point so the machine reads as one object
    this.turret.getWorldPosition(this.tmp2);
    const local = this.group.worldToLocal(this.tmp.clone());
    const origin = this.group.worldToLocal(this.tmp2.clone());
    const dir = local.sub(origin);
    const yaw = Math.atan2(dir.x, dir.z);
    const pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
    this.turret.rotation.y = damp(this.turret.rotation.y, yaw, 14, dt);
    this.turret.rotation.x = damp(this.turret.rotation.x, pitch, 14, dt);
  }

  setLampEnabled(on: boolean, shadows: boolean): void {
    this.lamp.visible = on;
    this.lamp.castShadow = on && shadows;
  }
}
