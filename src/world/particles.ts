import * as THREE from 'three';
import { Rng, rrange } from '../core/util';
import { settings } from '../core/settings';

/** One small pool of soil grains — enough to sell a break, not a physics demo. */
export class DirtParticles {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private size: Float32Array;
  private cursor = 0;
  private readonly max: number;

  constructor(max = 260) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.size = new Float32Array(max);
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -999;

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));

    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d')!;
    const grd = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.55, 'rgba(255,255,255,0.75)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 32, 32);
    const tex = new THREE.CanvasTexture(c);

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTex: { value: tex },
        uColor: { value: new THREE.Color(0x4a3a28) },
        uScale: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aLife;
        varying float vLife;
        uniform float uScale;
        void main() {
          vLife = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale * 300.0 / max(0.001, -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vLife;
        uniform sampler2D uTex;
        uniform vec3 uColor;
        void main() {
          if (vLife <= 0.0) discard;
          vec4 t = texture2D(uTex, gl_PointCoord);
          float a = t.a * clamp(vLife * 2.2, 0.0, 1.0);
          if (a < 0.02) discard;
          gl_FragColor = vec4(uColor * (0.7 + 0.6 * vLife), a);
        }
      `,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
  }

  set pixelScale(v: number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = v;
  }

  burst(at: THREE.Vector3, count: number, rng: Rng, spread = 0.5, up = 1.2) {
    const n = settings.state.reduceMotion ? Math.ceil(count * 0.45) : count;
    for (let i = 0; i < n; i++) {
      const k = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      this.pos[k * 3] = at.x + rrange(rng, -0.02, 0.02);
      this.pos[k * 3 + 1] = at.y + rrange(rng, -0.01, 0.02);
      this.pos[k * 3 + 2] = at.z + rrange(rng, -0.02, 0.02);
      this.vel[k * 3] = rrange(rng, -spread, spread);
      this.vel[k * 3 + 1] = rrange(rng, up * 0.2, up);
      this.vel[k * 3 + 2] = rrange(rng, -spread, spread);
      this.life[k] = rrange(rng, 0.5, 1.0);
      this.size[k] = rrange(rng, 0.006, 0.019);
    }
  }

  update(dt: number, groundY: number) {
    let any = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt * 1.1;
      this.vel[i * 3 + 1] -= 7.4 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < groundY) {
        this.pos[i * 3 + 1] = groundY;
        this.vel[i * 3] *= 0.3;
        this.vel[i * 3 + 2] *= 0.3;
        this.vel[i * 3 + 1] = 0;
        this.life[i] = Math.min(this.life[i], 0.22);
      }
      if (this.life[i] <= 0) this.pos[i * 3 + 1] = -999;
    }
    if (any) {
      (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.points.geometry.attributes.aLife as THREE.BufferAttribute).needsUpdate = true;
      (this.points.geometry.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    }
  }
}
