// 湯気 / 手粉 / 米粒 / 雪 -- インスタンス描画のビルボード & 実ジオメトリ粒
import * as THREE from '../vendor/three.module.js';
import * as TEX from './textures.js';

const VS = `
attribute vec3 iPos;
attribute float iSize;
attribute float iAlpha;
attribute float iRot;
attribute vec3 iColor;
varying vec2 vUv;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vUv = uv; vAlpha = iAlpha; vColor = iColor;
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  float c = cos(iRot), s = sin(iRot);
  vec2 q = position.xy * iSize;
  mv.xy += vec2(q.x * c - q.y * s, q.x * s + q.y * c);
  gl_Position = projectionMatrix * mv;
}`;

const FS = `
uniform sampler2D uMap;
uniform vec3 uTint;
varying vec2 vUv;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec4 t = texture2D(uMap, vUv);
  float a = t.a * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uTint * vColor * t.rgb, a);
  #include <colorspace_fragment>
}`;

export class SpriteField {
  constructor(scene, capacity, map, tint = 0xffffff, blending = THREE.NormalBlending, renderOrder = 10) {
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.attributes.position = base.attributes.position;
    geo.attributes.uv = base.attributes.uv;
    this.cap = capacity;
    this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.iSize = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.iAlpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.iRot = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.iColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
    geo.setAttribute('iPos', this.iPos);
    geo.setAttribute('iSize', this.iSize);
    geo.setAttribute('iAlpha', this.iAlpha);
    geo.setAttribute('iRot', this.iRot);
    geo.setAttribute('iColor', this.iColor);
    geo.instanceCount = capacity;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 40);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS,
      uniforms: { uMap: { value: map }, uTint: { value: new THREE.Color(tint) } },
      transparent: true, depthWrite: false, depthTest: true, blending,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    scene.add(this.mesh);
    this.p = [];
    for (let i = 0; i < capacity; i++) {
      this.p.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, s0: 0.1, s1: 0.4, rot: 0, spin: 0, a0: 0.5, drag: 0.5, cr: 1, cg: 1, cb: 1 });
      this.iAlpha.array[i] = 0;
    }
    this.next = 0;
  }
  spawn(o) {
    let idx = -1;
    for (let k = 0; k < this.cap; k++) {
      const i = (this.next + k) % this.cap;
      if (!this.p[i].alive) { idx = i; break; }
    }
    if (idx < 0) { idx = this.next % this.cap; }
    this.next = (idx + 1) % this.cap;
    const p = this.p[idx];
    Object.assign(p, o);
    p.alive = true; p.age = 0;
    return p;
  }
  update(dt, wind = null) {
    const pos = this.iPos.array, sz = this.iSize.array, al = this.iAlpha.array,
      rt = this.iRot.array, col = this.iColor.array;
    for (let i = 0; i < this.cap; i++) {
      const p = this.p[i];
      if (!p.alive) { al[i] = 0; continue; }
      p.age += dt;
      const u = p.age / p.life;
      if (u >= 1) { p.alive = false; al[i] = 0; continue; }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vz *= d; p.vy = p.vy * d + (p.g || 0) * dt;
      if (wind) {
        const t = p.age * 0.9;
        p.vx += Math.sin(p.y * 3.1 + t * 2.3 + i) * wind * dt;
        p.vz += Math.cos(p.y * 2.7 + t * 1.9 + i * 0.7) * wind * dt;
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rot += p.spin * dt;
      const i3 = i * 3;
      pos[i3] = p.x; pos[i3 + 1] = p.y; pos[i3 + 2] = p.z;
      sz[i] = p.s0 + (p.s1 - p.s0) * Math.pow(u, 0.62);
      const fadeIn = Math.min(1, u / 0.16);
      al[i] = p.a0 * fadeIn * Math.pow(1 - u, 1.5);
      rt[i] = p.rot;
      col[i3] = p.cr; col[i3 + 1] = p.cg; col[i3 + 2] = p.cb;
    }
    this.iPos.needsUpdate = this.iSize.needsUpdate = this.iAlpha.needsUpdate =
      this.iRot.needsUpdate = this.iColor.needsUpdate = true;
  }
}

/* ---------- 湯気 ---------- */
export class Steam {
  constructor(scene) {
    this.field = new SpriteField(scene, 260, TEX.puffSprite(128, 0.75, 3), 0xffffff, THREE.NormalBlending, 12);
    this.emitters = [];
    this.acc = 0;
  }
  addEmitter(o) { const e = { rate: 8, radius: 0.1, vy: 0.32, life: 2.4, s0: 0.09, s1: 0.62, alpha: 0.34, acc: 0, on: 1, pos: new THREE.Vector3(), warm: 0, ...o }; this.emitters.push(e); return e; }
  burst(pos, n, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * (opts.radius || 0.14);
      this.field.spawn({
        x: pos.x + Math.cos(a) * r, y: pos.y + Math.random() * 0.05, z: pos.z + Math.sin(a) * r,
        vx: Math.cos(a) * (opts.spread || 0.35) * Math.random(), vz: Math.sin(a) * (opts.spread || 0.35) * Math.random(),
        vy: (opts.vy || 0.7) * (0.5 + Math.random()), g: 0.02, drag: 0.9,
        life: (opts.life || 1.9) * (0.7 + Math.random() * 0.6),
        s0: opts.s0 || 0.10, s1: opts.s1 || 0.62, a0: opts.alpha || 0.36,
        rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * 0.7,
        cr: 1, cg: 0.99, cb: 0.97,
      });
    }
  }
  update(dt) {
    for (const e of this.emitters) {
      if (!e.on) continue;
      e.acc += dt * e.rate * e.on;
      while (e.acc >= 1) {
        e.acc -= 1;
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * e.radius;
        this.field.spawn({
          x: e.pos.x + Math.cos(a) * r, y: e.pos.y, z: e.pos.z + Math.sin(a) * r,
          vx: (Math.random() - 0.5) * 0.10, vz: (Math.random() - 0.5) * 0.10,
          vy: e.vy * (0.6 + Math.random() * 0.8), g: 0.05, drag: 0.35,
          life: e.life * (0.7 + Math.random() * 0.7),
          s0: e.s0, s1: e.s1 * (0.7 + Math.random() * 0.6), a0: e.alpha * (0.7 + Math.random() * 0.6),
          rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * 0.5,
          cr: 1, cg: 1 - e.warm * 0.02, cb: 1 - e.warm * 0.06,
        });
      }
    }
    this.field.update(dt, 0.055);
  }
}

