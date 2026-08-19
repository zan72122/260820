import * as THREE from 'three'
import { MeshBuilder } from './geom'
import { Rng, clamp } from './rng'
import {
  COLORS,
  CROP_DX,
  CROP_DZ,
  CROP_JITTER,
  FIELD_L,
  FIELD_W,
  HEADLAND,
  HALF_L,
  HALF_W,
  LANE_COUNT,
  LANE_W,
  PADDY_HALF_L,
  QUALITY,
  laneX,
} from './config'
import type { SoilSet } from './textures'
import { paddyHeight } from './terrain'

/* ------------------------------------------------------------------ *
 * The paddy: ground carrying a live "what has been cut" mask, the
 * standing rice (two levels of detail, instanced) and the stubble.
 * ------------------------------------------------------------------ */

const MASK_RES = 256
const GROUND_W = FIELD_W + 1.6
const GROUND_L = PADDY_HALF_L * 2 + 1.6
const Y_AXIS = new THREE.Vector3(0, 1, 0)

/** One rice hill: a few culms with heavy, drooping panicles. */
function riceClumpGeometry(detail: boolean): THREE.BufferGeometry {
  const b = new MeshBuilder()
  const rng = new Rng(detail ? 4242 : 909)
  const stalks = detail ? 3 : 3

  const cStem = new THREE.Color(COLORS.riceStem)
  const cGreen = new THREE.Color(COLORS.riceGreen)
  const cGold = new THREE.Color(COLORS.riceGold)
  const cTip = new THREE.Color(COLORS.riceTip)

  for (let s = 0; s < stalks; s++) {
    const a = (s / stalks) * Math.PI * 2 + rng.range(-0.5, 0.5)
    const spread = rng.range(0.015, 0.075)
    const bx = Math.cos(a) * spread
    const bz = Math.sin(a) * spread
    const h = rng.range(0.76, 0.94)
    const leanX = Math.cos(a) * rng.range(0.05, 0.15)
    const leanZ = Math.sin(a) * rng.range(0.05, 0.15)

    if (detail) {
      // --- culm: thin, upright, greener at the node than at the neck ---
      const seg = 3
      const stemPts: THREE.Vector3[] = []
      const stemR: number[] = []
      const stemC: THREE.Color[] = []
      for (let i = 0; i <= seg; i++) {
        const t = i / seg
        stemPts.push(new THREE.Vector3(bx + leanX * t * t, h * t, bz + leanZ * t * t))
        stemR.push(0.008 * (1 - t * 0.35))
        stemC.push(cStem.clone().lerp(cGreen, t * 0.55))
      }
      b.strand(stemPts, stemR, stemC, 3)

      // --- panicle: bows right over under the weight of its own grain.
      // The radius pulses along its length so the silhouette is lumpy —
      // that reads as individual spikelets from a metre away.
      const top = stemPts[seg]
      const pl = rng.range(0.19, 0.27)
      const dirA = a + rng.range(-0.8, 0.8)
      const pts: THREE.Vector3[] = []
      const rad: number[] = []
      const cols: THREE.Color[] = []
      const pseg = 10
      for (let i = 0; i <= pseg; i++) {
        const t = i / pseg
        const droop = t * t * 1.35
        pts.push(
          new THREE.Vector3(
            top.x + Math.cos(dirA) * pl * Math.sin(t * 1.4) * 1.15,
            top.y + pl * 0.5 * Math.sin(t * 1.05) - droop * pl * 1.05,
            top.z + Math.sin(dirA) * pl * Math.sin(t * 1.4) * 1.15,
          ),
        )
        const swell = Math.sin(Math.min(1, t * 1.35) * Math.PI) * 0.75 + 0.25
        const bump = 1 + 0.42 * Math.sin(t * 30 + s * 2.1)
        rad.push((0.0035 + 0.0075 * swell) * bump)
        cols.push(cGreen.clone().lerp(cGold, clamp(t * 2.0, 0, 1)).lerp(cTip, t * t * 0.75))
      }
      b.strand(pts, rad, cols, 3, 0.62)
    } else {
      // --- far LOD: a thin culm that bows over at the tip, so the
      // silhouette still says "heavy ear of rice" from twenty metres
      const pts: THREE.Vector3[] = []
      const rad: number[] = []
      const cols: THREE.Color[] = []
      const seg = 4
      const bend = rng.range(0.24, 0.38)
      for (let i = 0; i <= seg; i++) {
        const t = i / seg
        const droop = t * t * t * bend
        pts.push(
          new THREE.Vector3(
            bx + leanX * t * t + Math.cos(a) * droop * 1.3,
            h * 1.12 * t - droop * 0.85,
            bz + leanZ * t * t + Math.sin(a) * droop * 1.3,
          ),
        )
        rad.push(t < 0.5 ? 0.0085 * (1 - t * 0.3) : 0.0065 + 0.013 * Math.sin((t - 0.5) * 6.1))
        cols.push(cStem.clone().lerp(cGold, clamp(t * 1.7, 0, 1)).lerp(cTip, t * t * 0.6))
      }
      b.strand(pts, rad, cols, 3)
    }
  }

  if (detail) {
    for (let l = 0; l < 2; l++) {
      const a = rng.range(0, Math.PI * 2)
      const len = rng.range(0.42, 0.6)
      const pts: THREE.Vector3[] = []
      const w: number[] = []
      const cols: THREE.Color[] = []
      const seg = 4
      for (let i = 0; i <= seg; i++) {
        const t = i / seg
        pts.push(
          new THREE.Vector3(
            Math.cos(a) * len * t * 0.85,
            len * (0.95 * t - 0.85 * t * t) + 0.06,
            Math.sin(a) * len * t * 0.85,
          ),
        )
        w.push(0.0075 * (1 - t * 0.75) + 0.0022)
        cols.push(cGreen.clone().lerp(cGold, t * 0.55).multiplyScalar(0.92))
      }
      b.ribbon(pts, w, cols)
    }
  }

  return b.build()
}

