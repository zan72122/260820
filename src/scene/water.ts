/** 水の見た目。細い水筋・重い排水・飛沫・鉢の水面。 */
import * as THREE from 'three';
import { clamp, makeRng } from '../util/math';
import { makeValueNoise, fbm, heightToNormal } from '../util/noise';
import { caps } from './caps';

function streakTexture(): THREE.Texture {
  const w = 64;
  const h = 256;
  const n = makeValueNoise(64, 4711);
  const img = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      const streak = fbm(n, u * 7, v * 2.2, 3);
      const fine = fbm(n, u * 22, v * 6, 2);
      const a = clamp(0.42 + streak * 0.6 + fine * 0.25, 0, 1);
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a * 255;
    }
  }
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  cv.getContext('2d')!.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function rippleNormal(): THREE.Texture {
  const w = 256;
  const n = makeValueNoise(64, 8123);
  const height = new Float32Array(w * w);
  for (let y = 0; y < w; y++)
    for (let x = 0; x < w; x++)
      height[y * w + x] = fbm(n, (x / w) * 6, (y / w) * 6, 4) + fbm(n, (x / w) * 19, (y / w) * 19, 2) * 0.3;
  const img = heightToNormal(height, w, w, 1.4);
  const cv = document.createElement('canvas');
  cv.width = cv.height = w;
  cv.getContext('2d')!.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function dotTexture(): THREE.Texture {
  const w = 32;
  const cv = document.createElement('canvas');
  cv.width = cv.height = w;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.55, 'rgba(232,240,240,0.55)');
  g.addColorStop(1, 'rgba(232,240,240,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, w, w);
  return new THREE.CanvasTexture(cv);
}

export interface WaterAssets {
  streak: THREE.Texture;
  ripple: THREE.Texture;
  dot: THREE.Texture;
}

export function makeWaterAssets(): WaterAssets {
  return { streak: streakTexture(), ripple: rippleNormal(), dot: dotTexture() };
}

export function waterMaterial(assets: WaterAssets, opacity: number): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xa9c3c2),
    roughness: 0.12,
    metalness: 0,
    transparent: true,
    opacity,
    alphaMap: assets.streak,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.5,
    clearcoat: 0.6,
    clearcoatRoughness: 0.12,
  });
  return m;
}

/** 水筋。経路と太さを毎フレーム書き換える細長い柱。 */
export class FlowTube {
  readonly mesh: THREE.Mesh;
  private geo: THREE.BufferGeometry;
  private segs: number;
  private radial: number;
  private pos: THREE.BufferAttribute;
  private uvA: THREE.BufferAttribute;

  constructor(material: THREE.Material, segs = 22, radial = 6) {
    this.segs = segs;
    this.radial = radial;
    const count = (segs + 1) * (radial + 1);
    const pos = new Float32Array(count * 3);
    const nrm = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const idx: number[] = [];
    const row = radial + 1;
    for (let a = 0; a < segs; a++) {
      for (let i = 0; i < radial; i++) {
        const p0 = a * row + i;
        idx.push(p0, p0 + row, p0 + 1, p0 + 1, p0 + row, p0 + row + 1);
      }
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geo.setIndex(idx);
    this.pos = this.geo.getAttribute('position') as THREE.BufferAttribute;
    this.uvA = this.geo.getAttribute('uv') as THREE.BufferAttribute;
    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }

  update(
    path: (t: number, out: THREE.Vector3) => void,
    radiusAt: (t: number) => number,
    uvOffset: number,
  ): void {
    const p = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const nx = new THREE.Vector3();
    const ny = new THREE.Vector3();
    const up = new THREE.Vector3(0, 0, 1);
    const row = this.radial + 1;
    for (let a = 0; a <= this.segs; a++) {
      const t = a / this.segs;
      path(t, p);
      path(Math.min(1, t + 0.02), p2);
      tan.copy(p2).sub(p);
      if (tan.lengthSq() < 1e-9) tan.set(0, -1, 0);
      tan.normalize();
      nx.copy(up).cross(tan);
      if (nx.lengthSq() < 1e-6) nx.set(1, 0, 0);
      nx.normalize();
      ny.copy(tan).cross(nx).normalize();
      const r = radiusAt(t);
      for (let i = 0; i <= this.radial; i++) {
        const phi = (i / this.radial) * Math.PI * 2;
        const c = Math.cos(phi) * r;
        const s = Math.sin(phi) * r;
        const k = a * row + i;
        this.pos.setXYZ(k, p.x + nx.x * c + ny.x * s, p.y + nx.y * c + ny.y * s, p.z + nx.z * c + ny.z * s);
        this.uvA.setXY(k, i / this.radial, t * 2.4 + uvOffset);
      }
    }
    this.pos.needsUpdate = true;
    this.uvA.needsUpdate = true;
    this.geo.computeVertexNormals();
  }

  setVisible(v: boolean): void {
    this.mesh.visible = v;
  }
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
}

/** 飛沫。少数で重さを描く。 */
export class SprayField {
  readonly points: THREE.Points;
  private parts: Particle[] = [];
  private posAttr: THREE.BufferAttribute;
  private alphaAttr: THREE.BufferAttribute;
  private sizeAttr: THREE.BufferAttribute;
  private rng = makeRng(0x5f2a);
  private cursor = 0;

