// Rain: a bounded pool of instanced streaks that fall ONLY beneath opened
// parts of the cloud. The very first release is 4 "hero" drops that fall a
// touch slower so a child's eye can ride them down. Impacts paint the wet
// mask, spawn a small splash, and ping the audio layer.

import * as THREE from 'three';
import { mulberry32, clamp } from './util';
import { terrainHeight, WetMask } from './world';

interface Drop {
  active: boolean;
  hero: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
}

interface Splash {
  active: boolean;
  pos: THREE.Vector3;
  age: number;
}

export class RainSystem {
  group = new THREE.Group();
  private drops: Drop[] = [];
  private streakMesh: THREE.InstancedMesh;
  private splashes: Splash[] = [];
  private splashMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private rand = mulberry32(99);
  private emitAcc = 0;
  maxDrops: number;
  activeCount = 0;
  totalLanded = 0;
  heroLanded = 0;
  heroActive = 0;
  onImpact?: (x: number, z: number, hero: boolean) => void;
  /** average world pos of live hero drops, for the camera to follow */
  heroFocus = new THREE.Vector3();

  constructor(quality: number) {
    this.maxDrops = quality > 0 ? 420 : 220;
    for (let i = 0; i < this.maxDrops; i++) {
      this.drops.push({ active: false, hero: false, pos: new THREE.Vector3(), vel: new THREE.Vector3() });
    }
    // streak: thin vertical quad, stretched by speed in update
    const quad = new THREE.PlaneGeometry(0.06, 1);
    quad.translate(0, -0.5, 0);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.74, 0.8, 0.9),
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.streakMesh = new THREE.InstancedMesh(quad, mat, this.maxDrops);
    this.streakMesh.frustumCulled = false;
    this.streakMesh.renderOrder = 15;
    this.group.add(this.streakMesh);

    const splashCount = quality > 0 ? 70 : 40;
    for (let i = 0; i < splashCount; i++) {
      this.splashes.push({ active: false, pos: new THREE.Vector3(), age: 0 });
    }
    const ring = new THREE.RingGeometry(0.06, 0.16, 10);
    ring.rotateX(-Math.PI / 2);
    const smat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.8, 0.85, 0.92),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    this.splashMesh = new THREE.InstancedMesh(ring, smat, splashCount);
    this.splashMesh.frustumCulled = false;
    this.splashMesh.renderOrder = 15;
    this.group.add(this.splashMesh);
  }

  /**
   * Fire the scripted first release: a handful of slow, readable drops.
   * Optional targets pin the first drops right above waiting plants so the
   * ground answer is guaranteed, not left to scatter luck.
   */
  releaseHero(from: THREE.Vector3, count = 4, targets: THREE.Vector3[] = []) {
    let fired = 0;
    for (const d of this.drops) {
      if (d.active) continue;
      d.active = true;
      d.hero = true;
      const t = targets[fired];
      if (t) {
        // start above the target, compensating the slight forward drift
        d.pos.set(t.x + (this.rand() - 0.5) * 0.3, from.y - 1.2, t.z - 0.5);
      } else {
        d.pos.set(
          from.x + (this.rand() - 0.5) * 1.6,
          from.y - 1.2 - this.rand() * 0.6,
          from.z + (this.rand() - 0.5) * 1.2 + 0.8
        );
      }
      d.vel.set((this.rand() - 0.5) * 0.3, -3.2 - this.rand() * 0.8, 0.35);
      if (++fired >= count) break;
    }
    this.heroActive += fired;
  }

  /**
   * Continuous emission under an open region.
   * rate: drops/sec, spread: half-width in x, thick: momentary heavy streak.
   */
  emit(center: THREE.Vector3, rate: number, spread: number, dt: number) {
    this.emitAcc += rate * dt;
    let n = Math.floor(this.emitAcc);
    this.emitAcc -= n;
    for (const d of this.drops) {
      if (n <= 0) break;
      if (d.active) continue;
      d.active = true;
      d.hero = false;
      d.pos.set(
        center.x + (this.rand() - 0.5) * 2 * spread,
        center.y - 0.8 - this.rand() * 1.6,
        center.z + (this.rand() - 0.5) * 2.4 + 1.2
      );
      d.vel.set((this.rand() - 0.5) * 0.4, -9 - this.rand() * 4, 0.6 + this.rand() * 0.5);
      n--;
    }
  }

  update(dt: number, wet: WetMask) {
    let count = 0;
    let hx = 0, hy = 0, hz = 0, hn = 0;
    for (const d of this.drops) {
      if (!d.active) continue;
      if (d.hero) d.vel.y = Math.max(d.vel.y - 4.5 * dt, -6.5);
      else d.vel.y = Math.max(d.vel.y - 22 * dt, -16);
      d.pos.addScaledVector(d.vel, dt);
      const ground = terrainHeight(d.pos.x, d.pos.z);
      if (d.pos.y <= ground) {
        d.active = false;
        this.totalLanded++;
        if (d.hero) { this.heroLanded++; this.heroActive--; }
        wet.splat(d.pos.x, d.pos.z, d.hero ? 2.4 : 1.1, d.hero ? 0.6 : 0.16);
        this.spawnSplash(d.pos.x, ground + 0.03, d.pos.z);
        this.onImpact?.(d.pos.x, d.pos.z, d.hero);
        continue;
      }
      if (d.hero) { hx += d.pos.x; hy += d.pos.y; hz += d.pos.z; hn++; }
      const speed = -d.vel.y;
      this.dummy.position.copy(d.pos);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(d.hero ? 2.8 : 1.2, clamp(speed * 0.075, 0.3, 1.3) * (d.hero ? 1.7 : 1), 1);
      this.dummy.updateMatrix();
      this.streakMesh.setMatrixAt(count++, this.dummy.matrix);
    }
    this.activeCount = count;
    this.streakMesh.count = count;
    this.streakMesh.instanceMatrix.needsUpdate = true;
    if (hn > 0) this.heroFocus.set(hx / hn, hy / hn, hz / hn);

    let sc = 0;
    for (const s of this.splashes) {
      if (!s.active) continue;
      s.age += dt;
      if (s.age > 0.45) { s.active = false; continue; }
      const t = s.age / 0.45;
      this.dummy.position.copy(s.pos);
      this.dummy.rotation.set(0, 0, 0);
      const sscale = 0.5 + t * 2.2;
      this.dummy.scale.set(sscale, 1, sscale);
      this.dummy.updateMatrix();
      this.splashMesh.setMatrixAt(sc++, this.dummy.matrix);
    }
    this.splashMesh.count = sc;
    this.splashMesh.instanceMatrix.needsUpdate = true;
    (this.splashMesh.material as THREE.MeshBasicMaterial).opacity = 0.35;
  }

  private spawnSplash(x: number, y: number, z: number) {
    for (const s of this.splashes) {
      if (s.active) continue;
      s.active = true;
      s.pos.set(x, y, z);
      s.age = 0;
      return;
    }
  }
}
