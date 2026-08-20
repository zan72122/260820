/**
 * The fruit-protection paper bag. It has real thickness, panel folds from being
 * flat-packed, a wired mouth at the top and a crinkled open hem at the bottom.
 * Pulling the hem down stretches and crumples the paper before it lets go, and
 * while it slides it bulges around the fruit inside.
 */
import * as THREE from 'three'
import { fbm2, makeRng } from '../sim/noise'
import { makePaperTextures, type SurfaceTextures } from './textures'
import type { PeachShape } from './peachShape'

export interface BagShape {
  seed: number
  radius: number
  height: number
  facets: number
  facetAmp: number
  facetPhase: number
  hemWave: number
}

export function makeBagShape(seed: number): BagShape {
  const rng = makeRng((seed * 40503) | 0)
  return {
    seed,
    radius: 0.078 + rng() * 0.012,
    height: 0.26 + rng() * 0.05,
    facets: 4 + Math.floor(rng() * 3),
    facetAmp: 0.09 + rng() * 0.06,
    facetPhase: rng() * Math.PI * 2,
    hemWave: 0.5 + rng() * 0.6,
  }
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a || 1e-9))
  return t * t * (3 - 2 * t)
}

/** Half-width of the fruit at a given height, so the paper can ride over it. */
function fruitRadiusAt(yLocal: number, peach: PeachShape): number {
  const half = peach.radius * peach.squash
  const t = clamp01(Math.abs(yLocal) / half)
  return peach.radius * Math.sqrt(Math.max(0, 1 - t * t)) * 1.02
}

export class PaperBag {
  readonly group = new THREE.Group()
  readonly mesh: THREE.Mesh
  private geometry: THREE.BufferGeometry
  private material: THREE.MeshPhysicalMaterial
  private textures: SurfaceTextures
  private tie: THREE.Mesh
  private readonly nu = 44
  private readonly nv = 26
  private posArr: Float32Array
  private nrmArr: Float32Array
  private shape: BagShape
  private peach: PeachShape
  private time = 0

  /** 0 = seated on the branch, 1 = fully off the fruit. */
  pull = 0
  /** Independent post-release fall, 0..1. */
  fall = 0
  /** Small wind flutter of the hem before anything is touched. */
  hemHint = 0

