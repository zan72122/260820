import * as THREE from 'three';
import { Materials } from '../gfx/materials';
import { clodGeometry } from '../gfx/geo';
import { makeRng } from '../gfx/noise';
import { buildLeafClumpGeometry } from '../world/DaikonModel';

const GRAV = 9.81;

interface Clod {
  p: THREE.Vector3;
  v: THREE.Vector3;
  spin: THREE.Vector3;
  rot: THREE.Euler;
  life: number;
  maxLife: number;
  scale: number;
  rest: number;
}

export class Effects {
  readonly group = new THREE.Group();

  private clods: THREE.InstancedMesh;
  private clodData: Clod[] = [];
  private clodDummy = new THREE.Object3D();
  private clodNext = 0;

  private puffs: THREE.Sprite[] = [];
  private puffLife: number[] = [];
  private puffNext = 0;

  private cracks: THREE.Mesh[] = [];
  private crackState: Array<{ t: number; dur: number; size: number }> = [];
  private crackNext = 0;

  private heaves: THREE.Mesh[] = [];
  private heaveOwner: Array<{ active: boolean }> = [];

  private litter: THREE.Mesh[] = [];
  private litterData: Array<{ v: THREE.Vector3; spin: THREE.Vector3; life: number; rest: number }> = [];
  private litterNext = 0;

  private rng = makeRng(31337);

  constructor(mats: Materials) {
    const geo = clodGeometry(0.019, makeRng(9));
    this.clods = new THREE.InstancedMesh(geo, mats.clod, 110);
    this.clods.frustumCulled = false;
    this.clods.count = 110;
    this.clods.castShadow = false;
    this.group.add(this.clods);
    for (let i = 0; i < 110; i++) {
      this.clodData.push({
        p: new THREE.Vector3(0, -100, 0),
        v: new THREE.Vector3(),
        spin: new THREE.Vector3(),
        rot: new THREE.Euler(),
        life: 0,
        maxLife: 1,
        scale: 1,
        rest: 0,
      });
    }
    this.flushClods();

    for (let i = 0; i < 22; i++) {
      const s = new THREE.Sprite(mats.dustSprite.clone());
      s.visible = false;
      this.puffs.push(s);
      this.puffLife.push(0);
      this.group.add(s);
    }

    const crackGeo = new THREE.PlaneGeometry(1, 1);
    crackGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(crackGeo, mats.crackDecal.clone());
      m.visible = false;
      m.renderOrder = 3;
      this.cracks.push(m);
      this.crackState.push({ t: 0, dur: 1, size: 0.3 });
      this.group.add(m);
    }

    const heaveGeo = new THREE.CylinderGeometry(0.046, 0.064, 0.04, 12, 1, true);
    for (let i = 0; i < 6; i++) {
      const hm = mats.bedSection.clone();
      hm.transparent = true;
      hm.depthWrite = false;
      const m = new THREE.Mesh(heaveGeo, hm);
      m.visible = false;
      this.heaves.push(m);
      this.heaveOwner.push({ active: false });
      this.group.add(m);
    }

