/**
 * The little wooden cart, its rubber wheels, and the rope the child pulls.
 *
 * No wheel physics: a rig with a bounded speed, a yaw rate, a fore-aft rock and a wheel spin
 * that matches ground speed. The teacher walks alongside, so the cart can never run away.
 */

import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
  Vector3,
} from 'three';
import { cordTextures, metalTextures, rubberTextures, woodTextures } from '../util/textures';
import { NEBUTA } from '../nebuta/shape';
import { clamp, damp } from '../util/math';

const WHEEL_R = 0.145;

export class Cart {
  readonly group = new Group();
  /** Everything the nebuta is mounted on rocks with this node, the wheels do not. */
  readonly deckPivot = new Group();
  readonly ropeAnchor = new Group();
  private readonly wheels: Mesh[] = [];
  private readonly steer: Group[] = [];

  speed = 0;
  yawRate = 0;
  bob = 0;
  bobVel = 0;
  lean = 0;
  private wheelAngle = 0;
  private steerAngle = 0;

  constructor() {
    this.group.name = 'cart';
    const paint = woodTextures(512, { hueA: '#a8452f', hueB: '#6f2a1d', ringFreq: 9, wear: 0.5, seed: 91 });
    const bare = woodTextures(512, { hueA: '#c0a271', hueB: '#8a6a44', ringFreq: 13, wear: 0.35, seed: 17 });
    const metal = metalTextures(256);
    const rubber = rubberTextures(256);

    const paintMat = new MeshStandardMaterial({
      map: paint.map,
      normalMap: paint.normalMap,
      roughnessMap: paint.roughnessMap,
      roughness: 1,
      metalness: 0,
    });
    const bareMat = new MeshStandardMaterial({
      map: bare.map,
      normalMap: bare.normalMap,
      roughnessMap: bare.roughnessMap,
      roughness: 1,
      metalness: 0,
    });
    const metalMat = new MeshStandardMaterial({
      map: metal.map,
      normalMap: metal.normalMap,
      roughnessMap: metal.roughnessMap,
      color: new Color('#b9bcc2'),
      metalness: 0.88,
      roughness: 0.38,
    });
    const rubberMat = new MeshStandardMaterial({
      map: rubber.map,
      normalMap: rubber.normalMap,
      roughnessMap: rubber.roughnessMap,
      color: new Color('#4a4845'),
      metalness: 0.02,
      roughness: 1,
    });

    const deckTop = NEBUTA.deckY;
    const deck = new Mesh(new BoxGeometry(1.94, 0.062, 1.02), paintMat);
    deck.position.y = deckTop - 0.031;
    deck.castShadow = true;
    deck.receiveShadow = true;
    this.deckPivot.add(deck);

    for (const z of [0.47, -0.47]) {
      const rail = new Mesh(new BoxGeometry(1.9, 0.07, 0.05), paintMat);
      rail.position.set(0, deckTop + 0.032, z);
      rail.castShadow = true;
      rail.receiveShadow = true;
      this.deckPivot.add(rail);
    }
    for (const x of [0.95, -0.95]) {
      const rail = new Mesh(new BoxGeometry(0.05, 0.07, 0.99), paintMat);
      rail.position.set(x, deckTop + 0.032, 0);
      rail.castShadow = true;
      this.deckPivot.add(rail);
    }
    // corner brackets
    for (const x of [0.9, -0.9]) {
      for (const z of [0.44, -0.44]) {
        const br = new Mesh(new BoxGeometry(0.09, 0.09, 0.02), metalMat);
        br.position.set(x, deckTop + 0.02, z + Math.sign(z) * 0.02);
        this.deckPivot.add(br);
      }
    }
    // under-frame
    for (const z of [0.36, -0.36]) {
      const beam = new Mesh(new BoxGeometry(1.7, 0.07, 0.07), bareMat);
      beam.position.set(0, deckTop - 0.098, z);
      beam.castShadow = true;
      this.deckPivot.add(beam);
    }

    this.group.add(this.deckPivot);

    const tyreGeo = new TorusGeometry(WHEEL_R, 0.042, 8, 20);
    const hubGeo = new CylinderGeometry(0.055, 0.055, 0.05, 12);
    const spokeGeo = new BoxGeometry(0.012, WHEEL_R * 1.72, 0.022);
    for (const x of [0.66, -0.66]) {
      const axle = new Mesh(new CylinderGeometry(0.016, 0.016, 0.94, 8), metalMat);
      axle.rotation.x = Math.PI / 2;
      axle.position.set(x, WHEEL_R, 0);
      this.group.add(axle);
      const steerNode = new Group();
      steerNode.position.set(x, WHEEL_R, 0);
      this.group.add(steerNode);
      if (x > 0) this.steer.push(steerNode);
      for (const z of [0.47, -0.47]) {
        const wheel = new Mesh(tyreGeo, rubberMat);
        wheel.position.set(0, 0, z);
        wheel.rotation.y = Math.PI / 2;
        wheel.castShadow = true;
        wheel.receiveShadow = true;
        const hub = new Mesh(hubGeo, metalMat);
        hub.rotation.x = Math.PI / 2;
        wheel.add(hub);
        for (let s = 0; s < 3; s++) {
          const sp = new Mesh(spokeGeo, metalMat);
          sp.rotation.z = (s / 3) * Math.PI;
          wheel.add(sp);
        }
        steerNode.add(wheel);
        this.wheels.push(wheel);
      }
    }

    // the pull bar at the front, where the rope is knotted
    const bar = new Mesh(new CylinderGeometry(0.028, 0.028, 0.7, 10), bareMat);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(1.05, deckTop - 0.06, 0);
    bar.castShadow = true;
    this.deckPivot.add(bar);
    for (const z of [0.3, -0.3]) {
      const arm = new Mesh(new BoxGeometry(0.26, 0.05, 0.05), bareMat);
      arm.position.set(0.95, deckTop - 0.06, z);
      this.deckPivot.add(arm);
    }
    this.ropeAnchor.position.set(1.06, deckTop - 0.06, 0);
    this.deckPivot.add(this.ropeAnchor);
  }

