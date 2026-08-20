/**
 * Airborne dust and pollen. Normally it just drifts. At the moment the sheet
 * first throws light back up, a handful of motes ride that path once - which
 * shows the direction without ever drawing a beam or an arrow.
 */
import * as THREE from 'three'
import { makeMoteSprite } from './textures'
import { makeRng } from '../sim/noise'

const VERT = /* glsl */ `
attribute float aSize;
attribute float aBright;
varying float vBright;
void main() {
  vBright = aBright;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * 300.0 / max(0.05, -mv.z);
}
`

const FRAG = /* glsl */ `
uniform sampler2D uSprite;
uniform vec3 uColor;
varying float vBright;
void main() {
  float a = texture2D(uSprite, gl_PointCoord).a;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor * vBright, a * vBright * 0.55);
}
`

export class Motes {
  readonly points: THREE.Points
  private geo: THREE.BufferGeometry
  private mat: THREE.ShaderMaterial
  private sprite: THREE.DataTexture
  private pos: Float32Array
  private vel: Float32Array
  private bright: Float32Array
  private ride: Float32Array
  private count: number
  private rng = makeRng(60607)
  private center = new THREE.Vector3(0, 0.6, 0)
  private rideFrom = new THREE.Vector3()
  private rideTo = new THREE.Vector3()
  private rideTimer = 0

  constructor(count: number) {
    this.count = count
    this.sprite = makeMoteSprite()
    this.pos = new Float32Array(count * 3)
    this.vel = new Float32Array(count * 3)
    this.bright = new Float32Array(count)
    this.ride = new Float32Array(count)
    const size = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      this.reseed(i)
      size[i] = 0.006 + this.rng() * 0.014
      this.bright[i] = 0.25 + this.rng() * 0.4
    }
    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    this.geo.setAttribute('aBright', new THREE.BufferAttribute(this.bright, 1))
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uSprite: { value: this.sprite },
        uColor: { value: new THREE.Color(0xfff3dc) },
      },
    })
    this.points = new THREE.Points(this.geo, this.mat)
    this.points.frustumCulled = false
  }

  private reseed(i: number): void {
    const r = this.rng
    this.pos[i * 3] = this.center.x + (r() - 0.5) * 1.5
    this.pos[i * 3 + 1] = 0.05 + r() * 1.3
    this.pos[i * 3 + 2] = this.center.z + (r() - 0.5) * 1.2
    this.vel[i * 3] = (r() - 0.5) * 0.03
    this.vel[i * 3 + 1] = 0.005 + r() * 0.02
    this.vel[i * 3 + 2] = (r() - 0.5) * 0.03
    this.ride[i] = 0
  }

  setCenter(v: THREE.Vector3): void {
    this.center.copy(v)
  }

  setCount(count: number): void {
    this.count = Math.min(count, this.bright.length)
    this.geo.setDrawRange(0, this.count)
  }

  /** Called once, when the bounce first reaches the fruit. */
  showPath(from: THREE.Vector3, to: THREE.Vector3): void {
    this.rideFrom.copy(from)
    this.rideTo.copy(to)
    this.rideTimer = 2.4
    const n = Math.min(this.count, 14)
    for (let i = 0; i < n; i++) {
      const t = i / n
      this.ride[i] = 0.001 + t * 0.85
    }
  }

  update(dt: number, time: number): void {
    const bright = this.geo.attributes.aBright as THREE.BufferAttribute
    if (this.rideTimer > 0) this.rideTimer = Math.max(0, this.rideTimer - dt)
    for (let i = 0; i < this.count; i++) {
      if (this.ride[i] > 0 && this.rideTimer > 0) {
        this.ride[i] = Math.min(1, this.ride[i] + dt * 0.42)
        const t = this.ride[i]
        const ease = t * t * (3 - 2 * t)
        this.pos[i * 3] = THREE.MathUtils.lerp(this.rideFrom.x, this.rideTo.x, ease) + Math.sin(time * 2 + i) * 0.012
        this.pos[i * 3 + 1] =
          THREE.MathUtils.lerp(this.rideFrom.y, this.rideTo.y, ease) + Math.sin(t * Math.PI) * 0.04
        this.pos[i * 3 + 2] = THREE.MathUtils.lerp(this.rideFrom.z, this.rideTo.z, ease) + Math.cos(time * 2 + i) * 0.012
        this.bright[i] = 0.35 + Math.sin(t * Math.PI) * 0.85
        if (t >= 1) this.ride[i] = 0
      } else {
        this.pos[i * 3] += (this.vel[i * 3] + Math.sin(time * 0.7 + i) * 0.006) * dt
        this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt
        this.pos[i * 3 + 2] += (this.vel[i * 3 + 2] + Math.cos(time * 0.5 + i * 1.3) * 0.006) * dt
        if (this.pos[i * 3 + 1] > 1.6) this.reseed(i)
        this.bright[i] += (0.3 - this.bright[i]) * dt * 0.6
      }
      bright.array[i] = this.bright[i]
    }
    ;(this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true
    bright.needsUpdate = true
  }

  dispose(): void {
    this.geo.dispose()
    this.mat.dispose()
    this.sprite.dispose()
  }
}
