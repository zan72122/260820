import {
  AdditiveBlending, BufferGeometry, Color, DynamicDrawUsage, Float32BufferAttribute,
  NormalBlending, Points, ShaderMaterial, Vector3, type IUniform,
} from 'three';

export interface ParticleKind {
  /** Sprite look: 'droplet' is a tight bright bead, 'puff' is a soft cloud. */
  shape: 'droplet' | 'puff';
  additive: boolean;
  gravity: number;
  drag: number;
  life: [number, number];
  size: [number, number];
  color: Color;
  fadeIn: number;
}

export const DROPLET: ParticleKind = {
  shape: 'droplet', additive: true, gravity: -3.2, drag: 0.6,
  life: [0.35, 0.85], size: [0.006, 0.020], color: new Color(0.78, 0.90, 1.0), fadeIn: 0.02,
};

export const MUDFLECK: ParticleKind = {
  shape: 'puff', additive: false, gravity: -3.6, drag: 1.4,
  life: [0.30, 0.70], size: [0.010, 0.030], color: new Color(0.16, 0.11, 0.07), fadeIn: 0.02,
};

export const POWDER: ParticleKind = {
  shape: 'puff', additive: false, gravity: -0.32, drag: 2.6,
  life: [0.9, 2.0], size: [0.010, 0.030], color: new Color(0.62, 0.58, 0.52), fadeIn: 0.08,
};

export const CHIP: ParticleKind = {
  shape: 'puff', additive: false, gravity: -5.2, drag: 0.8,
  life: [0.5, 1.1], size: [0.005, 0.016], color: new Color(0.34, 0.30, 0.27), fadeIn: 0.01,
};

/**
 * One pooled Points cloud per particle kind. A single draw call, attributes
 * rewritten only for the slots that actually changed, so spraying water while
 * scrubbing costs almost nothing on a phone.
 */
export class ParticleSystem {
  readonly points: Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private size: Float32Array;
  private alive = 0;
  private cursor = 0;
  private readonly cap: number;
  private kind: ParticleKind;
  private rndState = 987654321;

  constructor(kind: ParticleKind, capacity: number, uPixelRatio: IUniform<number>) {
    this.kind = kind;
    this.cap = Math.max(8, capacity);
    this.pos = new Float32Array(this.cap * 3);
    this.vel = new Float32Array(this.cap * 3);
    this.life = new Float32Array(this.cap);
    this.maxLife = new Float32Array(this.cap);
    this.size = new Float32Array(this.cap);

    const geo = new BufferGeometry();
    const posAttr = new Float32BufferAttribute(this.pos, 3);
    posAttr.setUsage(DynamicDrawUsage);
    const lifeAttr = new Float32BufferAttribute(new Float32Array(this.cap), 1);
    lifeAttr.setUsage(DynamicDrawUsage);
    const sizeAttr = new Float32BufferAttribute(this.size, 1);
    sizeAttr.setUsage(DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    geo.setAttribute('aLife', lifeAttr);
    geo.setAttribute('aSize', sizeAttr);
    geo.setDrawRange(0, 0);

    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: kind.additive ? AdditiveBlending : NormalBlending,
      uniforms: {
        uColor: { value: kind.color },
        uDpr: uPixelRatio,
        uFadeIn: { value: kind.fadeIn },
        uSoft: { value: kind.shape === 'puff' ? 1 : 0 },
      },
      vertexShader: /* glsl */ `
        attribute float aLife;
        attribute float aSize;
        uniform float uDpr;
        varying float vLife;
        void main() {
          vLife = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float grow = mix(1.0, 1.9, 1.0 - aLife);
          gl_PointSize = clamp(aSize * grow * 640.0 * uDpr / max(0.05, -mv.z), 0.0, 64.0 * uDpr);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uFadeIn;
        uniform float uSoft;
        varying float vLife;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d2 = dot(c, c);
          if (d2 > 0.25) discard;
          float hard = smoothstep(0.25, 0.02, d2);
          float soft = exp(-d2 * 9.0);
          float shape = mix(hard, soft, uSoft);
          // Fade in fast, out slow; a droplet should pop then dissolve.
          float aIn = smoothstep(1.0, 1.0 - uFadeIn, vLife);
          float aOut = smoothstep(0.0, 0.55, vLife);
          float a = shape * aIn * aOut;
          if (a < 0.006) discard;
          gl_FragColor = vec4(uColor, a);
        }`,
    });

    this.points = new Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = kind.additive ? 7 : 4;
  }

  private rnd(): number {
    this.rndState = (Math.imul(this.rndState, 1664525) + 1013904223) >>> 0;
    return this.rndState / 4294967296;
  }

  spawn(origin: Vector3, dir: Vector3, count: number, speed = 1, spread = 0.7): void {
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.cap;
      const i3 = i * 3;
      this.pos[i3] = origin.x + (this.rnd() - 0.5) * 0.02;
      this.pos[i3 + 1] = origin.y + (this.rnd() - 0.5) * 0.02;
      this.pos[i3 + 2] = origin.z + (this.rnd() - 0.5) * 0.02;
      const sp = speed * (0.45 + this.rnd());
      this.vel[i3] = (dir.x + (this.rnd() - 0.5) * spread) * sp;
      this.vel[i3 + 1] = (dir.y + (this.rnd() - 0.5) * spread) * sp;
      this.vel[i3 + 2] = (dir.z + (this.rnd() - 0.5) * spread) * sp;
      const l = this.kind.life[0] + this.rnd() * (this.kind.life[1] - this.kind.life[0]);
      this.life[i] = l;
      this.maxLife[i] = l;
      this.size[i] = this.kind.size[0] + this.rnd() * (this.kind.size[1] - this.kind.size[0]);
      this.alive = Math.min(this.cap, this.alive + 1);
    }
  }

  update(dt: number): void {
    if (this.alive === 0) return;
    const g = this.kind.gravity;
    const drag = Math.exp(-this.kind.drag * dt);
    const geo = this.points.geometry;
    const posAttr = geo.getAttribute('position');
    const lifeAttr = geo.getAttribute('aLife');
    const sizeAttr = geo.getAttribute('aSize');
    const lifeArr = lifeAttr.array as Float32Array;
    const sizeArr = sizeAttr.array as Float32Array;
    const posArr = posAttr.array as Float32Array;

    let any = 0;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) { lifeArr[i] = 0; continue; }
      this.life[i] -= dt;
      if (this.life[i] <= 0) { lifeArr[i] = 0; continue; }
      const i3 = i * 3;
      this.vel[i3] *= drag;
      this.vel[i3 + 1] = this.vel[i3 + 1] * drag + g * dt;
      this.vel[i3 + 2] *= drag;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      posArr[i3] = this.pos[i3];
      posArr[i3 + 1] = this.pos[i3 + 1];
      posArr[i3 + 2] = this.pos[i3 + 2];
      lifeArr[i] = this.life[i] / this.maxLife[i];
      sizeArr[i] = this.size[i];
      any++;
    }
    this.alive = any;
    geo.setDrawRange(0, this.cap);
    posAttr.needsUpdate = true;
    lifeAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
  }

  clear(): void {
    this.life.fill(0);
    this.alive = 0;
    const lifeAttr = this.points.geometry.getAttribute('aLife');
    (lifeAttr.array as Float32Array).fill(0);
    lifeAttr.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as ShaderMaterial).dispose();
  }
}
