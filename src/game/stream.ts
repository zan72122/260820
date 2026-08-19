import * as THREE from 'three';
import { makeLiquidMaterial } from './glazeMesh';
import { clamp } from '../core/util';

const RINGS = 30;
const RADIAL = 8;
const G = -3.4; // gentler than real gravity: thick, syrupy fall

/**
 * The pouring stream: a real tube of geometry rebuilt every frame along the
 * ballistic path from the beak to the impact point. It thins as it accelerates
 * and swells again where it lands, which is what sells the viscosity.
 */
export class PourStream {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshPhysicalMaterial;
  private geo: THREE.BufferGeometry;
  private pos: THREE.BufferAttribute;
  private nor: THREE.BufferAttribute;
  private head = 0;
  private tail = 0;
  private phase = 0;
  private spout = new THREE.Vector3();
  private impact = new THREE.Vector3();
  private flight = 0.3;
  radius = 0.0092;

  constructor() {
    const verts = RINGS * RADIAL;
    const p = new Float32Array(verts * 3);
    const n = new Float32Array(verts * 3);
    const idx: number[] = [];
    for (let i = 0; i < RINGS - 1; i++) {
      for (let j = 0; j < RADIAL; j++) {
        const a = i * RADIAL + j;
        const b = i * RADIAL + ((j + 1) % RADIAL);
        const c = a + RADIAL;
        const d = b + RADIAL;
        idx.push(a, c, b, b, c, d);
      }
    }
    this.geo = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(p, 3);
    this.nor = new THREE.BufferAttribute(n, 3);
    this.pos.setUsage(THREE.DynamicDrawUsage);
    this.nor.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.pos);
    this.geo.setAttribute('normal', this.nor);
    this.geo.setIndex(idx);
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.1, 0), 1.5);

    this.material = makeLiquidMaterial(0xffffff);
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 4;
  }

  setColor(c: THREE.Color) {
    this.material.color.copy(c);
  }

  get flowing() {
    return this.head > this.tail;
  }

  /** how much of the stream has actually reached the cake (0..1) */
  get contact() {
    return clamp((this.head - 0.98) * 40, 0, 1) * (1 - clamp(this.tail * 1.2, 0, 1));
  }

  update(
    dt: number,
    pouring: boolean,
    spout: THREE.Vector3,
    impact: THREE.Vector3,
    strength: number
  ) {
    this.phase += dt;
    this.spout.copy(spout);
    this.impact.copy(impact);

    if (pouring) {
      this.tail = Math.max(0, this.tail - dt * 6);
      this.head = Math.min(1, this.head + dt * 4.2);
    } else {
      if (this.head >= 1) this.tail = Math.min(1, this.tail + dt * 2.1);
      else this.head = Math.max(0, this.head - dt * 2.6);
    }

    const alive = this.head > 0.001 && this.tail < this.head;
    this.mesh.visible = alive;
    if (!alive) {
      if (this.tail >= 1) {
        this.tail = 0;
        this.head = 0;
      }
      return;
    }

    // solve the ballistic flight time from the vertical drop
    const drop = Math.max(0.02, spout.y - impact.y);
    const v0y = -0.22;
    this.flight = (-v0y + Math.sqrt(v0y * v0y + 2 * -G * drop)) / -G;
    const T = this.flight;
    const vx = (impact.x - spout.x) / T;
    const vz = (impact.z - spout.z) / T;

    const r0 = this.radius * (0.62 + 0.38 * strength);
    const speed0 = Math.hypot(vx, vz, v0y) || 0.3;

    const tan = new THREE.Vector3();
    const bin = new THREE.Vector3();
    const nrm = new THREE.Vector3();
    const cur = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < RINGS; i++) {
      const s = i / (RINGS - 1);
      const sv = THREE.MathUtils.lerp(this.tail, this.head, s);
      const t = sv * T;
      cur.set(spout.x + vx * t, spout.y + v0y * t + 0.5 * G * t * t, spout.z + vz * t);

      tan.set(vx, v0y + G * t, vz).normalize();
      bin.crossVectors(tan, up);
      if (bin.lengthSq() < 1e-6) bin.set(1, 0, 0);
      bin.normalize();
      nrm.crossVectors(bin, tan).normalize();

      const speed = Math.hypot(vx, v0y + G * t, vz);
      let r = r0 * Math.sqrt(speed0 / Math.max(speed, 0.05));
      // taper at the beak, swell where it lands
      r *= 0.65 + 0.35 * THREE.MathUtils.smoothstep(sv, 0, 0.1);
      r *= 1 + 1.05 * THREE.MathUtils.smoothstep(sv, 0.88, 1.0) * this.contact;
      if (sv >= 0.999) r *= 1.15;
      // slow ripple travelling down the stream
      r *= 1 + 0.11 * Math.sin(sv * 26 - this.phase * 9);

      const wob = 0.0016 * Math.sin(sv * 9 - this.phase * 5.5) * (1 - this.contact * 0.6);

      for (let j = 0; j < RADIAL; j++) {
        const a = (j / RADIAL) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const nx = bin.x * ca + nrm.x * sa;
        const ny = bin.y * ca + nrm.y * sa;
        const nz = bin.z * ca + nrm.z * sa;
        const o = (i * RADIAL + j) * 3;
        this.pos.array[o] = cur.x + nx * r + bin.x * wob;
        this.pos.array[o + 1] = cur.y + ny * r;
        this.pos.array[o + 2] = cur.z + nz * r + bin.z * wob;
        this.nor.array[o] = nx;
        this.nor.array[o + 1] = ny;
        this.nor.array[o + 2] = nz;
      }
    }
    this.pos.needsUpdate = true;
    this.nor.needsUpdate = true;
  }

  reset() {
    this.head = 0;
    this.tail = 0;
    this.mesh.visible = false;
  }
}
