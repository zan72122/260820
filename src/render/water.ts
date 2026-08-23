import * as THREE from 'three';
import { makeStripeAlpha } from './materials';
import { makeRng } from '../core/math';

/**
 * Water as readable direction + contact, not a screen tint:
 * a thin ribbon mesh along the channel center path, foam particles only at
 * contacts and the landing point.
 */
export class WaterRibbon {
  mesh: THREE.Mesh;
  private geo: THREE.BufferGeometry;
  private mat: THREE.MeshBasicMaterial;
  private tex: THREE.CanvasTexture;
  private maxSections = 120;
  private positions: Float32Array;
  private uvs: Float32Array;
  visibleAmount = 0;

  constructor() {
    this.geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.maxSections * 2 * 3);
    this.uvs = new Float32Array(this.maxSections * 2 * 2);
    const indices: number[] = [];
    for (let i = 0; i < this.maxSections - 1; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo.setIndex(indices);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));
    this.tex = makeStripeAlpha();
    this.tex.repeat.set(1, 3);
    this.mat = new THREE.MeshBasicMaterial({
      color: 0xcfdcda,
      transparent: true,
      opacity: 0,
      alphaMap: this.tex,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.renderOrder = 5;
    this.mesh.frustumCulled = false;
  }

  /**
   * path: world points from top to bottom; cross sections are perpendicular
   * to the local flow direction so the ribbon can run down walls AND along
   * the L foot; width narrows slightly as the stream accelerates.
   */
  setPath(path: { x: number; y: number }[], z: number, baseWidth: number): void {
    const n = Math.min(path.length, this.maxSections);
    for (let i = 0; i < n; i++) {
      const p = path[i];
      const prev = path[Math.max(0, i - 1)];
      const next = path[Math.min(n - 1, i + 1)];
      let tx = next.x - prev.x;
      let ty = next.y - prev.y;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      // perpendicular in the xy plane
      const px = -ty;
      const py = tx;
      const w = baseWidth * (1 - 0.35 * (i / n));
      const o = i * 6;
      this.positions[o] = p.x - (px * w) / 2;
      this.positions[o + 1] = p.y - (py * w) / 2;
      this.positions[o + 2] = z;
      this.positions[o + 3] = p.x + (px * w) / 2;
      this.positions[o + 4] = p.y + (py * w) / 2;
      this.positions[o + 5] = z;
      const uo = i * 4;
      this.uvs[uo] = 0;
      this.uvs[uo + 1] = i / n;
      this.uvs[uo + 2] = 1;
      this.uvs[uo + 3] = i / n;
    }
    // collapse unused sections onto the last point
    const last = Math.max(0, (n - 1) * 6);
    for (let i = n; i < this.maxSections; i++) {
      const o = i * 6;
      for (let k = 0; k < 6; k++) this.positions[o + k] = this.positions[last + k];
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.uv.needsUpdate = true;
  }

  update(dt: number, target: number): void {
    this.visibleAmount += (target - this.visibleAmount) * Math.min(1, dt * 4);
    this.mat.opacity = 0.42 * this.visibleAmount;
    this.tex.offset.y -= dt * 2.6;
  }
}

interface Foam {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  life: number;
}

/** Small foam/spray burst system. Deterministic (seeded). */
export class FoamSystem {
  points: THREE.Points;
  private geo: THREE.BufferGeometry;
  private capacity: number;
  private pool: Foam[] = [];
  private positions: Float32Array;
  private rng = makeRng(4242);

  constructor(capacity = 90) {
    this.capacity = capacity;
    this.geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(capacity * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xeef3f2,
      size: 0.045,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
  }

  burst(x: number, y: number, z: number, count: number, speed: number): void {
    for (let i = 0; i < count; i++) {
      if (this.pool.length >= this.capacity) this.pool.shift();
      const a = this.rng() * Math.PI * 2;
      this.pool.push({
        x,
        y,
        z: z + (this.rng() - 0.5) * 0.08,
        vx: Math.cos(a) * speed * (0.3 + this.rng() * 0.7),
        vy: Math.abs(Math.sin(a)) * speed * (0.4 + this.rng() * 0.8),
        life: 0.4 + this.rng() * 0.35,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const f = this.pool[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.pool.splice(i, 1);
        continue;
      }
      f.vy -= 6 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
    }
    for (let i = 0; i < this.capacity; i++) {
      const o = i * 3;
      if (i < this.pool.length) {
        this.positions[o] = this.pool[i].x;
        this.positions[o + 1] = this.pool[i].y;
        this.positions[o + 2] = this.pool[i].z;
      } else {
        this.positions[o + 1] = -10;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.setDrawRange(0, Math.max(1, this.pool.length));
  }
}
