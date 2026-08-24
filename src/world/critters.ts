import * as THREE from 'three';
import { Rng, clamp, damp, lerp } from '../util/rng';
import { WaterSystem, injectMurkFog } from './water';
import { MurkSystem } from './murk';
import { POND_RADIUS } from './terrain';

// Small fish: dark shapes below the surface. Inside a murk filament they
// vanish; out of it they re-appear — one of the opening riddle's clues.
export class FishSchool {
  group = new THREE.Group();
  private fish: {
    root: THREE.Group;
    tail: THREE.Mesh;
    mat: THREE.MeshStandardMaterial;
    heading: number;
    speed: number;
    depth: number;
    phase: number;
    dartT: number;
  }[] = [];
  lively = false;

  constructor(
    scene: THREE.Scene,
    private water: WaterSystem,
    private murk: MurkSystem,
    private rng: Rng,
    private onDimple: (x: number, z: number) => void
  ) {
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x4c463c,
        roughness: 0.6,
        transparent: true,
        opacity: 0.85,
      });
      injectMurkFog(mat, water.fogUniforms);
      const root = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.06, 4, 8), mat);
      body.geometry.rotateZ(Math.PI / 2); // axis along X → we move along local +Z, so rotate to Z
      body.geometry.rotateY(Math.PI / 2);
      body.scale.set(0.6, 1, 1);
      root.add(body);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.035, 6), mat);
      tail.geometry.rotateX(Math.PI / 2);
      tail.position.z = -0.055;
      tail.scale.set(0.35, 1, 1);
      root.add(tail);
      const a = rng.next() * Math.PI * 2;
      const r = rng.range(0.3, 1.0);
      root.position.set(Math.cos(a) * r, rng.range(-0.16, -0.08), Math.sin(a) * r);
      this.fish.push({
        root,
        tail,
        mat,
        heading: rng.next() * Math.PI * 2,
        speed: rng.range(0.06, 0.1),
        depth: root.position.y,
        phase: rng.next() * 6.28,
        dartT: rng.range(4, 10),
      });
      this.group.add(root);
    }
    scene.add(this.group);
  }

  update(dt: number, time: number) {
    const c = new THREE.Vector3();
    for (const f of this.fish) {
      const speedMul = this.lively ? 2.1 : 1;
      f.heading += (Math.sin(time * 0.3 + f.phase) * 0.6 + Math.sin(time * 0.11 + f.phase * 2) * 0.4) * dt;
      // steer back toward the middle
      const r = Math.hypot(f.root.position.x, f.root.position.z);
      if (r > POND_RADIUS - 0.45) {
        const toCenter = Math.atan2(-f.root.position.x, -f.root.position.z);
        let diff = toCenter - f.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        f.heading += diff * dt * 1.5;
      }
      f.dartT -= dt;
      let sp = f.speed * speedMul;
      if (this.lively && f.dartT < 0.7 && f.dartT > 0) sp *= 3;
      if (f.dartT <= 0) {
        f.dartT = this.lively ? 3 + this.rng.next() * 4 : 6 + this.rng.next() * 8;
        if (this.lively) {
          this.onDimple(f.root.position.x, f.root.position.z);
        }
      }
      f.root.position.x += Math.sin(f.heading) * sp * dt * 10;
      f.root.position.z += Math.cos(f.heading) * sp * dt * 10;
      f.root.position.y = f.depth + Math.sin(time * 0.5 + f.phase) * 0.03;
      f.root.rotation.y = f.heading;
      f.tail.rotation.y = Math.sin(time * 8 * speedMul + f.phase) * 0.5;

      // hide inside murk filaments
      let hide = 0;
      for (const s of this.murk.streaks) {
        if (s.state === 'inactive' || s.state === 'gone' || s.state === 'absorb') continue;
        const d = s.centroid(c).distanceTo(f.root.position);
        const rad = s.len * 0.45;
        if (d < rad) hide = Math.max(hide, 1 - d / rad);
      }
      f.mat.opacity = damp(f.mat.opacity, 0.85 * (1 - hide * 0.95), 8, dt);
    }
  }
}

// A rabbit that comes to the water but will not drink — until it can.
export class Rabbit {
  group = new THREE.Group();
  private headPivot = new THREE.Group();
  private earL: THREE.Mesh;
  private earR: THREE.Mesh;
  private state: 'approach' | 'sit' | 'toWater' | 'drink' | 'sitAfter' = 'approach';
  private t = 0;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private hopPhase = 0;
  private lapCount = 0;