    const leafGeo = buildLeafClumpGeometry('low', 5150);
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(leafGeo, mats.leafCut);
      m.visible = false;
      m.castShadow = true;
      this.litter.push(m);
      this.litterData.push({ v: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0, rest: 0 });
      this.group.add(m);
    }
  }

  private flushClods() {
    for (let i = 0; i < this.clodData.length; i++) {
      const c = this.clodData[i];
      this.clodDummy.position.copy(c.p);
      this.clodDummy.rotation.copy(c.rot);
      this.clodDummy.scale.setScalar(c.life > 0 ? c.scale : 0.0001);
      this.clodDummy.updateMatrix();
      this.clods.setMatrixAt(i, this.clodDummy.matrix);
    }
    this.clods.instanceMatrix.needsUpdate = true;
  }

  /** A spray of soil from a point, biased upward and outward. */
  soilBurst(at: THREE.Vector3, count: number, power: number, restY: number) {
    for (let i = 0; i < count; i++) {
      const c = this.clodData[this.clodNext];
      this.clodNext = (this.clodNext + 1) % this.clodData.length;
      const a = this.rng() * Math.PI * 2;
      const r = 0.2 + this.rng() * 0.9;
      c.p.set(at.x + Math.cos(a) * 0.03, at.y + this.rng() * 0.05, at.z + Math.sin(a) * 0.03);
      c.v.set(Math.cos(a) * r * power, (0.8 + this.rng() * 1.5) * power, Math.sin(a) * r * power);
      c.spin.set((this.rng() - 0.5) * 18, (this.rng() - 0.5) * 18, (this.rng() - 0.5) * 18);
      c.rot.set(this.rng() * 6.3, this.rng() * 6.3, this.rng() * 6.3);
      c.maxLife = 1.0 + this.rng() * 0.85;
      c.life = c.maxLife;
      c.scale = 0.5 + this.rng() * 1.0;
      c.rest = restY;
    }
  }

  /** A slow, low crumble — used while the share works the ridge. */
  soilTrickle(at: THREE.Vector3, restY: number) {
    const c = this.clodData[this.clodNext];
    this.clodNext = (this.clodNext + 1) % this.clodData.length;
    const a = this.rng() * Math.PI * 2;
    c.p.set(at.x + (this.rng() - 0.5) * 0.24, at.y + 0.02, at.z + (this.rng() - 0.5) * 0.1);
    c.v.set(Math.cos(a) * 0.22, 0.5 + this.rng() * 0.5, Math.sin(a) * 0.22 - 0.2);
    c.spin.set((this.rng() - 0.5) * 8, (this.rng() - 0.5) * 8, (this.rng() - 0.5) * 8);
    c.rot.set(this.rng() * 6.3, this.rng() * 6.3, this.rng() * 6.3);
    c.maxLife = 0.9;
    c.life = 0.9;
    c.scale = 0.3 + this.rng() * 0.4;
    c.rest = restY;
  }

  dust(at: THREE.Vector3, size: number, life = 0.8) {
    const s = this.puffs[this.puffNext];
    this.puffLife[this.puffNext] = life;
    this.puffNext = (this.puffNext + 1) % this.puffs.length;
    s.position.copy(at);
    s.scale.set(size, size, 1);
    s.visible = true;
    (s.material as THREE.SpriteMaterial).opacity = 0.55;
    s.userData.size = size;
    s.userData.life = life;
  }

  /** Fissure that opens around the crown as the grip takes hold. */
  crack(at: THREE.Vector3, dur: number, size: number): void {
    const m = this.cracks[this.crackNext];
    const st = this.crackState[this.crackNext];
    this.crackNext = (this.crackNext + 1) % this.cracks.length;
    m.position.copy(at);
    m.rotation.y = this.rng() * 6.28;
    m.visible = true;
    st.t = 0;
    st.dur = dur;
    st.size = size;
  }

  /** Soil collar that lifts with the shoulder then slumps back. */
  acquireHeave(): number {
    for (let i = 0; i < this.heaves.length; i++) {
      if (!this.heaveOwner[i].active) {
        this.heaveOwner[i].active = true;
        this.heaves[i].visible = true;
        return i;
      }
    }
    return -1;
  }

  setHeave(id: number, at: THREE.Vector3, lift: number, fade: number) {
    if (id < 0) return;
    const m = this.heaves[id];
    m.position.set(at.x, at.y + lift, at.z);
    const s = 1 + lift * 1.4;
    m.scale.set(s, 1 + lift * 3.2, s);
    (m.material as THREE.Material).opacity = fade * 0.85;
  }

  releaseHeave(id: number) {
    if (id < 0) return;
    this.heaveOwner[id].active = false;
    this.heaves[id].visible = false;
  }

  /** Throw the severed leaf bundle clear of the machine. */
  throwLeaves(at: THREE.Vector3, vel: THREE.Vector3, scale: number) {
    const m = this.litter[this.litterNext];
    const d = this.litterData[this.litterNext];
    this.litterNext = (this.litterNext + 1) % this.litter.length;
    m.position.copy(at);
    m.rotation.set(this.rng() * 6.3, this.rng() * 6.3, this.rng() * 6.3);
    m.scale.setScalar(scale);
    m.visible = true;
    d.v.copy(vel);
    d.spin.set((this.rng() - 0.5) * 9, (this.rng() - 0.5) * 6, (this.rng() - 0.5) * 9);
    d.life = 7;
    d.rest = 0.02;
  }

  update(dt: number) {
    let dirty = false;
    for (const c of this.clodData) {
      if (c.life <= 0) continue;
      dirty = true;
      c.life -= dt;
      c.v.y -= GRAV * dt;
      c.p.addScaledVector(c.v, dt);
      c.rot.x += c.spin.x * dt;
      c.rot.y += c.spin.y * dt;
      c.rot.z += c.spin.z * dt;
      if (c.p.y < c.rest) {
        c.p.y = c.rest;
        c.v.y *= -0.24;
        c.v.x *= 0.5;
        c.v.z *= 0.5;
        c.spin.multiplyScalar(0.4);
        if (Math.abs(c.v.y) < 0.32) {
          c.v.set(0, 0, 0);
          c.spin.set(0, 0, 0);
        }
      }
      if (c.life <= 0) c.p.y = -100;
    }
    if (dirty) this.flushClods();

    for (let i = 0; i < this.puffs.length; i++) {
      if (this.puffLife[i] <= 0) continue;
      this.puffLife[i] -= dt;
      const s = this.puffs[i];
      const total = s.userData.life as number;
      const k = 1 - this.puffLife[i] / total;
      const size = (s.userData.size as number) * (1 + k * 1.5);
      s.scale.set(size, size, 1);
      s.position.y += dt * 0.22;
      (s.material as THREE.SpriteMaterial).opacity = 0.55 * (1 - k) * (1 - k);
      if (this.puffLife[i] <= 0) s.visible = false;
    }

    for (let i = 0; i < this.cracks.length; i++) {
      const m = this.cracks[i];
      if (!m.visible) continue;
      const st = this.crackState[i];
      st.t += dt;
      const k = Math.min(1, st.t / st.dur);
      const grow = Math.min(1, k * 3.2);
      const s = st.size * (0.35 + grow * 0.65);
      m.scale.set(s, 1, s);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.92 * Math.min(1, grow * 2) * (1 - Math.max(0, (k - 0.75) / 0.25));
      if (k >= 1) m.visible = false;
    }

    for (let i = 0; i < this.litter.length; i++) {
      const m = this.litter[i];
      if (!m.visible) continue;
      const d = this.litterData[i];
      d.life -= dt;
      if (d.life <= 0) {
        m.visible = false;
        continue;
      }
      if (m.position.y > d.rest) {
        d.v.y -= GRAV * 0.55 * dt;
        m.position.addScaledVector(d.v, dt);
        m.rotation.x += d.spin.x * dt;
        m.rotation.y += d.spin.y * dt;
        m.rotation.z += d.spin.z * dt;
        if (m.position.y <= d.rest) {
          m.position.y = d.rest;
          m.rotation.x = Math.PI * 0.5 + (this.rng() - 0.5) * 0.3;
          m.rotation.z = (this.rng() - 0.5) * 0.4;
          d.v.set(0, 0, 0);
        }
      }
    }
  }

  reset() {
    for (const c of this.clodData) {
      c.life = 0;
      c.p.set(0, -100, 0);
    }
    this.flushClods();
    for (let i = 0; i < this.puffs.length; i++) {
      this.puffLife[i] = 0;
      this.puffs[i].visible = false;
    }
    for (const m of this.cracks) m.visible = false;
    for (let i = 0; i < this.heaves.length; i++) this.releaseHeave(i);
    for (const m of this.litter) m.visible = false;
  }
}
