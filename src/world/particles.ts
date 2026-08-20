import * as THREE from 'three';
import { clamp01 } from '../util/math';

/**
 * One pooled point cloud for every bit of debris in the pavilion: sand thrown
 * out of a crater, clay flecks, water droplets, dust lifted off the mat.
 * Nothing is allocated after construction — particles are recycled from a
 * fixed ring, so a fast child hammering the release ring cannot grow the heap.
 */

const vert = /* glsl */ `
  attribute float aSize;
  attribute float aLife;
  attribute vec3 aColor;
  varying float vLife;
  varying vec3 vColor;
  uniform float uScale;
  void main() {
    vLife = aLife;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // aSize is the grain's real diameter in metres; uScale converts that to
    // pixels for this viewport and lens. Clamped so a particle drifting close
    // to the lens can never wash out the frame.
    gl_PointSize = clamp(aSize * uScale / max(-mv.z, 0.08), 1.0, 40.0);
  }
`;

const frag = /* glsl */ `
  varying float vLife;
  varying vec3 vColor;
  void main() {
    if (vLife <= 0.0) discard;
    vec2 d = gl_PointCoord - 0.5;
    float r = dot(d, d);
    if (r > 0.25) discard;
    // Soft edge, and a little shading so grains are not flat discs.
    float a = smoothstep(0.25, 0.06, r) * clamp(vLife, 0.0, 1.0);
    float shade = 0.72 + 0.28 * smoothstep(0.25, 0.0, dot(d - vec2(-0.12, -0.12), d - vec2(-0.12, -0.12)));
    gl_FragColor = vec4(vColor * shade, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

interface P {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; maxLife: number;
  size: number;
  gravity: number;
  drag: number;
  floorY: number;
  bounce: number;
}

export type DebrisKind = 'sand' | 'clay' | 'water' | 'dust' | 'foam';

export class ParticleField {
  readonly points: THREE.Points;
  private pool: P[] = [];
  private cursor = 0;
  private positions: Float32Array;
  private sizes: Float32Array;
  private lives: Float32Array;
  private colors: Float32Array;
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private live = 0;

  constructor(capacity = 360) {
    this.positions = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    this.lives = new Float32Array(capacity);
    this.colors = new Float32Array(capacity * 3);
    for (let i = 0; i < capacity; i++) {
      this.pool.push({
        x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1, size: 1, gravity: 9.81, drag: 0.1, floorY: 0, bounce: 0,
      });
      this.positions[i * 3 + 1] = -999;
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('aLife', new THREE.BufferAttribute(this.lives, 1));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.5, 0), 12);

    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  /** Recompute the world-metres-to-pixels factor for the current frame. */
  setProjection(viewportHeightPx: number, fovDegrees: number) {
    const tanV = Math.tan((fovDegrees * Math.PI) / 360);
    this.material.uniforms.uScale.value = viewportHeightPx / (2 * tanV);
  }

  private palette(kind: DebrisKind, r: number): [number, number, number] {
    switch (kind) {
      case 'sand':
        return [0.72 + r * 0.16, 0.62 + r * 0.14, 0.46 + r * 0.12];
      case 'clay':
        return [0.24 + r * 0.1, 0.19 + r * 0.08, 0.15 + r * 0.06];
      case 'water':
        return [0.72 + r * 0.2, 0.82 + r * 0.16, 0.86 + r * 0.14];
      case 'foam':
        return [0.62 + r * 0.18, 0.6 + r * 0.16, 0.55 + r * 0.14];
      case 'dust':
      default:
        return [0.34 + r * 0.12, 0.32 + r * 0.11, 0.29 + r * 0.09];
    }
  }

  /**
   * Throw debris outward from an impact. `energy` scales count, speed and
   * spread so a gentle drop makes a puff and a hard one makes a spray.
   */
  burst(
    kind: DebrisKind,
    origin: THREE.Vector3,
    count: number,
    energy: number,
    floorY: number,
    outward = 1
  ) {
    const n = Math.min(count, this.pool.length);
    const e = clamp01(energy);
    for (let i = 0; i < n; i++) {
      const p = this.pool[this.cursor];
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.pool.length;
      const a = Math.random() * Math.PI * 2;
      const up = kind === 'water' ? 0.6 + Math.random() * 0.9 : 0.35 + Math.random() * 0.8;
      const speed = (kind === 'dust' ? 0.35 : 1.1) * (0.4 + e * 1.9) * (0.5 + Math.random() * 0.9);
      p.x = origin.x + Math.cos(a) * 0.012;
      p.y = origin.y + 0.006;
      p.z = origin.z + Math.sin(a) * 0.012;
      p.vx = Math.cos(a) * speed * outward;
      p.vz = Math.sin(a) * speed * outward;
      p.vy = speed * up;
      p.maxLife = kind === 'dust' ? 1.1 + Math.random() * 0.7 : 0.5 + Math.random() * 0.55;
      p.life = p.maxLife;
      p.size =
        kind === 'dust'
          ? 0.018 + Math.random() * 0.03
          : kind === 'water'
            ? 0.004 + Math.random() * 0.008
            : kind === 'foam'
              ? 0.005 + Math.random() * 0.008
              : 0.0022 + Math.random() * 0.0045;
      p.gravity = kind === 'dust' ? 0.9 : 9.81;
      p.drag = kind === 'dust' ? 1.9 : kind === 'foam' ? 2.6 : 0.35;
      p.floorY = floorY;
      p.bounce = kind === 'sand' ? 0.16 : kind === 'water' ? 0.28 : 0.05;

      const c = this.palette(kind, Math.random());
      this.colors[idx * 3] = c[0];
      this.colors[idx * 3 + 1] = c[1];
      this.colors[idx * 3 + 2] = c[2];
      this.sizes[idx] = p.size;
    }
    this.geometry.getAttribute('aColor').needsUpdate = true;
    this.geometry.getAttribute('aSize').needsUpdate = true;
  }

  update(dt: number) {
    let live = 0;
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (p.life <= 0) {
        if (this.lives[i] !== 0) {
          this.lives[i] = 0;
          this.positions[i * 3 + 1] = -999;
        }
        continue;
      }
      live++;
      p.life -= dt;
      p.vy -= p.gravity * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.vz *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < p.floorY) {
        p.y = p.floorY;
        if (p.bounce > 0.02 && p.vy < -0.2) {
          p.vy = -p.vy * p.bounce;
          p.vx *= 0.6;
          p.vz *= 0.6;
        } else {
          p.vy = 0;
          p.vx *= 0.82;
          p.vz *= 0.82;
          p.life = Math.min(p.life, 0.28);
        }
      }
      this.positions[i * 3] = p.x;
      this.positions[i * 3 + 1] = p.y;
      this.positions[i * 3 + 2] = p.z;
      this.lives[i] = clamp01(p.life / (p.maxLife * 0.6));
      this.sizes[i] = p.size;
    }
    this.live = live;
    this.geometry.getAttribute('position').needsUpdate = true;
    this.geometry.getAttribute('aLife').needsUpdate = true;
    this.geometry.getAttribute('aSize').needsUpdate = true;
  }

  get activeCount() {
    return this.live;
  }

  clear() {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].life = 0;
      this.lives[i] = 0;
      this.positions[i * 3 + 1] = -999;
    }
    this.geometry.getAttribute('position').needsUpdate = true;
    this.geometry.getAttribute('aLife').needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