  constructor(
    scene: THREE.Scene,
    private terrainHeight: (x: number, z: number) => number,
    private onLap: () => void,
    private onRipple: (x: number, z: number) => void
  ) {
    const furMat = new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 0.95 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), furMat);
    body.scale.set(0.8, 0.9, 1.25);
    body.position.y = 0.085;
    body.castShadow = true;
    this.group.add(body);
    const haunch = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), furMat);
    haunch.position.set(0, 0.075, -0.06);
    haunch.scale.set(0.95, 1, 1);
    this.group.add(haunch);
    this.headPivot.position.set(0, 0.14, 0.09);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), furMat);
    head.scale.set(0.8, 0.9, 1.1);
    head.castShadow = true;
    this.headPivot.add(head);
    const earGeo = new THREE.CapsuleGeometry(0.012, 0.08, 3, 6);
    this.earL = new THREE.Mesh(earGeo, furMat);
    this.earL.position.set(-0.02, 0.08, -0.01);
    this.earL.rotation.z = -0.18;
    this.earL.scale.z = 0.5;
    this.headPivot.add(this.earL);
    this.earR = this.earL.clone();
    this.earR.position.x = 0.02;
    this.earR.rotation.z = 0.18;
    this.headPivot.add(this.earR);
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd8d0c2, roughness: 1 }));
    tail.position.set(0, 0.1, -0.13);
    this.group.add(tail);
    this.group.add(this.headPivot);

    this.from.set(3.4, 0, 2.9);
    this.to.set(1.6, 0, 1.35);
    this.group.position.copy(this.from);
    this.placeOnGround();
    this.group.lookAt(0, 0, 0);
    scene.add(this.group);
  }

  private placeOnGround() {
    this.group.position.y = this.terrainHeight(this.group.position.x, this.group.position.z);
  }

  // called once when the pond is fully cleared
  drinkNow() {
    if (this.state === 'sit') {
      this.state = 'toWater';
      this.t = 0;
      this.from.copy(this.group.position);
      const dir = this.group.position.clone().setY(0).normalize();
      this.to.copy(dir.multiplyScalar(POND_RADIUS + 0.18));
      this.lapCount = 0;
    }
  }

  reset() {
    this.state = 'approach';
    this.t = 0;
    this.from.set(3.4, 0, 2.9);
    this.to.set(1.6, 0, 1.35);
    this.group.position.copy(this.from);
    this.placeOnGround();
  }

  update(dt: number, time: number) {
    this.t += dt;
    const hopMove = (dur: number, next: 'sit' | 'drink') => {
      const k = clamp(this.t / dur, 0, 1);
      this.group.position.lerpVectors(this.from, this.to, k);
      this.placeOnGround();
      this.hopPhase += dt * 9;
      this.group.position.y += Math.abs(Math.sin(this.hopPhase)) * 0.06;
      const dir = this.to.clone().sub(this.from);
      this.group.rotation.y = Math.atan2(dir.x, dir.z);
      if (k >= 1) {
        this.state = next;
        this.t = 0;
        // face the water when arriving
        this.group.rotation.y = Math.atan2(-this.group.position.x, -this.group.position.z);
      }
    };
    switch (this.state) {
      case 'approach':
        hopMove(4.2, 'sit');
        break;
      case 'sit': {
        // alert but hesitant: sits, sniffs, does NOT drink
        this.headPivot.rotation.x = Math.sin(time * 0.7) * 0.06 - 0.05;
        this.earL.rotation.x = Math.sin(time * 1.3) * 0.1;
        this.earR.rotation.x = Math.sin(time * 1.1 + 1) * 0.1;
        break;
      }
      case 'toWater':
        hopMove(2.2, 'drink');
        break;
      case 'drink': {
        const cycle = this.t % 1.4;
        this.headPivot.rotation.x = cycle < 0.8 ? lerp(0, 0.9, Math.sin((cycle / 0.8) * Math.PI)) : 0;
        if (cycle > 0.35 && cycle < 0.45 && this.lapCount < 6 && this.t - 0 > 0.3) {
          if (Math.floor(this.t / 1.4) + 1 > this.lapCount) {
            this.lapCount++;
            this.onLap();
            const p = this.group.position;
            const dir = p.clone().setY(0).normalize().multiplyScalar(-0.25);
            this.onRipple(p.x + dir.x, p.z + dir.z);
          }
        }
        if (this.lapCount >= 6) {
          this.state = 'sitAfter';
          this.t = 0;
        }
        break;
      }
      case 'sitAfter':
        this.headPivot.rotation.x = damp(this.headPivot.rotation.x, -0.05, 3, dt);
        this.earL.rotation.x = Math.sin(time * 1.5) * 0.12;
        break;
    }
  }
}
