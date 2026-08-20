/**
 * Ripening as a growing mask over the fruit's own surface parameters.
 *
 * The mask never fades in uniformly: each texel grows at a rate set by how much
 * direct sun it can see, how much light the sheet bounces back onto it, and a
 * per-fruit noise field - so where the sheet is put is legible afterwards in
 * the pattern that is left behind.
 */
import * as THREE from 'three'
import { fbm2 } from './noise'
import { bounceIrradiance, clamp01, type SheetLightState, type V3 } from './lightMath'
import { peachNormal, peachPoint, type PeachShape } from '../scene/peachShape'

export interface Occluder {
  c: V3
  r: number
}

/** Pure growth law, exported so the balance can be unit-tested. */
export function growthRate(sun: number, bounce: number, variation: number, mask: number): number {
  const drive = sun * 0.45 + bounce * 3.2
  return drive * variation * (1 - 0.55 * mask) * 0.26
}

export const BLUSH_RES_U = 96
export const BLUSH_RES_V = 64
const RES_U = BLUSH_RES_U
const RES_V = BLUSH_RES_V

export class BlushField {
  readonly texture: THREE.DataTexture
  readonly mask: Float32Array
  coverage = 0

  private readonly variation: Float32Array
  private readonly sunVis: Float32Array
  private readonly localPos: Float32Array
  private readonly localNrm: Float32Array
  private readonly worldPos: Float32Array
  private readonly worldNrm: Float32Array
  private readonly data: Uint8Array<ArrayBuffer>
  private readonly tmpP: V3 = { x: 0, y: 0, z: 0 }
  private readonly tmpN: V3 = { x: 0, y: 0, z: 0 }
  private lastSun = new THREE.Vector3(0, 1, 0)
  private accum = 0
  private blurAccum = 0
  private dirty = true

  constructor(shape: PeachShape) {
    const n = RES_U * RES_V
    this.mask = new Float32Array(n)
    this.variation = new Float32Array(n)
    this.sunVis = new Float32Array(n).fill(1)
    this.localPos = new Float32Array(n * 3)
    this.localNrm = new Float32Array(n * 3)
    this.worldPos = new Float32Array(n * 3)
    this.worldNrm = new Float32Array(n * 3)
    this.data = new Uint8Array(n * 4)
    this.texture = new THREE.DataTexture(this.data, RES_U, RES_V, THREE.RGBAFormat)
    this.texture.wrapS = THREE.RepeatWrapping
    this.texture.wrapT = THREE.ClampToEdgeWrapping
    this.texture.minFilter = THREE.LinearFilter
    this.texture.magFilter = THREE.LinearFilter
    this.texture.generateMipmaps = false
    this.rebuild(shape)
  }

  rebuild(shape: PeachShape): void {
    for (let j = 0; j < RES_V; j++) {
      const v = (j + 0.5) / RES_V
      for (let i = 0; i < RES_U; i++) {
        const u = (i + 0.5) / RES_U
        const k = j * RES_U + i
        peachPoint(u, v, shape, this.tmpP)
        peachNormal(u, v, shape, this.tmpN)
        this.localPos[k * 3] = this.tmpP.x
        this.localPos[k * 3 + 1] = this.tmpP.y
        this.localPos[k * 3 + 2] = this.tmpP.z
        this.localNrm[k * 3] = this.tmpN.x
        this.localNrm[k * 3 + 1] = this.tmpN.y
        this.localNrm[k * 3 + 2] = this.tmpN.z

        // Blotchy receptivity: some patches simply take colour sooner.
        const a = u * Math.PI * 2
        const n1 = fbm2(Math.cos(a) * 3.1 + 5, Math.sin(a) * 3.1 + v * 4.4, 4, shape.seed + 17)
        const n2 = fbm2(Math.cos(a) * 8.3 + 11, Math.sin(a) * 8.3 + v * 9.7, 3, shape.seed + 53)
        // The stem well ripens last - the classic pale ring round the stalk.
        const stem = Math.min(1, Math.pow(v / 0.24, 1.6))
        this.variation[k] = (0.45 + n1 * 0.85 + n2 * 0.3) * (0.25 + 0.75 * stem)

        // A fruit under a bag is not blank: the shoulder already caught light.
        const up = Math.max(0, this.localNrm[k * 3 + 1])
        this.mask[k] = clamp01(Math.pow(up, 1.8) * 0.3 * (0.6 + n1 * 0.8))
      }
    }
    this.dirty = true
    this.flush()
  }

  /**
   * Mask-weighted centre of colour, relative to the fruit's own centre. This is
   * the number that says "the blush moved", which is the whole point of letting
   * the sheet be moved around.
   */
  centroid(out: THREE.Vector3, origin: THREE.Vector3): THREE.Vector3 {
    let wx = 0
    let wy = 0
    let wz = 0
    let w = 0
    const n = RES_U * RES_V
    for (let k = 0; k < n; k++) {
      const m = this.mask[k]
      if (m <= 0.001) continue
      wx += this.worldPos[k * 3] * m
      wy += this.worldPos[k * 3 + 1] * m
      wz += this.worldPos[k * 3 + 2] * m
      w += m
    }
    if (w <= 0) return out.set(0, 0, 0)
    return out.set(wx / w - origin.x, wy / w - origin.y, wz / w - origin.z)
  }

  /** Restore a mask saved in a previous session. */
  loadMask(src: Float32Array): void {
    if (src.length !== this.mask.length) return
    this.mask.set(src)
    let sum = 0
    for (let i = 0; i < this.mask.length; i++) sum += this.mask[i]
    this.coverage = sum / this.mask.length
    this.dirty = true
    this.flush()
  }