/** What the cutter bar leaves: a fistful of bright, sharply cut culms. */
function stubbleGeometry(): THREE.BufferGeometry {
  const b = new MeshBuilder()
  const rng = new Rng(77)
  const cBase = new THREE.Color(0x9c9a55)
  const cCut = new THREE.Color(0xe9e0a6)
  for (let s = 0; s < 5; s++) {
    const a = rng.range(0, Math.PI * 2)
    const r = rng.range(0.01, 0.08)
    const h = rng.range(0.1, 0.17)
    b.strand(
      [
        new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r),
        new THREE.Vector3(Math.cos(a) * (r + h * 0.22), h, Math.sin(a) * (r + h * 0.22)),
      ],
      [0.011, 0.008],
      [cBase, cCut],
      3,
    )
  }
  return b.build()
}

export interface CutHit {
  index: number
  x: number
  z: number
}

type InstAttrs = {
  cut: THREE.InstancedBufferAttribute
  yaw: THREE.InstancedBufferAttribute
  cutYaw: THREE.InstancedBufferAttribute
}

export class Field {
  readonly group = new THREE.Group()

  readonly count: number
  readonly cx: Float32Array
  readonly cz: Float32Array
  readonly cy: Float32Array
  readonly cyaw: Float32Array
  readonly cscale: Float32Array
  /** -1 = standing, otherwise the time it was felled */
  readonly cutAt: Float32Array
  readonly cutHeading: Float32Array
  readonly laneOf: Int32Array
  readonly laneRemaining: Int32Array
  standing: number
  laneThreshold = 4

  private grid!: { cols: number; rows: number; cell: number; start: Int32Array; items: Int32Array }
  private instanceTint!: Float32Array

  private nearMesh!: THREE.InstancedMesh
  private farMesh!: THREE.InstancedMesh
  private nearSlot: Int32Array
  private farSlot: Int32Array
  private nearAttr!: InstAttrs
  private farAttr!: InstAttrs
  private nearList: Int32Array
  private farList: Int32Array
  private nearRadius = 8

  private mask!: HTMLCanvasElement
  private maskCtx!: CanvasRenderingContext2D
  private maskTex!: THREE.CanvasTexture
  private maskDirty = false
  private maskFlush = 0

  readonly uniforms = {
    uTime: { value: 0 },
    uWind: { value: new THREE.Vector2(0.85, 0.3) },
  }

