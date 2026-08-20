import * as THREE from 'three';
import { makeRng } from '../core/util';
import type { TextureSet } from '../gfx/textures';
import type { Terrain } from './terrain';

const MAX = 520;

const VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4( position, 1.0 );
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * ( 260.0 / max( -mv.z, 0.15 ) );
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uTex;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec4 t = texture2D( uTex, gl_PointCoord );
  if ( t.a * vAlpha < 0.01 ) discard;
  gl_FragColor = vec4( vColor * t.rgb, t.a * vAlpha );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

type Kind = 0 | 1 | 2; // 0 = water drop, 1 = sand grain, 2 = foam puff

export class Particles {
  readonly points: THREE.Points;
  private pos = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private size = new Float32Array(MAX);
  private alpha = new Float32Array(MAX);
  private color = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private maxLife = new Float32Array(MAX);
  private kind = new Uint8Array(MAX);
  private cursor = 0;
  private aPos: THREE.BufferAttribute;
  private aSize: THREE.BufferAttribute;
  private aAlpha: THREE.BufferAttribute;
  private aColor: THREE.BufferAttribute;
  private rng = makeRng(4242);
  private geo: THREE.BufferGeometry;

  constructor(tex: TextureSet) {
    this.geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    this.aColor = new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.aPos);
    this.geo.setAttribute('aSize', this.aSize);
    this.geo.setAttribute('aAlpha', this.aAlpha);
    this.geo.setAttribute('aColor', this.aColor);
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -999;

    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: tex.droplet } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
  }

  private alloc() {
    for (let n = 0; n < MAX; n++) {
      const i = (this.cursor + n) % MAX;
      if (this.life[i] <= 0) {
        this.cursor = (i + 1) % MAX;
        return i;
      }
    }
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX;
    return i;
  }

  private emit(
    kind: Kind,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    size: number,
    life: number,
    r: number,
    g: number,
    b: number,
  ) {
    const i = this.alloc();
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.size[i] = size;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.alpha[i] = 1;
    this.color[i * 3] = r;
    this.color[i * 3 + 1] = g;
    this.color[i * 3 + 2] = b;
    this.kind[i] = kind;
  }

  private rr(a: number, b: number) {
    return a + this.rng() * (b - a);
  }

  /** The single drop escaping the closed gate. */
  drip(x: number, y: number, z: number) {
    this.emit(0, x + this.rr(-0.01, 0.01), y, z, 0, -0.05, this.rr(0.02, 0.07), 0.028, 1.6, 0.85, 0.88, 0.86);
  }

  jet(x: number, y: number, z: number, power: number, n = 3) {
    for (let i = 0; i < n; i++) {
      this.emit(
        0,
        x + this.rr(-0.12, 0.12),
        y + this.rr(0, 0.03),
        z + this.rr(-0.02, 0.02),
        this.rr(-0.25, 0.25) * power,
        this.rr(0.1, 0.5) * power,
        this.rr(0.5, 1.5) * power,
        this.rr(0.02, 0.045),
        this.rr(0.4, 0.9),
        0.86,
        0.9,
        0.88,
      );
    }
  }

  splash(x: number, y: number, z: number, power: number) {
    const n = Math.min(26, 6 + (power * 22) | 0);
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const s = this.rr(0.25, 1.1) * power;
      this.emit(
        0,
        x,
        y + 0.01,
        z,
        Math.cos(a) * s,
        this.rr(0.5, 1.6) * power,
        Math.sin(a) * s,
        this.rr(0.022, 0.05),
        this.rr(0.5, 1.1),
        0.88,
        0.91,
        0.89,
      );
    }
    for (let i = 0; i < 5; i++) {
      this.emit(
        2,
        x + this.rr(-0.06, 0.06),
        y + 0.012,
        z + this.rr(-0.06, 0.06),
        0,
        0.02,
        0,
        this.rr(0.07, 0.13),
        this.rr(0.6, 1.2),
        0.9,
        0.92,
        0.9,
      );
    }
  }

  sand(x: number, y: number, z: number, power: number, dirX = 0, dirZ = 0) {
    const n = Math.min(20, 4 + (power * 16) | 0);
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const s = this.rr(0.1, 0.6) * power;
      const tone = this.rr(0.78, 1.0);
      this.emit(
        1,
        x + this.rr(-0.05, 0.05),
        y + 0.01,
        z + this.rr(-0.05, 0.05),
        Math.cos(a) * s + dirX * 0.5,
        this.rr(0.25, 0.9) * power,
        Math.sin(a) * s + dirZ * 0.5,
        this.rr(0.014, 0.03),
        this.rr(0.4, 0.85),
        0.62 * tone,
        0.55 * tone,
        0.43 * tone,
      );
    }
  }

  update(dt: number, terrain: Terrain) {
    const p = this.pos;
    const v = this.vel;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        p[i * 3 + 1] = -999;
        this.alpha[i] = 0;
        continue;
      }
      const k = this.kind[i];
      if (k === 2) {
        // foam puff: drifts, swells, fades
        p[i * 3] += v[i * 3] * dt;
        p[i * 3 + 2] += v[i * 3 + 2] * dt;
        this.size[i] += dt * 0.05;
        this.alpha[i] = Math.min(1, this.life[i] / this.maxLife[i]) * 0.7;
        continue;
      }
      v[i * 3 + 1] -= (k === 1 ? 6.4 : 8.2) * dt;
      p[i * 3] += v[i * 3] * dt;
      p[i * 3 + 1] += v[i * 3 + 1] * dt;
      p[i * 3 + 2] += v[i * 3 + 2] * dt;
      const g = terrain.heightAt(p[i * 3], p[i * 3 + 2]);
      if (p[i * 3 + 1] <= g) {
        p[i * 3 + 1] = -999;
        this.life[i] = 0;
        this.alpha[i] = 0;
        continue;
      }
      this.alpha[i] = Math.min(1, this.life[i] / this.maxLife[i] + 0.25);
    }
    this.aPos.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
    this.aColor.needsUpdate = true;
  }

  clear() {
    for (let i = 0; i < MAX; i++) {
      this.life[i] = 0;
      this.alpha[i] = 0;
      this.pos[i * 3 + 1] = -999;
    }
    this.aPos.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
  }
}
