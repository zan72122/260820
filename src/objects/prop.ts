import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Texture,
  Vector3,
} from 'three';
import { MaterialLibrary } from '../render/materials';
import { bakeContactShadow } from '../render/textures';
import * as G from './geometry';
import { PROFILES, type ObjectId, type ObjectProfile } from './profiles';
import type { BodyState } from '../sim/simulate';
import { slideNormal, slideSurface, slideTangent } from '../world/slideCurve';
import { clamp, damp, noise1 } from '../core/math';

let shadowTex: Texture | null = null;
const contactShadowTexture = (): Texture => (shadowTex ??= bakeContactShadow());

const _up = new Vector3(0, 1, 0);
const _n = new Vector3();
const _t = new Vector3();
const _b = new Vector3();
const _v = new Vector3();
const _q = new Quaternion();

/**
 * The visible half of an experiment object: mesh, morphs, spin behaviour and
 * its own contact shadow. The simulation never touches these — it produces a
 * BodyState and the prop reads it.
 */
export class Prop {
  readonly profile: ObjectProfile;
  readonly root = new Group();
  readonly pivot = new Group();
  private morphs: Mesh[] = [];
  private wheels: Object3D[] = [];
  private shadow: Mesh;
  private meshes: Mesh[] = [];
  private forward = new Vector3(1, 0, 0);
  private flutter = 0;

  constructor(
    readonly id: ObjectId,
    lib: MaterialLibrary,
    opts: { transmission: boolean; shadows: boolean } = { transmission: true, shadows: true },
  ) {
    this.profile = PROFILES[id];
    this.root.name = `prop:${id}`;
    this.root.add(this.pivot);
    build(id, lib, this.pivot, this.morphs, this.wheels, this.meshes, opts.transmission);
    for (const m of this.meshes) {
      m.castShadow = opts.shadows;
      m.receiveShadow = false;
    }
    const r = this.profile.radius;
    this.shadow = new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({
        color: 0x0a1418,
        transparent: true,
        opacity: 0.5,
        alphaMap: contactShadowTexture(),
        depthWrite: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 2;
    this.shadow.scale.setScalar(Math.max(0.11, r * 5.2));
    this.root.add(this.shadow);
  }

  setShadowVisible(v: boolean): void {
    this.shadow.visible = v;
  }

  /** Sit still somewhere in the world (trolley, hand, preview). */
  placeStatic(pos: Vector3, yaw = 0): void {
    this.root.position.copy(pos);
    this.pivot.quaternion.identity();
    this.pivot.rotateY(yaw);
    this.shadow.position.set(0, -this.profile.radius + 0.004, 0);
    this.shadow.visible = true;
  }

  /** Follow a simulated body. */
  sync(b: BodyState, dt: number): void {
    const r = this.profile.radius;
    if (b.onSlide) {
      slideSurface(b.s, b.lateral, r, _v);
      this.root.position.copy(_v);
      slideNormal(b.s, _n);
      slideTangent(b.s, _t);
    } else {
      this.root.position.set(b.px, b.py, b.pz);
      _n.copy(_up);
      const speed = Math.hypot(b.vx, b.vz);
      if (speed > 0.05) this.forward.set(b.vx / speed, 0, b.vz / speed);
      _t.copy(this.forward);
    }
    _b.crossVectors(_t, _n).normalize();

    switch (this.profile.motion) {
      case 'roll':
        this.orientRoller(b, dt);
        break;
      default:
        this.orientSlider(b, dt);
    }

    for (const m of this.morphs) {
      if (m.morphTargetInfluences) m.morphTargetInfluences[0] = clamp(b.squash, 0, 1);
    }

    // Contact shadow tracks the surface, not the object, so it stays put while
    // a bouncing ball is in the air.
    const lift = b.onSlide ? 0 : Math.max(0, b.py - r);
    this.shadow.position.set(0, -r - lift + 0.006, 0);
    this.shadow.quaternion.copy(this.root.quaternion).invert();
    this.shadow.rotateX(-Math.PI / 2);
    const spread = 1 + clamp(lift * 2.2, 0, 1.1);
    this.shadow.scale.setScalar(Math.max(0.1, r * 5.2 * spread));
    (this.shadow.material as MeshBasicMaterial).opacity = 0.52 / spread;
  }

  private orientRoller(b: BodyState, _dt: number): void {
    // Roll axis is horizontal, perpendicular to travel.
    _q.setFromAxisAngle(_b.clone().negate(), b.spin);
    if (this.id === 'minicar') {
      // The body stays upright and points where it is going; only the wheels spin.
      const m = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), _t);
      const tilt = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), _n);
      this.pivot.quaternion.copy(tilt).multiply(m);
      for (const w of this.wheels) w.rotation.z = -b.spin;
    } else if (this.id === 'woodcyl') {
      // Keep the cylinder axis across the direction of travel.
      const align = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), _b);
      this.pivot.quaternion.copy(align).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -b.spin));
    } else {
      this.pivot.quaternion.copy(_q);
    }
  }

  private orientSlider(b: BodyState, dt: number): void {
    const base = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), _n);
    const heading = new Quaternion().setFromAxisAngle(_n, b.yaw);
    this.pivot.quaternion.copy(base).multiply(heading);

    if (this.id === 'leaf') {
      // Dry leaves skitter: a small, speed-linked flutter, not a tumble.
      const speed = b.onSlide ? b.v : Math.hypot(b.vx, b.vz);
      this.flutter = damp(this.flutter, clamp(speed * 0.55, 0, 1), 0.12, dt);
      const t = b.age * 9.5;
      const wobbleA = (noise1(t + b.seed * 0.13) - 0.5) * this.flutter * 0.85;
      const wobbleB = (noise1(t * 0.73 + 40 + b.seed * 0.07) - 0.5) * this.flutter * 0.6;
      this.pivot.rotateZ(wobbleA);
      this.pivot.rotateX(wobbleB);
    } else if (this.id === 'icedisc') {
      this.pivot.rotateY(b.spin * 0.2);
    }
  }

  dispose(): void {
    this.root.removeFromParent();
  }
}

