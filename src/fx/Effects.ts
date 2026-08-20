import * as THREE from 'three';
import { Rng, clamp01, smoothstep } from '../util/math';
import { blobTexture } from '../util/textures';

export const MODE_BALLISTIC = 0;
export const MODE_ATTRACT = 1;

/**
 * One pooled instanced particle set. Soil grains lift off the ground, then
 * accelerate into the nozzle mouth and disappear inside it — the removal is
 * always shown as transport, never as a fade-out.
 */
export class ParticlePool {
  readonly mesh: THREE.InstancedMesh;
  private cap: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  private size: Float32Array;
  private mode: Uint8Array;
  private alive: Uint8Array;
  private cursor = 0;
  private rng = new Rng(8123);
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private col = new THREE.Color();
  private euler = new THREE.Euler();
  private spin: Float32Array;
  live = 0;

  constructor(geo: THREE.BufferGeometry, mat: THREE.MeshStandardMaterial, capacity: number) {
    this.cap = capacity;
    // Give the geometry a neutral colour attribute and turn vertex colours on:
    // that guarantees the per-instance tint reaches the shader on every driver.
    const g = geo.clone();
    const verts = g.getAttribute('position').count;
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(verts * 3).fill(1), 3));
    mat.vertexColors = true;
    this.mesh = new THREE.InstancedMesh(g, mat, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.spin = new Float32Array(capacity * 3);
    this.mode = new Uint8Array(capacity);
    this.alive = new Uint8Array(capacity);
    const colors = new Float32Array(capacity * 3).fill(1);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    this.hideAll();
  }

  private hideAll() {
    this.m.makeScale(0, 0, 0);
    for (let i = 0; i < this.cap; i++) this.mesh.setMatrixAt(i, this.m);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  setCapacity(n: number) {
    this.mesh.count = Math.min(this.cap, Math.max(0, n));
  }

  spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size: number,
    mode: number,
    color: THREE.Color
  ) {
    const limit = this.mesh.count;
    if (limit <= 0) return;
    let i = -1;
    for (let k = 0; k < limit; k++) {
      const c = (this.cursor + k) % limit;
      if (!this.alive[c]) {
        i = c;
        this.cursor = (c + 1) % limit;
        break;
      }
    }
    if (i < 0) return;
    this.alive[i] = 1;
    this.live++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.age[i] = 0;
    this.life[i] = life;
    this.size[i] = size;
    this.mode[i] = mode;
    this.spin[i * 3] = this.rng.range(-9, 9);
    this.spin[i * 3 + 1] = this.rng.range(-9, 9);
    this.spin[i * 3 + 2] = this.rng.range(-9, 9);
    (this.mesh.instanceColor!.array as Float32Array).set([color.r, color.g, color.b], i * 3);
    this.mesh.instanceColor!.needsUpdate = true;
  }

  update(dt: number, attractor: THREE.Vector3 | null, groundY: (x: number, z: number) => number) {
    const limit = this.mesh.count;
    for (let i = 0; i < limit; i++) {
      if (!this.alive[i]) continue;
      this.age[i] += dt;
      const t = this.age[i] / this.life[i];
      if (t >= 1) {
        this.kill(i);
        continue;
      }
      const ix = i * 3;
      if (this.mode[i] === MODE_ATTRACT && attractor) {
        if (t < 0.2) {
          this.vel[ix + 1] += 6.5 * dt;
        } else {
          const dx = attractor.x - this.pos[ix];
          const dy = attractor.y - this.pos[ix + 1];
          const dz = attractor.z - this.pos[ix + 2];
          const d = Math.hypot(dx, dy, dz) || 1e-4;
          if (d < 0.075) {
            this.kill(i);
            continue;
          }
          const a = (26 / Math.max(0.22, d)) * dt;
          this.vel[ix] += (dx / d) * a;
          this.vel[ix + 1] += (dy / d) * a;
          this.vel[ix + 2] += (dz / d) * a;
          const damp = Math.exp(-3.4 * dt);
          this.vel[ix] *= damp;
          this.vel[ix + 1] *= damp;
          this.vel[ix + 2] *= damp;
        }
      } else {
        this.vel[ix + 1] -= 9.0 * dt;
        const damp = Math.exp(-1.1 * dt);
        this.vel[ix] *= damp;
        this.vel[ix + 2] *= damp;
      }
      this.pos[ix] += this.vel[ix] * dt;
      this.pos[ix + 1] += this.vel[ix + 1] * dt;
      this.pos[ix + 2] += this.vel[ix + 2] * dt;

      if (this.mode[i] === MODE_BALLISTIC) {
        const gy = groundY(this.pos[ix], this.pos[ix + 2]);
        if (this.pos[ix + 1] < gy) {
          this.pos[ix + 1] = gy;
          this.vel[ix + 1] *= -0.24;
          this.vel[ix] *= 0.4;
          this.vel[ix + 2] *= 0.4;
          this.age[i] = Math.max(this.age[i], this.life[i] * 0.72);
        }
      }

      const fade = 1 - smoothstep(0.78, 1, t);
      const sc = this.size[i] * fade;
      this.v.set(this.pos[ix], this.pos[ix + 1], this.pos[ix + 2]);
      this.euler.set(
        this.spin[ix] * this.age[i],
        this.spin[ix + 1] * this.age[i],
        this.spin[ix + 2] * this.age[i]
      );
      this.q.setFromEuler(this.euler);
      this.s.set(sc, sc, sc);
      this.m.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private kill(i: number) {
    this.alive[i] = 0;
    this.live = Math.max(0, this.live - 1);
    this.m.makeScale(0, 0, 0);
    this.mesh.setMatrixAt(i, this.m);
  }

  randomColor(base: THREE.Color, spread: number): THREE.Color {
    const f = 1 + this.rng.range(-spread, spread);
    return this.col.setRGB(
      clamp01(base.r * f),
      clamp01(base.g * f),
      clamp01(base.b * f)
    );
  }

  clear() {
    for (let i = 0; i < this.cap; i++) if (this.alive[i]) this.kill(i);
    this.live = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Water jet: one thin ribbon plus a small number of droplets. Low overdraw. */
export class WaterJet {
  readonly group = new THREE.Group();
  private ribbon: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  private splash: THREE.Mesh;
  private splashMat: THREE.MeshBasicMaterial;
  private geo: THREE.BufferGeometry;
  private tex: THREE.Texture;
  private strength = 0;

  constructor() {
    this.geo = new THREE.BufferGeometry();
    const seg = 14;
    const pos = new Float32Array((seg + 1) * 2 * 3);
    const uv = new Float32Array((seg + 1) * 2 * 2);
    const idx: number[] = [];
    for (let i = 0; i <= seg; i++) {
      uv[i * 4] = 0;
      uv[i * 4 + 1] = i / seg;
      uv[i * 4 + 2] = 1;
      uv[i * 4 + 3] = i / seg;
      if (i < seg) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geo.setIndex(idx);
    this.tex = jetTexture();
    this.mat = new THREE.MeshBasicMaterial({
      map: this.tex,
      transparent: true,
      depthWrite: false,
      opacity: 0.0,
      color: 0xd8ecf5,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
    });
    this.ribbon = new THREE.Mesh(this.geo, this.mat);
    this.ribbon.frustumCulled = false;
    this.group.add(this.ribbon);

    this.splashMat = new THREE.MeshBasicMaterial({
      map: blobTexture(64, 0.3),
      transparent: true,
      depthWrite: false,
      opacity: 0,
      color: 0xcfe4ee,
    });
    this.splash = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), this.splashMat);
    this.splash.rotation.x = -Math.PI / 2;
    this.group.add(this.splash);
  }

  setVisible(v: boolean) {
    this.group.visible = v;
  }

  update(dt: number, from: THREE.Vector3, to: THREE.Vector3, on: boolean, camera: THREE.Camera) {
    this.strength += ((on ? 1 : 0) - this.strength) * Math.min(1, dt * 12);
    this.mat.opacity = this.strength * 0.62;
    this.splashMat.opacity = this.strength * 0.5;
    this.tex.offset.y -= dt * 3.4;
    if (this.strength < 0.01) return;

    const seg = 14;
    const arr = this.geo.getAttribute('position').array as Float32Array;
    const dir = new THREE.Vector3().subVectors(to, from);
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const side = new THREE.Vector3().crossVectors(dir, camDir).normalize();
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    const p = new THREE.Vector3();
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      p.copy(from).addScaledVector(dir, t);
      p.y -= Math.sin(t * Math.PI) * 0.02;
      const w = (0.012 + t * 0.05) * (0.7 + this.strength * 0.3);
      arr[i * 6] = p.x - side.x * w;
      arr[i * 6 + 1] = p.y - side.y * w;
      arr[i * 6 + 2] = p.z - side.z * w;
      arr[i * 6 + 3] = p.x + side.x * w;
      arr[i * 6 + 4] = p.y + side.y * w;
      arr[i * 6 + 5] = p.z + side.z * w;
    }
    this.geo.getAttribute('position').needsUpdate = true;
    this.geo.boundingSphere = null;
    this.splash.position.set(to.x, to.y + 0.006, to.z);
    const pulse = 1 + Math.sin(performance.now() * 0.02) * 0.08;
    this.splash.scale.setScalar(pulse * (0.7 + this.strength * 0.5));
  }
}

function jetTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const rng = new Rng(3311);
  ctx.clearRect(0, 0, 32, 128);
  for (let i = 0; i < 220; i++) {
    const x = rng.range(2, 30);
    const y = rng.range(0, 128);
    const a = rng.range(0.12, 0.65) * (1 - Math.abs(x - 16) / 18);
    ctx.fillStyle = `rgba(240,250,255,${a})`;
    ctx.fillRect(x, y, rng.range(1, 2), rng.range(4, 16));
  }
  const g = ctx.createLinearGradient(0, 0, 32, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Ground decals: weathered locate marks and the fresh cross the worker draws. */
export class GroundDecal {
  readonly mesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  private reveal = 0;
  private target = 0;

  constructor(map: THREE.Texture, width: number, height: number, opacity: number) {
    this.mat = new THREE.MeshBasicMaterial({
      map,
      transparent: true,
      depthWrite: false,
      opacity: 0,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 3;
    this.maxOpacity = opacity;
  }

  private maxOpacity: number;

  show(instant = false) {
    this.target = 1;
    if (instant) this.reveal = 1;
  }

  hide(instant = false) {
    this.target = 0;
    if (instant) this.reveal = 0;
  }

  place(x: number, y: number, z: number, rotY = 0) {
    this.mesh.position.set(x, y, z);
    this.mesh.rotation.z = rotY;
  }

  update(dt: number) {
    this.reveal += (this.target - this.reveal) * Math.min(1, dt * 3.4);
    this.mat.opacity = this.reveal * this.maxOpacity;
    this.mesh.visible = this.mat.opacity > 0.01;
  }
}