  /** Advances the rig. `dt` is clamped by the caller. */
  update(dt: number): void {
    this.wheelAngle -= (this.speed / WHEEL_R) * dt;
    for (const w of this.wheels) w.rotation.x = this.wheelAngle;
    this.steerAngle = damp(this.steerAngle, clamp(this.yawRate * 0.55, -0.4, 0.4), 8, dt);
    for (const s of this.steer) s.rotation.y = this.steerAngle;

    // fore-aft rock, springy so a pull-and-release sets the nebuta swaying
    this.bobVel += (-this.bob * 34 - this.bobVel * 5.2) * dt;
    this.bob += this.bobVel * dt;
    this.bob = clamp(this.bob, -0.14, 0.14);
    this.deckPivot.rotation.z = this.bob * 0.6;
    this.deckPivot.position.y = -Math.abs(this.bob) * 0.02;
    this.deckPivot.rotation.x = damp(this.deckPivot.rotation.x, -this.lean * 0.35, 6, dt);
  }

  nudge(force: number): void {
    this.bobVel += force;
  }

  worldRopeAnchor(out = new Vector3()): Vector3 {
    return this.ropeAnchor.getWorldPosition(out);
  }

  reset(): void {
    this.speed = 0;
    this.yawRate = 0;
    this.bob = 0;
    this.bobVel = 0;
    this.lean = 0;
    this.group.position.set(0, 0, 0);
    this.group.rotation.set(0, 0, 0);
  }
}

/** The thick rope the child grabs: a sagging tube whose vertices are rewritten in place. */
export class Rope {
  readonly mesh: Mesh;
  private readonly material: MeshStandardMaterial;
  private readonly rings = 20;
  private readonly radial = 6;
  private readonly pos: Float32Array;
  private readonly nrm: Float32Array;

