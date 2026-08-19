import * as THREE from 'three'
import type { Flavor } from '../core/flavors'
import { Rng, clamp, damp } from '../core/math'

/**
 * The batter surface inside the bowl. Meringue streaks disappear as the fold
 * progresses, and the surface lifts where the spatula scoops — the child sees
 * "gently mix" without a single word of instruction.
 */
export class BowlBatter {
  readonly mesh: THREE.Mesh
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private texture: THREE.CanvasTexture
  private base: Float32Array
  private lastDrawn = -1
  private flavor: Flavor
  private bulge = 0
  private scoop = new THREE.Vector3(0, 0, 0)
  readonly bubbles: THREE.Points
  private bubbleMat: THREE.PointsMaterial
  readonly radius = 0.1

  constructor(flavor: Flavor) {
    this.flavor = flavor
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.canvas.height = 384
    this.ctx = this.canvas.getContext('2d')!
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace

    const geo = new THREE.RingGeometry(0.0006, this.radius, 72, 14)
    geo.rotateX(-Math.PI / 2)
    this.base = Float32Array.from((geo.getAttribute('position') as THREE.BufferAttribute).array)

    const mat = new THREE.MeshStandardMaterial({
      map: this.texture,
      roughness: 0.34,
      metalness: 0.0,
      side: THREE.DoubleSide,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.receiveShadow = true
    this.mesh.name = 'bowl-batter'

    // Tiny surface bubbles — proof the air is still in there.
    const rng = new Rng(flavor.seed + 11)
    const n = 90
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2)
      const r = this.radius * 0.96 * Math.sqrt(rng.next())
      pos[i * 3] = Math.cos(a) * r
      pos[i * 3 + 1] = 0.0012
      pos[i * 3 + 2] = Math.sin(a) * r
    }
    const bg = new THREE.BufferGeometry()
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    this.bubbleMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.0034,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    })
    this.bubbles = new THREE.Points(bg, this.bubbleMat)
    this.bubbles.renderOrder = 3
    this.mesh.add(this.bubbles)

    this.draw(0)
    this.mesh.scale.setScalar(0.96)
  }

  setFlavor(f: Flavor) {
    this.flavor = f
    this.lastDrawn = -1
    this.draw(0)
    this.mesh.scale.setScalar(0.96)
  }

  /** Redraw the meringue streaks for the current fold progress. */
  private draw(fold: number) {
    const q = Math.round(clamp(fold) * 14) / 14
    if (q === this.lastDrawn) return
    this.lastDrawn = q
    const c = this.ctx
    const s = this.canvas.width
    const base = new THREE.Color(this.flavor.batter)
    const yolk = base.clone().lerp(new THREE.Color(0xffffff), 0.02 + q * 0.07)
    c.fillStyle = `#${yolk.getHexString()}`
    c.fillRect(0, 0, s, s)

    const rng = new Rng(this.flavor.seed + 77)
    const fade = 1 - q
    // broad meringue clouds
    for (let i = 0; i < 26; i++) {
      const x = rng.range(0, s)
      const y = rng.range(0, s)
      const r = rng.range(22, 78) * (0.5 + fade * 0.8)
      const g = c.createRadialGradient(x, y, 1, x, y, r)
      g.addColorStop(0, `rgba(255,253,247,${(0.55 * fade + 0.05).toFixed(3)})`)
      g.addColorStop(1, 'rgba(255,253,247,0)')
      c.fillStyle = g
      c.fillRect(0, 0, s, s)
    }
    // folded streaks: they stretch and thin out rather than vanish
    c.lineCap = 'round'
    for (let i = 0; i < 34; i++) {
      const a0 = rng.range(0, Math.PI * 2) + q * 2.1
      const rad = rng.range(24, s * 0.46)
      c.strokeStyle = `rgba(255,252,244,${(0.7 * fade * fade + 0.06).toFixed(3)})`
      c.lineWidth = rng.range(3, 15) * (0.35 + fade * 0.9)
      c.beginPath()
      for (let k = 0; k <= 12; k++) {
        const a = a0 + (k / 12) * (1.2 + q * 1.6)
        const rr = rad * (1 - k * 0.02)
        const x = s / 2 + Math.cos(a) * rr
        const y = s / 2 + Math.sin(a) * rr
        if (k === 0) c.moveTo(x, y)
        else c.lineTo(x, y)
      }
      c.stroke()
    }
    // fine bubbles baked into the texture
    for (let i = 0; i < 500; i++) {
      const x = rng.range(0, s)
      const y = rng.range(0, s)
      const r = rng.range(0.7, 2.6)
      c.fillStyle = `rgba(255,255,255,${rng.range(0.05, 0.2).toFixed(3)})`
      c.beginPath()
      c.arc(x, y, r, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = `rgba(0,0,0,${rng.range(0.02, 0.07).toFixed(3)})`
      c.beginPath()
      c.arc(x + r * 0.5, y + r * 0.5, r * 0.8, 0, Math.PI * 2)
      c.fill()
    }
    this.texture.needsUpdate = true
  }

  /** Where the spatula blade currently is, in bowl-local space. */
  setScoop(localPos: THREE.Vector3, activity: number) {
    this.scoop.copy(localPos)
    this.bulge = Math.max(this.bulge, clamp(activity))
  }

  setBubbleVisibility(v: number) {
    this.bubbleMat.opacity = clamp(v) * 0.75
  }

  update(dt: number, fold: number, level: number) {
    this.draw(fold)
    this.bulge = damp(this.bulge, 0, 3.4, dt)
    const attr = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    const b = this.bulge
    for (let i = 0; i < arr.length; i += 3) {
      const x = this.base[i]
      const z = this.base[i + 2]
      const d = Math.hypot(x - this.scoop.x, z - this.scoop.z)
      const lift = Math.exp(-(d * d) / 0.0016) * 0.011 * b
      const ripple = Math.sin(d * 90 - performance.now() * 0.004) * 0.0011 * b
      const rim = Math.hypot(x, z) / this.radius
      arr[i + 1] = this.base[i + 1] + lift + ripple + rim * rim * 0.0016
    }
    attr.needsUpdate = true
    this.mesh.geometry.computeVertexNormals()
    this.mesh.position.y = level
    this.mesh.scale.setScalar(0.55 + 0.45 * clamp((level - 0.012) / 0.036 + 0.55))
  }
}