  reset(shape: PeachShape): void {
    this.rebuild(shape)
    this.coverage = 0
  }

  /** Push the peach's world transform into the cached sample points. */
  setTransform(m: THREE.Matrix4): void {
    const nm = new THREE.Matrix3().getNormalMatrix(m)
    const e = m.elements
    const ne = nm.elements
    const n = RES_U * RES_V
    for (let k = 0; k < n; k++) {
      const x = this.localPos[k * 3]
      const y = this.localPos[k * 3 + 1]
      const z = this.localPos[k * 3 + 2]
      this.worldPos[k * 3] = e[0] * x + e[4] * y + e[8] * z + e[12]
      this.worldPos[k * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]
      this.worldPos[k * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]
      const nx = this.localNrm[k * 3]
      const ny = this.localNrm[k * 3 + 1]
      const nz = this.localNrm[k * 3 + 2]
      let wx = ne[0] * nx + ne[3] * ny + ne[6] * nz
      let wy = ne[1] * nx + ne[4] * ny + ne[7] * nz
      let wz = ne[2] * nx + ne[5] * ny + ne[8] * nz
      const l = Math.hypot(wx, wy, wz) || 1
      this.worldNrm[k * 3] = wx / l
      this.worldNrm[k * 3 + 1] = wy / l
      this.worldNrm[k * 3 + 2] = wz / l
    }
    this.lastSun.set(0, 1, 0)
  }

  private recomputeShadow(sunDir: THREE.Vector3, occluders: Occluder[]): void {
    const n = RES_U * RES_V
    for (let k = 0; k < n; k++) {
      const px = this.worldPos[k * 3]
      const py = this.worldPos[k * 3 + 1]
      const pz = this.worldPos[k * 3 + 2]
      let vis = 1
      for (const o of occluders) {
        const ox = o.c.x - px
        const oy = o.c.y - py
        const oz = o.c.z - pz
        const t = ox * sunDir.x + oy * sunDir.y + oz * sunDir.z
        if (t <= 0) continue
        const dx = ox - sunDir.x * t
        const dy = oy - sunDir.y * t
        const dz = oz - sunDir.z * t
        const d = Math.hypot(dx, dy, dz)
        if (d < o.r) {
          // Leaf shadows have soft edges, they do not stamp a hard disc.
          vis *= 0.35 + 0.65 * clamp01((d / o.r - 0.45) / 0.55)
        }
      }
      this.sunVis[k] = vis
    }
  }

  /**
   * @param dSim ripening time delta ("sun steps"), not wall-clock seconds.
   */
  update(
    dt: number,
    dSim: number,
    sheet: SheetLightState,
    sunDir: THREE.Vector3,
    sunStrength: number,
    occluders: Occluder[],
  ): void {
    this.accum += dt
    if (this.accum < 0.09) {
      this.pendingSim += dSim
      return
    }
    const step = this.pendingSim + dSim
    this.pendingSim = 0
    this.accum = 0

    if (this.lastSun.dot(sunDir) < 0.9993) {
      this.recomputeShadow(sunDir, occluders)
      this.lastSun.copy(sunDir)
    }

    const n = RES_U * RES_V
    const p: V3 = this.tmpP
    const nrm: V3 = this.tmpN
    let sum = 0
    for (let k = 0; k < n; k++) {
      p.x = this.worldPos[k * 3]
      p.y = this.worldPos[k * 3 + 1]
      p.z = this.worldPos[k * 3 + 2]
      nrm.x = this.worldNrm[k * 3]
      nrm.y = this.worldNrm[k * 3 + 1]
      nrm.z = this.worldNrm[k * 3 + 2]
      const sun = Math.max(0, nrm.x * sunDir.x + nrm.y * sunDir.y + nrm.z * sunDir.z) * this.sunVis[k] * sunStrength
      const bounce = bounceIrradiance(p, nrm, sheet, { x: sunDir.x, y: sunDir.y, z: sunDir.z }, sunStrength)
      const m = this.mask[k]
      const next = clamp01(m + growthRate(sun, bounce, this.variation[k], m) * step)
      this.mask[k] = next
      sum += next
      // Blue channel carries live bounce so the shader can lift the down.
      this.data[k * 4 + 2] = Math.min(255, bounce * 900)
    }
    this.coverage = sum / n

    this.blurAccum += 1
    if (this.blurAccum >= 6) {
      this.blurAccum = 0
      this.softenEdges()
    }
    this.dirty = true
    this.flush()
    void dt
  }

  private pendingSim = 0

  /** A touch of lateral bleed so the boundary looks grown, not stencilled. */
  private softenEdges(): void {
    const src = this.mask.slice()
    for (let j = 1; j < RES_V - 1; j++) {
      for (let i = 0; i < RES_U; i++) {
        const im = (i - 1 + RES_U) % RES_U
        const ip = (i + 1) % RES_U
        const k = j * RES_U + i
        const avg =
          (src[k] * 4 + src[j * RES_U + im] + src[j * RES_U + ip] + src[(j - 1) * RES_U + i] + src[(j + 1) * RES_U + i]) / 8
        this.mask[k] = src[k] + (avg - src[k]) * 0.35
      }
    }
  }

  private flush(): void {
    if (!this.dirty) return
    const n = RES_U * RES_V
    for (let k = 0; k < n; k++) {
      this.data[k * 4] = this.mask[k] * 255
      this.data[k * 4 + 1] = Math.min(255, this.variation[k] * 120)
      this.data[k * 4 + 3] = 255
    }
    this.texture.needsUpdate = true
    this.dirty = false
  }

  dispose(): void {
    this.texture.dispose()
  }
}
