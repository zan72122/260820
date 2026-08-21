import * as THREE from 'three';
import { dustSprite, makeRng, soilAlbedo } from '../gfx/textures';
import type { Quality } from '../gfx/quality';

interface Clod {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  rot: THREE.Euler;
  scale: number;
  life: number;
  maxLife: number;
  alive: boolean;
  bounced: number;
}

interface Mote {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  alive: boolean;
}

/**
 * Falling soil. Pre-broken clods with cheap ballistics plus a pooled haze of
 * dust; no full particle physics anywhere, and the pool size is the second
 * thing to shrink when the frame budget gets tight.
 */
export class Debris {
  readonly group = new THREE.Group();
  private clodMesh: THREE.InstancedMesh;
  private clods: Clod[] = [];
  private moteMesh: THREE.InstancedMesh;
  private motes: Mote[] = [];
  private budget: number;
  private rng = makeRng(9001);
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private sv = new THREE.Vector3();
  onLand?: (size: number, wet: number) => void;

  constructor(quality: Quality) {
    this.budget = quality.particleBudget;
    const MAX = 200;

    const geo = new THREE.IcosahedronGeometry(0.032, 0);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const k = 0.55 + this.rng() * 0.9;
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.8, pos.getZ(i) * k);
    }
    geo.computeVertexNormals();
    const soil = soilAlbedo().clone();
    soil.repeat.set(3, 3);
    soil.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ map: soil, color: 0x8a7150, roughness: 1, flatShading: true });
    this.clodMesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.clodMesh.castShadow = true;
    this.clodMesh.frustumCulled = false;
    this.clodMesh.count = MAX;
    this.group.add(this.clodMesh);

    const moteMat = new THREE.MeshBasicMaterial({
      map: dustSprite(),
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
      color: 0xd9c6a4,
      fog: true,
    });
    this.moteMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), moteMat, MAX);
    this.moteMesh.frustumCulled = false;
    this.moteMesh.count = MAX;
    this.group.add(this.moteMesh);

    for (let i = 0; i < MAX; i++) {
      this.clods.push({
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        spin: new THREE.Vector3(),
        rot: new THREE.Euler(),
        scale: 1,
        life: 0,
        maxLife: 1,
        alive: false,
        bounced: 0,
      });
      this.motes.push({
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        size: 0.1,
        alive: false,
      });
      this.hideClod(i);
      this.hideMote(i);
    }

    quality.onChange(() => {
      this.budget = quality.particleBudget;
    });
  }

  private hideClod(i: number) {
    this.clodMesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
  }
  private hideMote(i: number) {
    this.moteMesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
  }

  private liveClods() {
    let n = 0;
    for (const c of this.clods) if (c.alive) n++;
    return n;
  }

  spawnClod(at: THREE.Vector3, size: number, wet: number, spread = 1) {
    if (this.liveClods() >= this.budget) return;
    const c = this.clods.find((x) => !x.alive);
    if (!c) return;
    c.alive = true;
    c.pos.copy(at);
    // damp soil falls as heavier lumps that do not bounce far
    c.vel.set(
      (this.rng() - 0.5) * 0.6 * spread,
      -0.1 - this.rng() * 0.3,
      (this.rng() - 0.5) * 0.6 * spread
    );
    c.spin.set((this.rng() - 0.5) * 9, (this.rng() - 0.5) * 9, (this.rng() - 0.5) * 9);
    c.rot.set(this.rng() * 6.28, this.rng() * 6.28, this.rng() * 6.28);
    c.scale = size * (0.6 + this.rng() * 0.8) * (0.85 + wet * 0.45);
    c.maxLife = 1.6 + this.rng() * 1.4;
    c.life = c.maxLife;
    c.bounced = wet > 0.5 ? 1 : 0;
    if (this.rng() < 0.5) this.spawnDust(at, 0.6);
  }

  spawnDust(at: THREE.Vector3, strength = 1) {
    const n = Math.min(3, Math.ceil(strength * 3));
    for (let k = 0; k < n; k++) {
      const mo = this.motes.find((x) => !x.alive);
      if (!mo) return;
      mo.alive = true;
      mo.pos.copy(at).add(new THREE.Vector3((this.rng() - 0.5) * 0.2, this.rng() * 0.08, (this.rng() - 0.5) * 0.2));
      mo.vel.set((this.rng() - 0.5) * 0.25, 0.12 + this.rng() * 0.22, (this.rng() - 0.5) * 0.25);
      mo.maxLife = 0.9 + this.rng() * 1.1;
      mo.life = mo.maxLife;
      mo.size = (0.1 + this.rng() * 0.16) * strength;
    }
  }

  update(dt: number, cameraQuat: THREE.Quaternion) {
    let dirty = false;
    for (let i = 0; i < this.clods.length; i++) {
      const c = this.clods[i];
      if (!c.alive) continue;
      dirty = true;
      c.life -= dt;
      c.vel.y -= 9.4 * dt;
      c.pos.addScaledVector(c.vel, dt);
      c.rot.x += c.spin.x * dt;
      c.rot.y += c.spin.y * dt;
      c.rot.z += c.spin.z * dt;
      const floor = 0.012 + c.scale * 0.02;
      if (c.pos.y < floor) {
        c.pos.y = floor;
        if (c.bounced < 2 && Math.abs(c.vel.y) > 0.6) {
          if (this.onLand) this.onLand(c.scale, c.bounced);
          c.vel.y *= -0.28;
          c.vel.x *= 0.55;
          c.vel.z *= 0.55;
          c.bounced++;
          c.spin.multiplyScalar(0.5);
          this.spawnDust(c.pos, 0.5);
        } else {
          c.vel.set(0, 0, 0);
          c.spin.multiplyScalar(0.9);
        }
      }
      const fade = Math.min(1, c.life / 0.5);
      if (c.life <= 0) {
        c.alive = false;
        this.hideClod(i);
        continue;
      }
      this.q.setFromEuler(c.rot);
      const s = c.scale * fade;
      this.sv.set(s, s, s);
      this.clodMesh.setMatrixAt(i, this.m.compose(c.pos, this.q, this.sv));
    }
    if (dirty) this.clodMesh.instanceMatrix.needsUpdate = true;

    let mdirty = false;
    for (let i = 0; i < this.motes.length; i++) {
      const mo = this.motes[i];
      if (!mo.alive) continue;
      mdirty = true;
      mo.life -= dt;
      mo.vel.y -= 0.12 * dt;
      mo.vel.multiplyScalar(1 - dt * 1.1);
      mo.pos.addScaledVector(mo.vel, dt);
      if (mo.life <= 0) {
        mo.alive = false;
        this.hideMote(i);
        continue;
      }
      const t = mo.life / mo.maxLife;
      const s = mo.size * (1.4 - t * 0.5);
      this.sv.set(s * t, s * t, s * t);
      this.moteMesh.setMatrixAt(i, this.m.compose(mo.pos, cameraQuat, this.sv));
    }
    if (mdirty) this.moteMesh.instanceMatrix.needsUpdate = true;
  }
}
