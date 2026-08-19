import * as THREE from 'three';
import { CONE, coneRadiusAt } from './flowerParams';
import { clamp } from '../util/math';

/**
 * The buttercream core: a lathe of revolution rebuilt as it grows, carrying the
 * spiral ridge the piping tip leaves behind and a softly rounded tip.
 */
export class ConeMesh {
  readonly mesh: THREE.Mesh;
  private rs: number;
  private hs: number;
  private pos: Float32Array;
  private nor: Float32Array;
  private uv: Float32Array;
  private thin: Float32Array;
  private geo = new THREE.BufferGeometry();
  height = 0;

  constructor(material: THREE.Material, fast = false) {
    this.rs = fast ? 20 : 30;
    this.hs = fast ? 12 : 20;
    const verts = (this.rs + 1) * (this.hs + 1);
    this.pos = new Float32Array(verts * 3);
    this.nor = new Float32Array(verts * 3);
    this.uv = new Float32Array(verts * 2);
    this.thin = new Float32Array(verts);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    this.geo.setAttribute('aThin', new THREE.BufferAttribute(this.thin, 1));
    this.geo.setIndex(new THREE.BufferAttribute(this.buildIndex(), 1));
    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.visible = false;
    this.setHeight(0);
  }

  private buildIndex(): Uint16Array {
    const idx = new Uint16Array(this.rs * this.hs * 6);
    let o = 0;
    for (let j = 0; j < this.hs; j++) {
      for (let i = 0; i < this.rs; i++) {
        const a = j * (this.rs + 1) + i;
        const b = a + 1;
        const c = a + this.rs + 1;
        const d = c + 1;
        idx[o++] = a; idx[o++] = c; idx[o++] = b;
        idx[o++] = b; idx[o++] = c; idx[o++] = d;
      }
    }
    return idx;
  }

  private radius(t: number, theta: number): number {
    const h = t * this.height;
    let r = coneRadiusAt(h, this.height) * Math.pow(1 - t * t * 0.55, 0.35);
    // spiral left by the round tip, ~4 mm of pitch
    const phase = theta + (h / 0.0042) * Math.PI * 2;
    r *= 1 + 0.05 * Math.sin(phase) * (1 - t * 0.5);
    r += 0.00012 * Math.sin(theta * 7 + h * 300);
    return Math.max(0.00004, r);
  }

  setHeight(h: number) {
    this.height = clamp(h, 0, CONE.maxHeight);
    this.mesh.visible = this.height > 0.0008;
    if (!this.mesh.visible) return;
    const { rs, hs } = this;
    for (let j = 0; j <= hs; j++) {
      const t = j / hs;
      for (let i = 0; i <= rs; i++) {
        const theta = (i / rs) * Math.PI * 2;
        const r = this.radius(t, theta);
        const k = (j * (rs + 1) + i) * 3;
        this.pos[k] = Math.cos(theta) * r;
        this.pos[k + 1] = t * this.height;
        this.pos[k + 2] = Math.sin(theta) * r;
        this.uv[(j * (rs + 1) + i) * 2] = i / rs;
        this.uv[(j * (rs + 1) + i) * 2 + 1] = t;
        this.thin[j * (rs + 1) + i] = 0.08 + t * t * 0.5;
      }
    }
    // analytic-ish normals from the lathe profile
    for (let j = 0; j <= hs; j++) {
      for (let i = 0; i <= rs; i++) {
        const idx = j * (rs + 1) + i;
        const jm = Math.max(0, j - 1);
        const jp = Math.min(hs, j + 1);
        const im = (i - 1 + rs) % rs;
        const ip = (i + 1) % rs;
        const a = (jp * (rs + 1) + i) * 3;
        const b = (jm * (rs + 1) + i) * 3;
        const c = (j * (rs + 1) + ip) * 3;
        const d = (j * (rs + 1) + im) * 3;
        const dux = this.pos[c] - this.pos[d];
        const duy = this.pos[c + 1] - this.pos[d + 1];
        const duz = this.pos[c + 2] - this.pos[d + 2];
        const dvx = this.pos[a] - this.pos[b];
        const dvy = this.pos[a + 1] - this.pos[b + 1];
        const dvz = this.pos[a + 2] - this.pos[b + 2];
        let nx = duy * dvz - duz * dvy;
        let ny = duz * dvx - dux * dvz;
        let nz = dux * dvy - duy * dvx;
        const l = Math.hypot(nx, ny, nz) || 1;
        nx /= l; ny /= l; nz /= l;
        // outward
        if (nx * this.pos[idx * 3] + nz * this.pos[idx * 3 + 2] < 0 && j < hs) {
          nx = -nx; ny = -ny; nz = -nz;
        }
        this.nor[idx * 3] = nx;
        this.nor[idx * 3 + 1] = ny;
        this.nor[idx * 3 + 2] = nz;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
    this.geo.attributes.uv.needsUpdate = true;
    this.geo.attributes.aThin.needsUpdate = true;
    this.geo.computeBoundingSphere();
  }

  bake(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.slice(), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor.slice(), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv.slice(), 2));
    g.setAttribute('aThin', new THREE.BufferAttribute(this.thin.slice(), 1));
    const src = this.geo.getIndex()!;
    g.setIndex(new THREE.BufferAttribute((src.array as Uint16Array).slice(), 1));
    g.computeBoundingSphere();
    return g;
  }
}