  constructor(count: number, assets: WaterAssets) {
    const pos = new Float32Array(count * 3);
    const alpha = new Float32Array(count);
    const size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.parts.push({ x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1 });
      pos[i * 3 + 1] = -99;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    this.posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    this.alphaAttr = geo.getAttribute('aAlpha') as THREE.BufferAttribute;
    this.sizeAttr = geo.getAttribute('aSize') as THREE.BufferAttribute;
    const mat: THREE.Material = caps.rawShaders
      ? new THREE.ShaderMaterial({
      uniforms: { uMap: { value: assets.dot }, uScale: { value: 1700 } },
      transparent: true,
      depthWrite: false,
      vertexShader: `
        attribute float aAlpha; attribute float aSize; varying float vA;
        uniform float uScale;
        void main() {
          vA = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * uScale / max(0.15, -mv.z), 1.0, 26.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uMap; varying float vA;
        void main() {
          vec4 c = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vec3(0.86, 0.91, 0.90), c.a * vA);
          if (gl_FragColor.a < 0.01) discard;
        }`,
        })
      : new THREE.PointsMaterial({
          map: assets.dot,
          size: 0.012,
          sizeAttenuation: true,
          transparent: true,
          depthWrite: false,
          color: new THREE.Color(0xdbe8e6),
        });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
  }

  spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    spread: number,
    size: number,
    life: number,
  ): void {
    const p = this.parts[this.cursor];
    this.cursor = (this.cursor + 1) % this.parts.length;
    p.x = x + (this.rng() - 0.5) * spread * 0.4;
    p.y = y + (this.rng() - 0.5) * spread * 0.4;
    p.z = z + (this.rng() - 0.5) * spread * 0.4;
    p.vx = vx + (this.rng() - 0.5) * spread;
    p.vy = vy + (this.rng() - 0.5) * spread * 0.6;
    p.vz = vz + (this.rng() - 0.5) * spread;
    p.size = size * (0.55 + this.rng() * 0.9);
    p.max = life * (0.6 + this.rng() * 0.8);
    p.life = p.max;
  }

  update(dt: number, floorY: number, onLand?: (x: number, z: number, speed: number) => void): void {
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      if (p.life <= 0) {
        if (this.alphaAttr.getX(i) !== 0) this.alphaAttr.setX(i, 0);
        continue;
      }
      p.life -= dt;
      p.vy -= 9.81 * dt;
      p.vx *= 1 - dt * 0.7;
      p.vz *= 1 - dt * 0.7;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < floorY) {
        if (onLand) onLand(p.x, p.z, Math.abs(p.vy));
        p.life = 0;
      }
      const a = clamp(p.life / p.max, 0, 1);
      this.posAttr.setXYZ(i, p.x, p.y, p.z);
      this.alphaAttr.setX(i, a * 0.85);
      this.sizeAttr.setX(i, p.size);
    }
    this.posAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
  }
}

/** 水面に広がる輪 */
export class Ripples {
  readonly group = new THREE.Group();
  private items: { mesh: THREE.Mesh; life: number; max: number; scale: number }[] = [];

  constructor(count: number, color: number) {
    const geo = new THREE.RingGeometry(0.75, 1, 32);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      m.renderOrder = 5;
      this.group.add(m);
      this.items.push({ mesh: m, life: 0, max: 1, scale: 1 });
    }
  }

  spawn(x: number, y: number, z: number, scale: number, life: number): void {
    const it = this.items.find((i) => i.life <= 0);
    if (!it) return;
    it.mesh.position.set(x, y, z);
    it.mesh.visible = true;
    it.life = life;
    it.max = life;
    it.scale = scale;
  }

  update(dt: number): void {
    for (const it of this.items) {
      if (it.life <= 0) continue;
      it.life -= dt;
      const t = 1 - it.life / it.max;
      const s = it.scale * (0.15 + t * 0.95);
      it.mesh.scale.set(s, 1, s);
      (it.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.3;
      if (it.life <= 0) it.mesh.visible = false;
    }
  }
}