  constructor(shape: BagShape, peach: PeachShape) {
    this.shape = shape
    this.peach = peach
    this.textures = makePaperTextures(shape.seed)
    const count = (this.nu + 1) * (this.nv + 1)
    this.posArr = new Float32Array(count * 3)
    this.nrmArr = new Float32Array(count * 3)
    const uv = new Float32Array(count * 2)
    const idx: number[] = []
    for (let j = 0; j <= this.nv; j++) {
      for (let i = 0; i <= this.nu; i++) {
        const k = j * (this.nu + 1) + i
        uv[k * 2] = i / this.nu
        uv[k * 2 + 1] = j / this.nv
      }
    }
    for (let j = 0; j < this.nv; j++) {
      for (let i = 0; i < this.nu; i++) {
        const a = j * (this.nu + 1) + i
        const b = a + 1
        const c = a + this.nu + 1
        const d = c + 1
        idx.push(a, c, b, b, c, d)
      }
    }
    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3))
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(this.nrmArr, 3))
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    this.geometry.setIndex(idx)

    this.material = new THREE.MeshPhysicalMaterial({
      map: this.textures.map,
      normalMap: this.textures.normalMap,
      roughnessMap: this.textures.roughnessMap,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      sheen: 0.1,
      sheenColor: new THREE.Color(0xfff0d8),
      sheenRoughness: 0.95,
      envMapIntensity: 0.2,
    })
    this.material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         if (!gl_FrontFacing) {
           // Inside the bag: same paper, but in its own shadow.
           diffuseColor.rgb *= vec3(0.44, 0.40, 0.34);
         }`,
      )
    }
    this.material.customProgramCacheKey = () => 'momo-bag'

    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    this.mesh.frustumCulled = false
    this.group.add(this.mesh)

    const tieGeo = new THREE.TorusGeometry(0.012, 0.0022, 6, 20)
    const tieMat = new THREE.MeshStandardMaterial({ color: 0x8b7f63, roughness: 0.72, metalness: 0.15 })
    this.tie = new THREE.Mesh(tieGeo, tieMat)
    this.tie.rotation.x = Math.PI / 2
    this.tie.castShadow = true
    this.group.add(this.tie)

    this.rebuild()
  }

  reshape(shape: BagShape, peach: PeachShape): void {
    this.shape = shape
    this.peach = peach
    this.textures.dispose()
    this.textures = makePaperTextures(shape.seed)
    this.material.map = this.textures.map
    this.material.normalMap = this.textures.normalMap
    this.material.roughnessMap = this.textures.roughnessMap
    this.material.needsUpdate = true
    this.pull = 0
    this.fall = 0
    this.hemHint = 0
    this.group.visible = true
    this.rebuild()
  }

  private rebuild(): void {
    const s = this.shape
    const t = this.time
    const pull = clamp01(this.pull)
    // Paper stretches a little before it releases, then it simply slides.
    const stretch = 1 + smoothstep(0, 0.4, pull) * 0.22 * (1 - smoothstep(0.45, 0.85, pull))
    const slide = Math.pow(pull, 1.35) * (s.height * 0.62 + this.peach.radius * 2.1)
    const crumple = smoothstep(0, 0.35, pull) * (1 - smoothstep(0.75, 1, pull)) * 0.8 + this.fall * 0.7
    const openTop = smoothstep(0.3, 0.75, pull)

    const top = s.height * 0.5

    for (let j = 0; j <= this.nv; j++) {
      const v = j / this.nv
      for (let i = 0; i <= this.nu; i++) {
        const u = i / this.nu
        const phi = u * Math.PI * 2
        const k = (j * (this.nu + 1) + i) * 3

        // Vertical profile: gathered and wired at the top, flared open at the hem.
        let R = s.radius
        R *= 0.94 + 0.1 * Math.sin(v * Math.PI * 0.9)
        const gather = smoothstep(0, 0.16, v)
        R *= 0.13 + 0.87 * gather
        // Once the tie lets go the throat opens up.
        R *= 1 + openTop * (1 - gather) * 5.4
        R *= 1 + smoothstep(0.82, 1, v) * 0.16

        // Flat-pack panel folds - the bag is not a cylinder of revolution.
        R *= 1 + s.facetAmp * Math.cos(s.facets * phi + s.facetPhase) + s.facetAmp * 0.45 * Math.cos(s.facets * 2 * phi + s.facetPhase * 1.7)

        // Crumple, which only really appears while the paper is being worked.
        const cn = fbm2(Math.cos(phi) * 3.4 + 7, Math.sin(phi) * 3.4 + v * 6.2, 3, s.seed + 5) - 0.5
        const cn2 = fbm2(Math.cos(phi) * 9.1 + 2, Math.sin(phi) * 9.1 + v * 13.0, 2, s.seed + 61) - 0.5
        R *= 1 + (cn * 0.12 + cn2 * 0.06) * (0.35 + crumple)

        let y = top - v * s.height * stretch - slide

        // Ride over the fruit: the paper cannot pass through it.
        const rf = fruitRadiusAt(y, this.peach)
        if (rf > 0 && v > 0.08) {
          const ride = smoothstep(0.06, 0.3, v)
          R = Math.max(R, rf * (1.04 + 0.05 * ride))
        }

        // Crinkled hem, plus the single wind flutter used as a first-time hint.
        if (v > 0.9) {
          const hemT = (v - 0.9) / 0.1
          const wave = Math.sin(phi * 5 + s.hemWave * 6) * 0.6 + Math.sin(phi * 11 + 1.7) * 0.32
          y += wave * 0.013 * hemT
          R *= 1 + wave * 0.06 * hemT
          const flutter = this.hemHint * Math.sin(phi * 2.0 + t * 3.4) * 0.5 + this.hemHint * 0.5
          R *= 1 + flutter * 0.1 * hemT
          y += flutter * 0.012 * hemT
        }

        this.posArr[k] = Math.cos(phi) * R
        this.posArr[k + 1] = y
        this.posArr[k + 2] = Math.sin(phi) * R
      }
    }

    this.computeNormals()
    this.geometry.attributes.position.needsUpdate = true
    this.geometry.attributes.normal.needsUpdate = true
    this.geometry.computeBoundingSphere()

    this.tie.position.set(0, top - slide + 0.002, 0)
    this.tie.scale.setScalar(1 + openTop * 2.2)
    this.tie.visible = openTop < 0.6
  }

  private computeNormals(): void {
    const stride = this.nu + 1
    for (let j = 0; j <= this.nv; j++) {
      for (let i = 0; i <= this.nu; i++) {
        const k = j * stride + i
        const jm = Math.max(0, j - 1)
        const jp = Math.min(this.nv, j + 1)
        const im = (i - 1 + this.nu) % this.nu
        const ip = (i + 1) % this.nu
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
        let nx = by * az - bz * ay
        let ny = bz * ax - bx * az
        let nz = bx * ay - by * ax
        const l = Math.hypot(nx, ny, nz) || 1
        this.nrmArr[k * 3] = nx / l
        this.nrmArr[k * 3 + 1] = ny / l
        this.nrmArr[k * 3 + 2] = nz / l
      }
    }
  }

  /** Local Y of the open hem - the only place a finger is ever asked to go. */
  hemY(): number {
    const s = this.shape
    const pull = clamp01(this.pull)
    const stretch = 1 + smoothstep(0, 0.4, pull) * 0.22 * (1 - smoothstep(0.45, 0.85, pull))
    const slide = Math.pow(pull, 1.35) * (s.height * 0.62 + this.peach.radius * 2.1)
    return s.height * 0.5 - s.height * stretch - slide
  }

  update(dt: number): void {
    this.time += dt
    this.rebuild()
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
    this.textures.dispose()
    this.tie.geometry.dispose()
    ;(this.tie.material as THREE.Material).dispose()
  }
}