  constructor() {
    const cord = cordTextures(128);
    cord.map.repeat.set(1, 20);
    this.material = new MeshStandardMaterial({
      map: cord.map,
      normalMap: cord.normalMap,
      roughness: 0.92,
      metalness: 0,
      color: new Color('#e8dcc0'),
    });

    const count = (this.rings + 1) * (this.radial + 1);
    this.pos = new Float32Array(count * 3);
    this.nrm = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const index: number[] = [];
    for (let i = 0; i <= this.rings; i++) {
      for (let j = 0; j <= this.radial; j++) {
        const k = i * (this.radial + 1) + j;
        uv[k * 2] = j / this.radial;
        uv[k * 2 + 1] = i / this.rings;
      }
    }
    for (let i = 0; i < this.rings; i++) {
      for (let j = 0; j < this.radial; j++) {
        const a = i * (this.radial + 1) + j;
        const b = a + this.radial + 1;
        index.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new Float32BufferAttribute(this.nrm, 3));
    geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    geo.setIndex(index);
    this.mesh = new Mesh(geo, this.material);
    this.mesh.name = 'rope';
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
  }

  /** `tension` 0 = slack and hanging, 1 = pulled straight. */
  update(from: Vector3, to: Vector3, tension: number, radius = 0.021): void {
    const span = from.distanceTo(to);
    const sag = (0.3 * (1 - clamp(tension, 0, 1)) + 0.05) * span * 0.32;
    const ctrl = _v0.copy(from).add(to).multiplyScalar(0.5);
    ctrl.y -= sag;

    let prevN = _v3.set(0, 1, 0);
    for (let i = 0; i <= this.rings; i++) {
      const t = i / this.rings;
      const mt = 1 - t;
      _v1.set(
        mt * mt * from.x + 2 * mt * t * ctrl.x + t * t * to.x,
        mt * mt * from.y + 2 * mt * t * ctrl.y + t * t * to.y,
        mt * mt * from.z + 2 * mt * t * ctrl.z + t * t * to.z,
      );
      _v2
        .set(
          2 * mt * (ctrl.x - from.x) + 2 * t * (to.x - ctrl.x),
          2 * mt * (ctrl.y - from.y) + 2 * t * (to.y - ctrl.y),
          2 * mt * (ctrl.z - from.z) + 2 * t * (to.z - ctrl.z),
        )
        .normalize();
      // parallel transport keeps the cord twist stable frame to frame
      _v4.copy(prevN).addScaledVector(_v2, -prevN.dot(_v2));
      if (_v4.lengthSq() < 1e-8) _v4.set(_v2.z, _v2.x, _v2.y).cross(_v2);
      _v4.normalize();
      _v5.crossVectors(_v2, _v4).normalize();
      prevN = _v3.copy(_v4);
      const r = radius * (1 - 0.15 * Math.sin(Math.PI * t));
      for (let j = 0; j <= this.radial; j++) {
        const ang = (j / this.radial) * Math.PI * 2;
        const c = Math.cos(ang);
        const sn = Math.sin(ang);
        const nx = _v4.x * c + _v5.x * sn;
        const ny = _v4.y * c + _v5.y * sn;
        const nz = _v4.z * c + _v5.z * sn;
        const k = (i * (this.radial + 1) + j) * 3;
        this.pos[k] = _v1.x + nx * r;
        this.pos[k + 1] = _v1.y + ny * r;
        this.pos[k + 2] = _v1.z + nz * r;
        this.nrm[k] = nx;
        this.nrm[k + 1] = ny;
        this.nrm[k + 2] = nz;
      }
    }
    const g = this.mesh.geometry;
    g.getAttribute('position').needsUpdate = true;
    g.getAttribute('normal').needsUpdate = true;
    g.computeBoundingSphere();
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

const _v0 = new Vector3();
const _v1 = new Vector3();
const _v2 = new Vector3();
const _v3 = new Vector3();
const _v4 = new Vector3();
const _v5 = new Vector3();