/* ---------- 手粉 ---------- */
export class Flour {
  constructor(scene) {
    this.field = new SpriteField(scene, 190, TEX.puffSprite(96, 0.35, 8), 0xffffff, THREE.NormalBlending, 13);
  }
  burst(pos, n = 16, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (0.5 + Math.random() * 1.5) * power;
      this.field.spawn({
        x: pos.x + (Math.random() - 0.5) * 0.10, y: pos.y + Math.random() * 0.03, z: pos.z + (Math.random() - 0.5) * 0.10,
        vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: (0.25 + Math.random() * 0.9) * power,
        g: -0.55, drag: 2.6, life: 0.85 + Math.random() * 0.8,
        s0: 0.035, s1: 0.20 + Math.random() * 0.16, a0: 0.55,
        rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * 3,
        cr: 1, cg: 1, cb: 1,
      });
    }
  }
  update(dt) { this.field.update(dt, 0.01); }
}

/* ---------- 雪 (戸口の外) ---------- */
export class Snowfall {
  constructor(scene) {
    this.field = new SpriteField(scene, 220, TEX.puffSprite(48, 0.1, 15), 0xffffff, THREE.NormalBlending, 5);
    this.acc = 0;
  }
  update(dt) {
    this.acc += dt * 34;
    while (this.acc >= 1) {
      this.acc -= 1;
      this.field.spawn({
        x: -9 + Math.random() * 18, y: 5.5, z: -3.6 - Math.random() * 15,
        vx: -0.25 + Math.random() * 0.5, vz: 0.05, vy: -(0.45 + Math.random() * 0.4),
        g: 0, drag: 0.02, life: 9 + Math.random() * 4,
        s0: 0.035 + Math.random() * 0.05, s1: 0.035 + Math.random() * 0.05, a0: 0.85,
        rot: 0, spin: 0.4, cr: 1, cg: 1, cb: 1,
      });
    }
    this.field.update(dt, 0.02);
  }
}

/* ---------- 祝いのきらめき ---------- */
export class Sparkle {
  constructor(scene) {
    this.field = new SpriteField(scene, 180, TEX.puffSprite(64, 0.05, 22), 0xffffff, THREE.AdditiveBlending, 20);
  }
  burst(pos, n = 40) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 2.0;
      const warm = Math.random();
      this.field.spawn({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 1.4 + Math.random() * 1.8,
        g: -2.2, drag: 1.2, life: 1.1 + Math.random() * 1.0,
        s0: 0.05, s1: 0.012, a0: 0.9,
        rot: Math.random() * 6.28, spin: 3,
        cr: 1, cg: 0.86 + warm * 0.14, cb: 0.55 + warm * 0.4,
      });
    }
  }
  update(dt) { this.field.update(dt, 0); }
}

/* ---------- 米粒 ---------- */
const GRAIN_STATE = { HIDDEN: 0, FALL: 1, HEAP: 2, ONMOCHI: 3, POP: 4, GONE: 5 };
export { GRAIN_STATE };

export class Grains {
  constructor(scene, count = 520) {
    const g = new THREE.SphereGeometry(1, 7, 5);
    g.scale(0.0019, 0.0019, 0.0038);
    const m = new THREE.MeshPhysicalMaterial({
      color: 0xfaf5e9, roughness: 0.30, clearcoat: 0.85, clearcoatRoughness: 0.25,
      sheen: 0.6, envMapIntensity: 1.1,
    });
    this.mesh = new THREE.InstancedMesh(g, m, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.count = count;
    this.g = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < count; i++) {
      this.g.push({
        state: GRAIN_STATE.HIDDEN,
        x: 0, y: -9, z: 0, vx: 0, vy: 0, vz: 0,
        rx: Math.random() * 6.28, ry: Math.random() * 6.28, rz: Math.random() * 6.28,
        wx: 0, wy: 0, wz: 0,
        tx: 0, ty: 0, tz: 0,
        theta: 0, tt: 0, scale: 1, delay: 0, age: 0,
      });
    }
    this.sync();
  }
  sync() {
    for (let i = 0; i < this.count; i++) {
      const p = this.g[i];
      this._e.set(p.rx, p.ry, p.rz);
      this._q.setFromEuler(this._e);
      const sc = p.state === GRAIN_STATE.HIDDEN || p.state === GRAIN_STATE.GONE ? 0 : p.scale;
      this._s.set(sc, sc, sc);
      this._v.set(p.x, p.y, p.z);
      this._m.compose(this._v, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