  private tmpMat = new THREE.Matrix4()
  private tmpQ = new THREE.Quaternion()
  private tmpP = new THREE.Vector3()
  private tmpS = new THREE.Vector3()
  private tmpC = new THREE.Color()
  private focusX = 1e9
  private focusZ = 1e9

  constructor(seed: number, soil: SoilSet) {
    const rng = new Rng(seed)
    const nx = Math.floor(FIELD_W / CROP_DX)
    const nz = Math.floor(FIELD_L / CROP_DZ)
    this.count = nx * nz
    this.cx = new Float32Array(this.count)
    this.cz = new Float32Array(this.count)
    this.cy = new Float32Array(this.count)
    this.cyaw = new Float32Array(this.count)
    this.cscale = new Float32Array(this.count)
    this.cutAt = new Float32Array(this.count).fill(-1)
    this.cutHeading = new Float32Array(this.count)
    this.laneOf = new Int32Array(this.count)
    this.laneRemaining = new Int32Array(LANE_COUNT)
    this.nearSlot = new Int32Array(this.count).fill(-1)
    this.farSlot = new Int32Array(this.count).fill(-1)
    this.nearList = new Int32Array(Math.min(QUALITY.nearCap, this.count))
    this.farList = new Int32Array(this.count)
    this.standing = this.count

    const ox = -HALF_W + (FIELD_W - (nx - 1) * CROP_DX) / 2
    const oz = -HALF_L + (FIELD_L - (nz - 1) * CROP_DZ) / 2
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i
        // rows run straight along Z, as transplanted, with jitter inside the row
        const x = ox + i * CROP_DX + rng.gauss() * CROP_JITTER * 0.55
        const z = oz + j * CROP_DZ + rng.gauss() * CROP_JITTER
        this.cx[k] = x
        this.cz[k] = z
        this.cy[k] = paddyHeight(x, z)
        this.cyaw[k] = rng.range(0, Math.PI * 2)
        this.cscale[k] = rng.range(0.85, 1.18)
        const lane = clamp(Math.floor((x + HALF_W) / LANE_W), 0, LANE_COUNT - 1)
        this.laneOf[k] = lane
        this.laneRemaining[lane]++
      }
    }

    this.buildGrid()
    this.buildGround(soil)
    this.buildRice(rng)
    this.buildStubble()
    this.primeHeadlands()
  }

  /* ------------------------------ ground ------------------------------ */

  private buildGround(soil: SoilSet) {
    this.mask = document.createElement('canvas')
    this.mask.width = this.mask.height = MASK_RES
    this.maskCtx = this.mask.getContext('2d')!
    this.maskCtx.fillStyle = '#000000'
    this.maskCtx.fillRect(0, 0, MASK_RES, MASK_RES)
    this.maskTex = new THREE.CanvasTexture(this.mask)
    this.maskTex.colorSpace = THREE.NoColorSpace
    this.maskTex.wrapS = this.maskTex.wrapT = THREE.ClampToEdgeWrapping
    this.maskTex.minFilter = THREE.LinearFilter
    this.maskTex.magFilter = THREE.LinearFilter
    this.maskTex.generateMipmaps = false

    const geo = new THREE.PlaneGeometry(GROUND_W, GROUND_L, 44, 80)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, paddyHeight(pos.getX(i), pos.getZ(i)))
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()

    soil.dry.repeat.set(9, 11)
    soil.wet.repeat.set(9, 11)
    soil.rough.repeat.set(9, 11)

    const mat = new THREE.MeshStandardMaterial({
      map: soil.dry,
      roughnessMap: soil.rough,
      roughness: 1,
      metalness: 0,
    })
    const uMask = { value: this.maskTex as THREE.Texture }
    const uWet = { value: soil.wet as THREE.Texture }
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uMask = uMask
      shader.uniforms.uWet = uWet
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vPaddyUv;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vPaddyUv = uv;')
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec2 vPaddyUv;\nuniform sampler2D uMask;\nuniform sampler2D uWet;',
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          vec4 hm = texture2D( uMask, vPaddyUv );
          float cutM = clamp( hm.r * 1.4, 0.0, 1.0 );
          float trackM = clamp( hm.g * 1.7, 0.0, 1.0 );
          float churn = clamp( hm.b * 1.0, 0.0, 1.0 );
          vec3 wetCol = texture2D( uWet, vMapUv ).rgb;
          vec3 shaded = diffuseColor.rgb * vec3( 0.40, 0.36, 0.26 );
          vec3 opened = mix( diffuseColor.rgb * 1.02, wetCol, 0.32 + churn * 0.26 );
          diffuseColor.rgb = mix( shaded, opened, cutM );
          diffuseColor.rgb = mix( diffuseColor.rgb, wetCol * 0.58, trackM );`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          roughnessFactor *= mix( 1.0, 0.5, clamp( texture2D( uMask, vPaddyUv ).g * 1.7, 0.0, 1.0 ) );`,
        )
    }
    mat.customProgramCacheKey = () => 'paddy-ground'

    const mesh = new THREE.Mesh(geo, mat)
    mesh.receiveShadow = true
    mesh.name = 'paddyGround'
    this.group.add(mesh)
  }

  /* ------------------------------- rice ------------------------------- */

  private riceMaterial(): THREE.MeshLambertMaterial {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.FrontSide })
    const u = this.uniforms
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = u.uTime
      shader.uniforms.uWind = u.uWind
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute float aCutTime;
          attribute float aYaw;
          attribute float aCutYaw;
          uniform float uTime;
          uniform vec2 uWind;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          {
            if ( aCutTime < 0.0 ) {
              // coherent wind, rotated out of world space into this hill's frame
              float cy = cos( aYaw ), sy = sin( aYaw );
              vec2 wl = vec2( cy * uWind.x - sy * uWind.y, sy * uWind.x + cy * uWind.y );
              float ph = aYaw * 3.7;
              float w = sin( uTime * 1.05 + ph ) * 0.62 + sin( uTime * 2.37 + ph * 1.7 ) * 0.26;
              transformed.xz += w * 0.075 * pow( max( transformed.y, 0.0 ), 1.7 ) * wl;
            } else {
              // felled: tipped over towards the machine, dragged in, gone
              float k = clamp( ( uTime - aCutTime ) * 1.75, 0.0, 1.0 );
              float ang = k * 2.15;
              vec3 d = vec3( sin( aCutYaw ), 0.0, cos( aCutYaw ) );
              vec3 ax = vec3( d.z, 0.0, -d.x );
              float c = cos( ang ), s = sin( ang );
              transformed = transformed * c + cross( ax, transformed ) * s + ax * dot( ax, transformed ) * ( 1.0 - c );
              transformed *= 1.0 - smoothstep( 0.5, 1.0, k );
              transformed += d * ( k * 1.05 ) + vec3( 0.0, k * k * 0.5, 0.0 );
            }
          }`,
        )
    }
    mat.customProgramCacheKey = () => 'rice-sway'
    return mat
  }

  private attachAttrs(mesh: THREE.InstancedMesh, cap: number): InstAttrs {
    const cut = new THREE.InstancedBufferAttribute(new Float32Array(cap).fill(-1), 1)
    const yaw = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1)
    const cutYaw = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1)
    cut.setUsage(THREE.DynamicDrawUsage)
    yaw.setUsage(THREE.DynamicDrawUsage)
    cutYaw.setUsage(THREE.DynamicDrawUsage)
    mesh.geometry.setAttribute('aCutTime', cut)
    mesh.geometry.setAttribute('aYaw', yaw)
    mesh.geometry.setAttribute('aCutYaw', cutYaw)
    return { cut, yaw, cutYaw }
  }

  private buildRice(rng: Rng) {
    const mat = this.riceMaterial()
    const nearCap = this.nearList.length

    this.nearMesh = new THREE.InstancedMesh(riceClumpGeometry(true), mat, nearCap)
    this.farMesh = new THREE.InstancedMesh(riceClumpGeometry(false), mat, this.count)
    for (const m of [this.nearMesh, this.farMesh]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      m.frustumCulled = false
      m.castShadow = false
      m.receiveShadow = true
      m.setColorAt(0, this.tmpC.setRGB(1, 1, 1)) // allocate instanceColor
      m.count = 0
      this.group.add(m)
    }
    this.nearAttr = this.attachAttrs(this.nearMesh, nearCap)
    this.farAttr = this.attachAttrs(this.farMesh, this.count)

    // per-hill ripeness drift: some hills are still greener than others
    this.instanceTint = new Float32Array(this.count * 3)
    const green = new THREE.Color(0.74, 0.96, 0.56)
    for (let k = 0; k < this.count; k++) {
      const ripe = clamp(0.62 + rng.gauss() * 0.55, 0, 1)
      this.tmpC.setRGB(1, 1, 1).lerp(green, 1 - ripe)
      const l = 0.9 + rng.range(0, 0.2)
      this.instanceTint[k * 3] = this.tmpC.r * l
      this.instanceTint[k * 3 + 1] = this.tmpC.g * l
      this.instanceTint[k * 3 + 2] = this.tmpC.b * l
    }
  }

  private buildStubble() {
    // Stubble is simply the base of every plant, so it covers the whole
    // paddy floor — headlands included, where the crop came off first.
    const rng = new Rng(5150)
    const nx = Math.floor(FIELD_W / CROP_DX)
    const nz = Math.floor(FIELD_L / CROP_DZ)
    const jm = Math.ceil(HEADLAND / CROP_DZ)
    const ox = -HALF_W + (FIELD_W - (nx - 1) * CROP_DX) / 2
    const oz = -HALF_L + (FIELD_L - (nz - 1) * CROP_DZ) / 2
    const total = nx * (nz + jm * 2)
    const m = new THREE.InstancedMesh(
      stubbleGeometry(),
      new THREE.MeshLambertMaterial({ vertexColors: true }),
      total,
    )
    m.receiveShadow = true
    m.castShadow = false
    m.frustumCulled = false
    let k = 0
    for (let j = -jm; j < nz + jm; j++) {
      for (let i = 0; i < nx; i++) {
        const inCrop = j >= 0 && j < nz
        const idx = inCrop ? j * nx + i : -1
        const x = inCrop ? this.cx[idx] : ox + i * CROP_DX + rng.gauss() * CROP_JITTER * 0.55
        const z = inCrop ? this.cz[idx] : oz + j * CROP_DZ + rng.gauss() * CROP_JITTER
        this.tmpP.set(x, paddyHeight(x, z), z)
        this.tmpQ.setFromAxisAngle(Y_AXIS, inCrop ? this.cyaw[idx] : rng.range(0, Math.PI * 2))
        this.tmpS.setScalar(inCrop ? this.cscale[idx] : rng.range(0.85, 1.18))
        this.tmpMat.compose(this.tmpP, this.tmpQ, this.tmpS)
        m.setMatrixAt(k++, this.tmpMat)
      }
    }
    m.count = k
    m.instanceMatrix.needsUpdate = true
    this.group.add(m)
  }

  /** The headlands were cut before the game starts, so stamp them opened. */
  private primeHeadlands() {
    const ctx = this.maskCtx
    const row = (z: number) => ((z + GROUND_L / 2) / GROUND_L) * MASK_RES
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = 'rgba(255,0,20,1)'
    ctx.fillRect(0, 0, MASK_RES, row(-HALF_L - 0.15))
    ctx.fillRect(0, row(HALF_L + 0.15), MASK_RES, MASK_RES - row(HALF_L + 0.15))
    ctx.globalCompositeOperation = 'source-over'
    this.maskTex.needsUpdate = true
  }

  /* ------------------------------- grid ------------------------------- */

  private buildGrid() {
    const cell = 0.7
    const cols = Math.ceil(FIELD_W / cell) + 2
    const rows = Math.ceil(FIELD_L / cell) + 2
    const counts = new Int32Array(cols * rows)
    const cellOf = new Int32Array(this.count)
    for (let k = 0; k < this.count; k++) {
      const ci = clamp(Math.floor((this.cx[k] + HALF_W) / cell) + 1, 0, cols - 1)
      const cj = clamp(Math.floor((this.cz[k] + HALF_L) / cell) + 1, 0, rows - 1)
      const c = cj * cols + ci
      cellOf[k] = c
      counts[c]++
    }
    const start = new Int32Array(cols * rows + 1)
    for (let i = 0; i < cols * rows; i++) start[i + 1] = start[i] + counts[i]
    const cursor = start.slice(0, cols * rows)
    const items = new Int32Array(this.count)
    for (let k = 0; k < this.count; k++) items[cursor[cellOf[k]]++] = k
    this.grid = { cols, rows, cell, start, items }
  }

  /* ------------------------------ cutting ----------------------------- */

  /** Sweeps the header rectangle and fells everything inside it. */
  cut(
    cxw: number,
    czw: number,
    heading: number,
    halfWidth: number,
    halfDepth: number,
    now: number,
    out: CutHit[],
  ): number {
    const s = Math.sin(heading)
    const c = Math.cos(heading)
    const reach = Math.hypot(halfWidth, halfDepth) + 0.2
    const g = this.grid
    const i0 = clamp(Math.floor((cxw - reach + HALF_W) / g.cell) + 1, 0, g.cols - 1)
    const i1 = clamp(Math.floor((cxw + reach + HALF_W) / g.cell) + 1, 0, g.cols - 1)
    const j0 = clamp(Math.floor((czw - reach + HALF_L) / g.cell) + 1, 0, g.rows - 1)
    const j1 = clamp(Math.floor((czw + reach + HALF_L) / g.cell) + 1, 0, g.rows - 1)
    let n = 0
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const cell = j * g.cols + i
        for (let p = g.start[cell]; p < g.start[cell + 1]; p++) {
          const k = g.items[p]
          if (this.cutAt[k] >= 0) continue
          const dx = this.cx[k] - cxw
          const dz = this.cz[k] - czw
          // machine space: forward = (s, c), right = (c, -s)
          const along = dx * s + dz * c
          if (along < -halfDepth || along > halfDepth) continue
          const across = dx * c - dz * s
          if (across < -halfWidth || across > halfWidth) continue
          this.fell(k, heading, now)
          out.push({ index: k, x: this.cx[k], z: this.cz[k] })
          n++
        }
      }
    }
    return n
  }

  private fell(k: number, heading: number, now: number) {
    this.cutAt[k] = now
    this.cutHeading[k] = heading
    this.standing--
    this.laneRemaining[this.laneOf[k]]--
    const local = heading - this.cyaw[k]
    const ns = this.nearSlot[k]
    if (ns >= 0) {
      this.nearAttr.cut.array[ns] = now
      this.nearAttr.cutYaw.array[ns] = local
      this.nearAttr.cut.needsUpdate = true
      this.nearAttr.cutYaw.needsUpdate = true
    }
    const fs = this.farSlot[k]
    if (fs >= 0) {
      this.farAttr.cut.array[fs] = now
      this.farAttr.cutYaw.array[fs] = local
      this.farAttr.cut.needsUpdate = true
      this.farAttr.cutYaw.needsUpdate = true
    }
  }

  /* --------------------------- level of detail ------------------------ */

  refreshLod(fx: number, fz: number, now: number, force = false) {
    const dx0 = fx - this.focusX
    const dz0 = fz - this.focusZ
    if (!force && dx0 * dx0 + dz0 * dz0 < 0.36) return
    this.focusX = fx
    this.focusZ = fz

    // adapt the detail radius so the detailed mesh stays near its cap
    let within = 0
    const r2 = this.nearRadius * this.nearRadius
    for (let k = 0; k < this.count; k++) {
      if (this.cutAt[k] >= 0) continue
      const dx = this.cx[k] - fx
      const dz = this.cz[k] - fz
      if (dx * dx + dz * dz < r2) within++
    }
    const cap = this.nearList.length
    if (within > cap * 1.02) this.nearRadius *= Math.max(0.7, Math.sqrt((cap * 0.94) / within))
    else if (within < cap * 0.72) this.nearRadius = Math.min(13, this.nearRadius * 1.09)

    const rr = this.nearRadius * this.nearRadius
    let nn = 0
    let nf = 0
    this.nearSlot.fill(-1)
    this.farSlot.fill(-1)
    for (let k = 0; k < this.count; k++) {
      const cutTime = this.cutAt[k]
      if (cutTime >= 0 && now - cutTime > 0.8) continue
      const dx = this.cx[k] - fx
      const dz = this.cz[k] - fz
      if ((dx * dx + dz * dz < rr || cutTime >= 0) && nn < cap) {
        this.nearList[nn] = k
        this.nearSlot[k] = nn
        nn++
      } else {
        this.farList[nf] = k
        this.farSlot[k] = nf
        nf++
      }
    }
    this.writeInstances(this.nearMesh, this.nearAttr, this.nearList, nn)
    this.writeInstances(this.farMesh, this.farAttr, this.farList, nf)
  }

  private writeInstances(mesh: THREE.InstancedMesh, attr: InstAttrs, list: Int32Array, n: number) {
    for (let s = 0; s < n; s++) {
      const k = list[s]
      this.tmpP.set(this.cx[k], this.cy[k], this.cz[k])
      this.tmpQ.setFromAxisAngle(Y_AXIS, this.cyaw[k])
      this.tmpS.setScalar(this.cscale[k])
      this.tmpMat.compose(this.tmpP, this.tmpQ, this.tmpS)
      mesh.setMatrixAt(s, this.tmpMat)
      mesh.setColorAt(
        s,
        this.tmpC.setRGB(
          this.instanceTint[k * 3],
          this.instanceTint[k * 3 + 1],
          this.instanceTint[k * 3 + 2],
        ),
      )
      attr.cut.array[s] = this.cutAt[k]
      attr.yaw.array[s] = this.cyaw[k]
      attr.cutYaw.array[s] = this.cutAt[k] >= 0 ? this.cutHeading[k] - this.cyaw[k] : 0
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    attr.cut.needsUpdate = true
    attr.yaw.needsUpdate = true
    attr.cutYaw.needsUpdate = true
  }

  /* ------------------------------- mask ------------------------------- */

  private stamp(x: number, z: number, heading: number, draw: (c: CanvasRenderingContext2D) => void) {
    const ctx = this.maskCtx
    ctx.save()
    ctx.translate(((x + GROUND_W / 2) / GROUND_W) * MASK_RES, ((z + GROUND_L / 2) / GROUND_L) * MASK_RES)
    ctx.scale(MASK_RES / GROUND_W, MASK_RES / GROUND_L)
    // canvas +x is world +X and canvas +y is world +Z, so a world yaw
    // becomes a negative canvas rotation
    ctx.rotate(-heading)
    ctx.globalCompositeOperation = 'lighter'
    draw(ctx)
    ctx.restore()
    this.maskDirty = true
  }

  /** Opens up the swath the header just took. */
  paintCut(x: number, z: number, heading: number, halfWidth: number, len: number) {
    this.stamp(x, z, heading, (ctx) => {
      ctx.fillStyle = 'rgba(255,0,0,1)'
      ctx.fillRect(-halfWidth, -len * 0.5, halfWidth * 2, len)
      ctx.fillStyle = 'rgba(0,0,12,1)'
      ctx.fillRect(-halfWidth * 0.9, -len * 0.5, halfWidth * 1.8, len)
    })
  }

  /** Presses the two crawler ruts into the mud. */
  paintTracks(x: number, z: number, heading: number, trackHalf: number, len: number) {
    this.stamp(x, z, heading, (ctx) => {
      ctx.fillStyle = 'rgba(0,120,0,1)'
      for (const s of [-1, 1]) ctx.fillRect(s * trackHalf - 0.2, -len * 0.5, 0.4, len)
      ctx.fillStyle = 'rgba(0,0,16,1)'
      ctx.fillRect(-trackHalf - 0.28, -len * 0.5, (trackHalf + 0.28) * 2, len)
    })
  }

  update(dt: number, now: number) {
    this.uniforms.uTime.value = now
    this.maskFlush -= dt
    if (this.maskDirty && this.maskFlush <= 0) {
      this.maskTex.needsUpdate = true
      this.maskDirty = false
      this.maskFlush = 1 / 18
    }
  }

  /** Lane with rice left, closest to `fromX`; -1 when the paddy is done. */
  nextLane(fromX: number, exclude = -1): number {
    let best = -1
    let bestD = Infinity
    for (let i = 0; i < LANE_COUNT; i++) {
      if (i === exclude) continue
      if (this.laneRemaining[i] <= this.laneThreshold) continue
      const d = Math.abs(laneX(i) - fromX)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return best
  }

  get progress() {
    return 1 - this.standing / this.count
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else if (mat) mat.dispose()
    })
    this.maskTex.dispose()
    this.group.clear()
  }
}
