/**
 * The reflective ground sheet: a rolled agricultural material, not a board and
 * not a mirror. It unwinds off a roll whose radius shrinks as it empties, drops
 * over the soil's bumps, keeps its machine folds, lifts at the edges in the
 * wind, and can be folded back on itself.
 *
 * It also publishes the quad that the whole lighting model integrates over,
 * so how it is laid out is literally how the fruit is lit.
 */
import * as THREE from 'three'
import { makeSheetTextures, type SurfaceTextures } from './textures'
import { groundHeight } from './terrain'
import { withBounce } from './bounceMaterial'
import { makeRng } from '../sim/noise'
import type { V3 } from '../sim/lightMath'
import type { LightRig } from './lightRig'
import type { QualitySettings } from '../core/quality'

const THICKNESS = 0.0042

export interface SheetConfig {
  seed: number
  length: number
  width: number
  /** Ground contact point of the roll. */
  origin: THREE.Vector3
  /** Horizontal unit vector the sheet is pulled along. */
  pullDir: THREE.Vector3
}

export interface SheetPose {
  deploy: number
  lateral: number
  reach: number
  fold: number
  /** 0 = just disturbed, 1 = settled under its own weight. */
  settle: number
}

export class ReflectorSheet {
  readonly group = new THREE.Group()
  readonly mesh: THREE.Mesh
  readonly pose: SheetPose = { deploy: 0.13, lateral: 0, reach: 0, fold: 0.52, settle: 1 }

  private geometry: THREE.BufferGeometry
  private material: THREE.MeshPhysicalMaterial
  private textures: SurfaceTextures
  private nl: number
  private nw: number
  private posArr: Float32Array
  private nrmArr: Float32Array
  private cfg: SheetConfig
  private creaseAt: number[]
  private time = 0
  private glow: THREE.IUniform<number> = { value: 0 }
  private hintLift = 0

