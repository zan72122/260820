import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  NormalBlending,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import { makeCanvas } from './textures';

function dotTexture(): CanvasTexture {
  const { c, x } = makeCanvas(64);
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

const VERT = /* glsl */ `
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
    gl_PointSize = aSize * uScale / max(0.2, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  varying float vLife;
  varying vec3 vColor;
  void main() {
    if (vLife <= 0.0) discard;
    vec4 t = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(vColor, t.a * vLife);
    #include <colorspace_fragment>
  }
`;

/**
 * A single small pool for water droplets, sand and impact dust. This is the
 * first thing the quality manager switches off, so nothing depends on it.
 */
export class Particles {
  readonly points: Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private size: Float32Array;
  private col: Float32Array;
  private gravity: Float32Array;
  private cursor = 0;
  enabled = true;

  constructor(private capacity = 140) {
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.col = new Float32Array(capacity * 3);
    this.gravity = new Float32Array(capacity);

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    geo.setAttribute('aLife', new BufferAttribute(this.life, 1));
    geo.setAttribute('aSize', new BufferAttribute(this.size, 1));
    geo.setAttribute('aColor', new BufferAttribute(this.col, 3));
    geo.setDrawRange(0, capacity);
    geo.boundingSphere = null;

    const mat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uMap: { value: dotTexture() }, uScale: { value: 420 } },
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
    });
    this.points = new Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  setAdditive(on: boolean): void {
    (this.points.material as ShaderMaterial).blending = on ? AdditiveBlending : NormalBlending;
  }

  spawn(
    origin: Vector3,
    count: number,
    opts: { speed: number; spread: number; size: number; color: Color; gravity: number; up?: number },
  ): void {
    if (!this.enabled) return;
    for (let i = 0; i < count; i++) {
      const k = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      this.pos[k * 3] = origin.x;
      this.pos[k * 3 + 1] = origin.y;
      this.pos[k * 3 + 2] = origin.z;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * opts.spread;
      this.vel[k * 3] = Math.cos(a) * r * opts.speed;
      this.vel[k * 3 + 1] = (opts.up ?? 1) * opts.speed * (0.35 + Math.random() * 0.8);
      this.vel[k * 3 + 2] = Math.sin(a) * r * opts.speed;
      this.life[k] = 1;
      this.size[k] = opts.size * (0.6 + Math.random() * 0.8);
      this.col[k * 3] = opts.color.r;
      this.col[k * 3 + 1] = opts.color.g;
      this.col[k * 3 + 2] = opts.color.b;
      this.gravity[k] = opts.gravity;
    }
  }

  update(dt: number): void {
    let any = false;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt * 1.35;
      this.vel[i * 3 + 1] -= this.gravity[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.004) {
        this.pos[i * 3 + 1] = 0.004;
        this.vel[i * 3 + 1] *= -0.25;
        this.vel[i * 3] *= 0.5;
        this.vel[i * 3 + 2] *= 0.5;
      }
      if (this.life[i] < 0) this.life[i] = 0;
    }
    if (!any) return;
    const g = this.points.geometry;
    (g.attributes.position as BufferAttribute).needsUpdate = true;
    (g.attributes.aLife as BufferAttribute).needsUpdate = true;
    (g.attributes.aSize as BufferAttribute).needsUpdate = true;
    (g.attributes.aColor as BufferAttribute).needsUpdate = true;
  }
}
