/* Pooled effects: water rings, droplets, ice crystals, bubbles, sparkles.
   The two moments this game lives on — the hole opening and the fish
   popping out — are mostly built from these. */
import * as THREE from 'three';
import { softDot, ringSprite } from './textures.js';

export class Fx {
  constructor(scene) {
    this.scene = scene;
    const dot = softDot(64);
    const ring = ringSprite(128);

    // --- expanding surface rings -------------------------------------
    this.rings = [];
    const ringGeo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        map: ring, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      m.renderOrder = 14;
      scene.add(m);
      this.rings.push({ m, life: 0, ttl: 1, r0: 0.1, r1: 1, col: new THREE.Color() });
    }
    this.ri = 0;

    // --- droplets / crystals / bubbles --------------------------------
    this.parts = [];
    for (let i = 0; i < 190; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: dot, transparent: true, opacity: 0, depthWrite: false, fog: true,
      }));
      s.visible = false;
      s.renderOrder = 15;
      scene.add(s);
      this.parts.push({
        s, life: 0, ttl: 1, vel: new THREE.Vector3(),
        g: -3.2, size0: 0.02, size1: 0.02, fade: 1, spin: 0,
      });
    }
    this.pi = 0;

    // --- solid ice chips (real geometry, they read as chunks) ---------
    const chipGeo = new THREE.TetrahedronGeometry(1, 0);
    const chipMat = new THREE.MeshStandardMaterial({
      color: 0xeaf6ff, roughness: 0.5, metalness: 0, flatShading: true,
    });
    this.chips = new THREE.InstancedMesh(chipGeo, chipMat, 46);
    this.chips.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.chips.frustumCulled = false;
    this.chips.count = 46;
    scene.add(this.chips);
    this._chipDummy = new THREE.Object3D();
    this.chipState = [];
    for (let i = 0; i < 46; i++) {
      this.chipState.push({
        alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(),
        rot: new THREE.Euler(), rv: new THREE.Vector3(), s: 0.01, life: 0, ttl: 1,
      });
    }
    this._hideChips();
  }
  _hideChips() {
    const d = this._chipDummy;
    d.position.set(0, -9999, 0); d.scale.setScalar(0.0001); d.updateMatrix();
    for (let i = 0; i < this.chips.count; i++) this.chips.setMatrixAt(i, d.matrix);
    this.chips.instanceMatrix.needsUpdate = true;
  }

  ring(pos, { color = 0xffffff, r0 = 0.05, r1 = 0.7, ttl = 0.9, opacity = 0.9 } = {}) {
    const e = this.rings[this.ri++ % this.rings.length];
    e.m.visible = true;
    e.m.position.copy(pos);
    e.life = 0; e.ttl = ttl; e.r0 = r0; e.r1 = r1; e.op = opacity;
    e.m.material.color.set(color);
    return e;
  }

  spray(pos, n, {
    color = 0xdff2ff, speed = 1.4, up = 1.6, spread = 1, g = -3.2,
    size0 = 0.014, size1 = 0.03, ttl = 0.9, opacity = 0.95, fog = true,
  } = {}) {
    for (let k = 0; k < n; k++) {
      const p = this.parts[this.pi++ % this.parts.length];
      p.s.visible = true;
      p.s.position.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      p.vel.set(Math.cos(a) * r * speed, up * (0.55 + Math.random() * 0.9), Math.sin(a) * r * speed);
      p.g = g;
      p.life = 0; p.ttl = ttl * (0.7 + Math.random() * 0.6);
      p.size0 = size0 * (0.6 + Math.random() * 0.8);
      p.size1 = size1 * (0.6 + Math.random() * 0.8);
      p.fade = opacity;
      p.s.material.color.set(color);
      p.s.material.fog = fog;
      p.s.material.blending = THREE.NormalBlending;
      p.s.scale.setScalar(p.size0);
    }
  }

  sparkle(pos, n = 12, color = 0xfff3c4) {
    this.spray(pos, n, {
      color, speed: 0.9, up: 1.0, spread: 1, g: -1.4,
      size0: 0.03, size1: 0.001, ttl: 0.85, opacity: 1,
    });
    for (let k = 0; k < n; k++) {
      const p = this.parts[(this.pi - 1 - k + this.parts.length * 2) % this.parts.length];
      p.s.material.blending = THREE.AdditiveBlending;
    }
  }

  bubbles(pos, n = 8, spread = 0.06) {
    for (let k = 0; k < n; k++) {
      const p = this.parts[this.pi++ % this.parts.length];
      p.s.visible = true;
      p.s.position.set(
        pos.x + (Math.random() - 0.5) * spread,
        pos.y + (Math.random() - 0.5) * spread,
        pos.z + (Math.random() - 0.5) * spread);
      p.vel.set((Math.random() - 0.5) * 0.08, 0.16 + Math.random() * 0.26, (Math.random() - 0.5) * 0.08);
      p.g = 0.22;
      p.life = 0; p.ttl = 1.4 + Math.random() * 1.4;
      p.size0 = 0.006 + Math.random() * 0.009;
      p.size1 = p.size0 * 1.35;
      p.fade = 0.62;
      p.s.material.color.set(0xd6f0ff);
      p.s.material.blending = THREE.NormalBlending;
      p.s.material.fog = true;
      p.s.scale.setScalar(p.size0);
    }
  }

  iceChips(pos, n = 20, { speed = 1.1, up = 2.0, size = 0.014 } = {}) {
    let spawned = 0;
    for (const c of this.chipState) {
      if (spawned >= n) break;
      if (c.alive) continue;
      c.alive = true;
      c.p.copy(pos).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.12, Math.random() * 0.04, (Math.random() - 0.5) * 0.12));
      const a = Math.random() * Math.PI * 2, r = Math.random();
      c.v.set(Math.cos(a) * r * speed, up * (0.4 + Math.random()), Math.sin(a) * r * speed);
      c.rv.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
      c.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      c.s = size * (0.5 + Math.random());
      c.life = 0; c.ttl = 1.6 + Math.random() * 1.2;
      spawned++;
    }
  }

  update(dt) {
    for (const e of this.rings) {
      if (!e.m.visible) continue;
      e.life += dt;
      const t = e.life / e.ttl;
      if (t >= 1) { e.m.visible = false; continue; }
      const r = THREE.MathUtils.lerp(e.r0, e.r1, 1 - Math.pow(1 - t, 2.4));
      e.m.scale.set(r * 2, r * 2, 1);
      e.m.material.opacity = (e.op ?? 0.9) * (1 - t) * (1 - t);
    }
    for (const p of this.parts) {
      if (!p.s.visible) continue;
      p.life += dt;
      const t = p.life / p.ttl;
      if (t >= 1) { p.s.visible = false; continue; }
      p.vel.y += p.g * dt;
      p.s.position.addScaledVector(p.vel, dt);
      p.s.scale.setScalar(THREE.MathUtils.lerp(p.size0, p.size1, t));
      p.s.material.opacity = p.fade * (1 - t * t);
    }
    const d = this._chipDummy;
    let any = false;
    for (let i = 0; i < this.chipState.length; i++) {
      const c = this.chipState[i];
      if (!c.alive) continue;
      any = true;
      c.life += dt;
      if (c.life >= c.ttl) {
        c.alive = false;
        d.position.set(0, -9999, 0); d.scale.setScalar(0.0001); d.updateMatrix();
        this.chips.setMatrixAt(i, d.matrix);
        continue;
      }
      c.v.y -= 6.4 * dt;
      c.p.addScaledVector(c.v, dt);
      if (c.p.y < 0.004 && Math.hypot(c.p.x, c.p.z) > 0.17) {   // settles on the snow
        c.p.y = 0.004; c.v.set(c.v.x * 0.3, Math.abs(c.v.y) * 0.16, c.v.z * 0.3);
        c.rv.multiplyScalar(0.4);
      }
      c.rot.x += c.rv.x * dt; c.rot.y += c.rv.y * dt; c.rot.z += c.rv.z * dt;
      d.position.copy(c.p);
      d.rotation.copy(c.rot);
      const fade = 1 - Math.max(0, (c.life - c.ttl * 0.75) / (c.ttl * 0.25));
      d.scale.setScalar(c.s * (0.35 + 0.65 * fade));
      d.updateMatrix();
      this.chips.setMatrixAt(i, d.matrix);
    }
    if (any) this.chips.instanceMatrix.needsUpdate = true;
  }
}
