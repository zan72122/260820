import * as THREE from 'three'
import { Rng } from '../core/math'
import { steamSprite } from '../core/textures'

/**
 * GPU-only steam: every particle's whole life is computed in the vertex
 * shader, so a phone pays nothing per frame on the CPU.
 */
export class Steam {
  readonly points: THREE.Points
  private uniforms: Record<string, THREE.IUniform>

  constructor(count = 120, radius = 0.085, rise = 0.19, seed = 4242) {
    const rng = new Rng(seed)
    const off = new Float32Array(count * 3)
    const life = new Float32Array(count)
    const wob = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const a = rng.range(0, Math.PI * 2)
      const r = radius * Math.sqrt(rng.next())
      off[i * 3] = Math.cos(a) * r
      off[i * 3 + 1] = rng.range(0, 0.01)
      off[i * 3 + 2] = Math.sin(a) * r
      life[i] = rng.next()
      wob[i] = rng.range(0.4, 1.8)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(off, 3))
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(life, 1))
    g.setAttribute('aWob', new THREE.Float32BufferAttribute(wob, 1))

    this.uniforms = {
      uTime: { value: 0 },
      uAmount: { value: 0 },
      uRise: { value: rise },
      uSize: { value: 26 },
      uMap: { value: steamSprite() },
      uTint: { value: new THREE.Color(0xffffff) },
    }

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexShader: `
        attribute float aSeed;
        attribute float aWob;
        uniform float uTime; uniform float uRise; uniform float uSize; uniform float uAmount;
        varying float vAlpha;
        void main() {
          float life = fract(uTime * 0.22 + aSeed);
          vec3 p = position;
          p.y += life * uRise;
          p.x += sin(uTime * aWob + aSeed * 31.0) * 0.018 * life;
          p.z += cos(uTime * aWob * 0.8 + aSeed * 17.0) * 0.018 * life;
          p.xz *= 1.0 + life * 0.9;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * (0.35 + life * 1.9) / max(0.05, -mv.z);
          vAlpha = uAmount * sin(life * 3.14159) * (0.30 + 0.35 * aWob * 0.4);
        }`,
      fragmentShader: `
        uniform sampler2D uMap; uniform vec3 uTint;
        varying float vAlpha;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(uTint, t.a * vAlpha);
          if (gl_FragColor.a < 0.004) discard;
        }`,
    })
    this.points = new THREE.Points(g, mat)
    this.points.frustumCulled = false
    this.points.renderOrder = 5
    this.points.name = 'steam'
  }

  set amount(v: number) {
    this.uniforms.uAmount.value = v
  }
  get amount() {
    return this.uniforms.uAmount.value as number
  }
  set tint(c: number) {
    ;(this.uniforms.uTint.value as THREE.Color).setHex(c)
  }
  update(t: number) {
    this.uniforms.uTime.value = t
  }
}

/** Very light warm shimmer over a hot pan — a hint, never a fog bank. */
export class HeatHaze {
  readonly mesh: THREE.Mesh
  private uniforms: Record<string, THREE.IUniform>
  constructor(size = 0.24) {
    const g = new THREE.PlaneGeometry(size, size * 0.8, 1, 1)
    this.uniforms = { uTime: { value: 0 }, uAmount: { value: 0 } }
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float uTime; uniform float uAmount; varying vec2 vUv;
        void main() {
          float w = sin(vUv.x * 26.0 + uTime * 3.1) * 0.5 + sin(vUv.y * 19.0 - uTime * 2.3) * 0.5;
          float edge = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
          edge *= smoothstep(0.0, 0.25, vUv.x) * (1.0 - smoothstep(0.75, 1.0, vUv.x));
          float a = uAmount * edge * (0.35 + 0.35 * w);
          gl_FragColor = vec4(1.0, 0.72, 0.42, max(0.0, a) * 0.16);
        }`,
    })
    this.mesh = new THREE.Mesh(g, mat)
    this.mesh.renderOrder = 5
    this.mesh.name = 'heat-haze'
  }
  set amount(v: number) {
    this.uniforms.uAmount.value = v
  }
  update(t: number) {
    this.uniforms.uTime.value = t
  }
}