function build(
  id: ObjectId,
  lib: MaterialLibrary,
  parent: Object3D,
  morphs: Mesh[],
  wheels: Object3D[],
  meshes: Mesh[],
  transmission: boolean,
): void {
  const add = (m: Mesh): Mesh => {
    parent.add(m);
    meshes.push(m);
    return m;
  };

  switch (id) {
    case 'steel': {
      const g = new SphereGeometry(0.036, 30, 20);
      add(new Mesh(g, lib.polishedMetal('#e9edef')));
      break;
    }
    case 'rubberball': {
      const g = new SphereGeometry(0.062, 28, 20);
      G.addSquashMorph(g, 0.34);
      const m = add(new Mesh(g, lib.rubber('#d8503c')));
      morphs.push(m);
      break;
    }
    case 'woodcyl': {
      const g = new CylinderGeometry(0.048, 0.048, 0.115, 30, 1);
      g.rotateX(Math.PI / 2);
      add(new Mesh(g, [lib.wood(), lib.woodEnd(), lib.woodEnd()]));
      break;
    }
    case 'feltbag': {
      const g = G.pouch(0.058, 0.033, 0.046);
      G.addSquashMorph(g, 0.4);
      const m = add(new Mesh(g, lib.felt()));
      morphs.push(m);
      // The gathered neck, tied off with a cord.
      const neck = new Mesh(new SphereGeometry(0.014, 12, 8), lib.matte('#8d6a3f', 0.85));
      neck.scale.set(1, 1.5, 1);
      neck.position.set(0.05, 0.024, 0);
      parent.add(neck);
      meshes.push(neck);
      break;
    }
    case 'minicar': {
      const body = add(new Mesh(G.roundedBox(0.108, 0.03, 0.05, 0.01, 4), lib.paint('#3f7fb8', 'car')));
      body.position.y = 0.007;
      const cabin = add(new Mesh(G.roundedBox(0.05, 0.024, 0.044, 0.009, 3), lib.paint('#3f7fb8', 'car')));
      cabin.position.set(-0.006, 0.028, 0);
      const glass = add(new Mesh(G.roundedBox(0.038, 0.016, 0.045, 0.006, 3), lib.matte('#1d2c33', 0.12, 0.2)));
      glass.position.set(-0.006, 0.03, 0);
      for (const x of [-0.033, 0.033]) {
        for (const z of [-0.027, 0.027]) {
          const w = new Mesh(G.wheel(0.02, 0.013), lib.tyre());
          w.position.set(x, 0, z);
          const hub = new Mesh(G.wheel(0.009, 0.015), lib.polishedMetal('#d6dade'));
          w.add(hub);
          parent.add(w);
          meshes.push(w, hub);
          wheels.push(w);
        }
      }
      break;
    }
    case 'icedisc': {
      const g = G.roundedDisc(0.058, 0.013);
      add(new Mesh(g, lib.ice(transmission)));
      break;
    }
    case 'leaf': {
      const g = G.leafBlade(0.17, 0.082);
      const m = add(new Mesh(g, lib.leaf()));
      m.position.y = -0.002;
      break;
    }
    case 'sponge': {
      const g = G.roundedBox(0.092, 0.052, 0.068, 0.014, 4);
      G.addSquashMorph(g, 0.45);
      const m = add(new Mesh(g, lib.sponge()));
      morphs.push(m);
      break;
    }
  }
}