  private readonly dirV = new THREE.Vector3()
  private readonly perpV = new THREE.Vector3()
  private readonly originV = new THREE.Vector3()
  private readonly quadCorners: [V3, V3, V3, V3] = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ]

  constructor(
    private rig: LightRig,
    q: QualitySettings,
    cfg: SheetConfig,
  ) {
    this.cfg = cfg
    this.nl = q.sheetSegments
    this.nw = 14
    const rng = makeRng((cfg.seed * 104729) | 0)
    this.creaseAt = Array.from({ length: 9 }, (_, i) => (i + 0.5) / 9 + (rng() - 0.5) * 0.03)

    this.textures = makeSheetTextures(cfg.seed)
    this.textures.map.repeat.set(1, 2)
    this.textures.normalMap.repeat.set(1, 2)
    this.textures.roughnessMap.repeat.set(1, 2)

    this.geometry = new THREE.BufferGeometry()
    const count = (this.nl + 1) * (this.nw + 1)
    this.posArr = new Float32Array(count * 3)
    this.nrmArr = new Float32Array(count * 3)
    const uv = new Float32Array(count * 2)
    const idx: number[] = []
    for (let j = 0; j <= this.nl; j++) {
      for (let i = 0; i <= this.nw; i++) {
        const k = j * (this.nw + 1) + i
        uv[k * 2] = i / this.nw
        uv[k * 2 + 1] = j / this.nl
      }
    }
    for (let j = 0; j < this.nl; j++) {
      for (let i = 0; i < this.nw; i++) {
        const a = j * (this.nw + 1) + i
        const b = a + 1
        const c = a + this.nw + 1
        const d = c + 1
        idx.push(a, c, b, b, c, d)
      }
    }
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3))
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(this.nrmArr, 3))
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    this.geometry.setIndex(idx)

    this.material = withBounce(
      new THREE.MeshPhysicalMaterial({
        map: this.textures.map,
        normalMap: this.textures.normalMap,
        roughnessMap: this.textures.roughnessMap,
        normalScale: new THREE.Vector2(1.25, 1.25),
        roughness: 1,
        metalness: 0,
        side: THREE.DoubleSide,
        sheen: 0.12,
        sheenColor: new THREE.Color(0xffffff),
        sheenRoughness: 0.92,
        envMapIntensity: 0.16,
      }),
      rig,
      {
        uniforms: { uSheetGlow: this.glow },
        fragmentCommon: 'uniform float uSheetGlow;',
        afterMap: /* glsl */ `
          if (!gl_FrontFacing) {
            // Woven backing: duller and greyer, clearly the wrong side of the
            // material - but still the same material, not a black hole.
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.44, 0.44, 0.41), 0.66);
          }
        `,
        afterOpaque: /* glsl */ `
          if (gl_FrontFacing) {
            gl_FragColor.rgb *= 1.0 + uSheetGlow * 0.16;
          }
        `,
      },
    )

    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.receiveShadow = true
    this.mesh.castShadow = false
    this.mesh.frustumCulled = false
    this.group.add(this.mesh)
    this.rebuildGeometry()
  }

  setQuality(q: QualitySettings): void {
    if (q.sheetSegments === this.nl) return
    this.nl = q.sheetSegments
    const count = (this.nl + 1) * (this.nw + 1)
    this.posArr = new Float32Array(count * 3)
    this.nrmArr = new Float32Array(count * 3)
    const uv = new Float32Array(count * 2)
    const idx: number[] = []
    for (let j = 0; j <= this.nl; j++) {
      for (let i = 0; i <= this.nw; i++) {
        const k = j * (this.nw + 1) + i
        uv[k * 2] = i / this.nw
        uv[k * 2 + 1] = j / this.nl
      }
    }
    for (let j = 0; j < this.nl; j++) {
      for (let i = 0; i < this.nw; i++) {
        const a = j * (this.nw + 1) + i
        const b = a + 1
        const c = a + this.nw + 1
        const d = c + 1
        idx.push(a, c, b, b, c, d)
      }
    }
    this.geometry.dispose()
    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3))
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(this.nrmArr, 3))
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    this.geometry.setIndex(idx)
    this.mesh.geometry = this.geometry
    this.rebuildGeometry()
  }

  reseed(cfg: SheetConfig): void {
    this.cfg = cfg
    this.textures.dispose()
    this.textures = makeSheetTextures(cfg.seed)
    this.textures.map.repeat.set(1, 2)
    this.textures.normalMap.repeat.set(1, 2)
    this.textures.roughnessMap.repeat.set(1, 2)
    this.material.map = this.textures.map
    this.material.normalMap = this.textures.normalMap
    this.material.roughnessMap = this.textures.roughnessMap
    this.material.needsUpdate = true
    const rng = makeRng((cfg.seed * 104729) | 0)
    this.creaseAt = Array.from({ length: 9 }, (_, i) => (i + 0.5) / 9 + (rng() - 0.5) * 0.03)
    this.pose.deploy = 0.13
    this.pose.lateral = 0
    this.pose.reach = 0
    this.pose.fold = 0.52
    this.pose.settle = 1
    this.rebuildGeometry()
  }

  /** Roll radius from the length still wound on: an emptying roll gets thin. */
  private rollRadius(remaining: number): number {
    return Math.max(0.014, Math.sqrt(Math.max(0, remaining) * THICKNESS * 1.9) / Math.sqrt(Math.PI) + 0.012)
  }

  /** A length of sheet is already lying on the ground before anyone touches it. */
  static readonly LAID = 0.28
  static readonly BY_PULL = 0.62
  static readonly BY_REACH = 0.12

  private deployedLength(): number {
    const p = this.pose
    return Math.min(
      this.cfg.length * 0.97,
      this.cfg.length * (ReflectorSheet.LAID + p.deploy * ReflectorSheet.BY_PULL + p.reach * ReflectorSheet.BY_REACH),
    )
  }

  /** Inverse of the above: what deploy / reach put the free end at `along`? */
  static solveFromAlong(along: number, length: number): { deploy: number; reach: number } {
    const t = along / Math.max(0.01, length) - ReflectorSheet.LAID
    const deploy = Math.min(1, Math.max(0, t / ReflectorSheet.BY_PULL))
    const reach = Math.min(1, Math.max(0, (t - ReflectorSheet.BY_PULL) / ReflectorSheet.BY_REACH))
    return { deploy, reach }
  }

  private updateFrame(): void {
    const p = this.pose
    // Sideways placement mostly swings the far end round the roll, which is
    // both what a person would actually do and what reads on a small screen.
    const angle = p.lateral * 0.45
    this.dirV.copy(this.cfg.pullDir).setY(0).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
    this.perpV.set(-this.dirV.z, 0, this.dirV.x)
    this.originV.copy(this.cfg.origin).addScaledVector(this.perpV, p.lateral * 0.16)
  }

  private creaseHeight(sNorm: number): number {
    let h = 0
    for (const c of this.creaseAt) {
      const d = (sNorm - c) / 0.011
      h += Math.exp(-d * d) * 0.0055
    }
    return h
  }

  /** Softened ground sample - the sheet bridges small stones instead of shrink-wrapping them. */
  private drapeHeight(x: number, z: number): number {
    const h0 = groundHeight(x, z)
    const h1 = groundHeight(x + 0.05, z + 0.03)
    const h2 = groundHeight(x - 0.04, z - 0.05)
    const h3 = groundHeight(x + 0.02, z - 0.06)
    return Math.max(h0, (h0 * 2 + h1 + h2 + h3) / 5)
  }

  rebuildGeometry(): void {
    this.updateFrame()
    const { length: L, width: W } = this.cfg
    const D = this.deployedLength()
    const remaining = Math.max(0, L - D)
    const r = this.rollRadius(remaining)
    const foldLen = this.pose.fold * 0.32 * L
    const unsettled = 1 - this.pose.settle
    const t = this.time

    const dir = this.dirV
    const perp = this.perpV
    const o = this.originV
    const cx = o.x
    const cz = o.z
    const groundAtRoll = groundHeight(cx, cz)

    for (let j = 0; j <= this.nl; j++) {
      const sNorm = j / this.nl
      const s = sNorm * L
      let sEff = s
      let flipped = false
      if (foldLen > 0.001 && s < foldLen) {
        sEff = 2 * foldLen - s
        flipped = true
      }
      for (let i = 0; i <= this.nw; i++) {
        const wT = i / this.nw
        // The roll was never cut perfectly straight.
        const widthJitter = 1 + Math.sin(sNorm * 21.7 + this.cfg.seed) * 0.018 + Math.sin(sNorm * 7.3) * 0.012
        const w = (wT - 0.5) * W * widthJitter
        const k = (j * (this.nw + 1) + i) * 3
        const edge = Math.max(0, (Math.abs(wT - 0.5) * 2 - 0.5) / 0.5)

        if (sEff <= D) {
          const along = D - sEff
          const x = cx + dir.x * along + perp.x * w
          const z = cz + dir.z * along + perp.z * w
          let y = this.drapeHeight(x, z) + THICKNESS
          y += this.creaseHeight(sEff / L)
          // Wind riffle at the free edges, stronger while the sheet is still moving.
          const flap = Math.sin(along * 5.3 + t * 2.1 + w * 3.1) * 0.5 + 0.5
          y += edge * edge * (0.013 + 0.016 * unsettled) * flap
          // The whole span breathes for a moment after it is dragged.
          y += unsettled * 0.014 * Math.sin(along * 6.2 - t * 3.6) * Math.sin(Math.PI * Math.min(1, along / Math.max(0.001, D)))
          // A single scripted lift of the leading corner: the game's only nudge.
          if (this.hintLift > 0 && sEff < L * 0.14) {
            const tipT = 1 - sEff / (L * 0.14)
            y += this.hintLift * 0.05 * tipT * Math.max(0, wT - 0.35)
          }
          if (flipped) y += THICKNESS * 2.2
          this.posArr[k] = x
          this.posArr[k + 1] = y
          this.posArr[k + 2] = z
        } else {
          const arc = sEff - D
          const theta = arc / r
          const rr = r * Math.max(0.35, 1 - theta * THICKNESS * 2.4)
          const x = cx - dir.x * rr * Math.sin(theta) + perp.x * w
          const z = cz - dir.z * rr * Math.sin(theta) + perp.z * w
          const y = groundAtRoll + r - rr * Math.cos(theta) + THICKNESS
          this.posArr[k] = x
          this.posArr[k + 1] = y + edge * 0.002 * Math.sin(theta * 3 + w * 9)
          this.posArr[k + 2] = z
        }
      }
    }

    this.computeNormals()
    this.geometry.attributes.position.needsUpdate = true
    this.geometry.attributes.normal.needsUpdate = true
    this.geometry.computeBoundingSphere()
    this.publishQuad(D, foldLen)
  }

  private computeNormals(): void {
    const stride = this.nw + 1
    for (let j = 0; j <= this.nl; j++) {
      for (let i = 0; i <= this.nw; i++) {
        const k = j * stride + i
        const jm = Math.max(0, j - 1)
        const jp = Math.min(this.nl, j + 1)
        const im = Math.max(0, i - 1)
        const ip = Math.min(this.nw, i + 1)
        const a = (jp * stride + i) * 3
        const b = (jm * stride + i) * 3
        const c = (j * stride + ip) * 3
        const d = (j * stride + im) * 3
        const ax = this.posArr[a] - this.posArr[b]
        const ay = this.posArr[a + 1] - this.posArr[b + 1]
        const az = this.posArr[a + 2] - this.posArr[b + 2]
        const bx = this.posArr[c] - this.posArr[d]
        const by = this.posArr[c + 1] - this.posArr[d + 1]
        const bz = this.posArr[c + 2] - this.posArr[d + 2]
        let nx = ay * bz - az * by
        let ny = az * bx - ax * bz
        let nz = ax * by - ay * bx
        const l = Math.hypot(nx, ny, nz) || 1
        nx /= l
        ny /= l
        nz /= l
        if (ny < 0) {
          nx = -nx
          ny = -ny
          nz = -nz
        }
        this.nrmArr[k * 3] = nx
        this.nrmArr[k * 3 + 1] = ny
        this.nrmArr[k * 3 + 2] = nz
      }
    }
  }

  /** The area source the lighting model integrates: only the single-thickness,
   *  bright-side-up span counts. Folding the end back really does dim the fruit. */
  private publishQuad(D: number, foldLen: number): void {
    const halfW = this.cfg.width * 0.5
    const front = Math.max(0, D - foldLen)
    const back = 0
    const y = groundHeight(this.originV.x, this.originV.z) + 0.012
    const dir = this.dirV
    const perp = this.perpV
    const o = this.originV
    const set = (n: number, along: number, side: number) => {
      const c = this.quadCorners[n]
      c.x = o.x + dir.x * along + perp.x * side * halfW
      c.y = y
      c.z = o.z + dir.z * along + perp.z * side * halfW
    }
    set(0, back, -1)
    set(1, front, -1)
    set(2, front, 1)
    set(3, back, 1)
    const usable = Math.max(0, front - back)
    const deployedFrac = Math.min(1, usable / (this.cfg.length * 0.45))
    this.rig.setSheetQuad(this.quadCorners, { x: 0, y: 1, z: 0 }, deployedFrac)
  }

  /** World position of the free end - hit target and hint anchor. */
  tipWorld(out: THREE.Vector3): THREE.Vector3 {
    this.updateFrame()
    const D = this.deployedLength()
    const foldLen = this.pose.fold * 0.32 * this.cfg.length
    const along = Math.max(0, D - 2 * foldLen)
    out.set(
      this.originV.x + this.dirV.x * along,
      groundHeight(this.originV.x + this.dirV.x * along, this.originV.z + this.dirV.z * along) + 0.02,
      this.originV.z + this.dirV.z * along,
    )
    return out
  }

  rollWorld(out: THREE.Vector3): THREE.Vector3 {
    this.updateFrame()
    out.copy(this.originV)
    out.y = groundHeight(out.x, out.z) + this.rollRadius(this.cfg.length - this.deployedLength())
    return out
  }

  centerWorld(out: THREE.Vector3): THREE.Vector3 {
    this.updateFrame()
    const D = this.deployedLength() * 0.5
    out.set(this.originV.x + this.dirV.x * D, 0, this.originV.z + this.dirV.z * D)
    out.y = groundHeight(out.x, out.z) + 0.02
    return out
  }

  get direction(): THREE.Vector3 {
    return this.dirV
  }

  get lateralAxis(): THREE.Vector3 {
    return this.perpV
  }

  pulse(amount: number): void {
    this.glow.value = Math.max(this.glow.value, amount)
  }

  setHintLift(v: number): void {
    this.hintLift = v
  }

  update(dt: number): void {
    this.time += dt
    this.glow.value *= Math.exp(-dt * 0.55)
    this.pose.settle = Math.min(1, this.pose.settle + dt * 0.85)
    this.rebuildGeometry()
  }

  disturb(): void {
    this.pose.settle = 0
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
    this.textures.dispose()
  }
}
