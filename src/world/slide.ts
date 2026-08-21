import * as THREE from 'three'
import { buildMaterials } from '../core/materials'
import { MeshMerger } from './merge'
import type { ContactShadows } from './decals'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import {
  PLATFORM,
  ROLLERS,
  SHAFT,
  SLIDE,
  STAIR,
  bedPitch,
  bedPoint,
  distanceAtU,
  slideLength,
  uAtDistance,
} from './layout'
import { clamp01, damp } from '../core/math'

const _p = new THREE.Vector3()
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3(1, 1, 1)
const _axisX = new THREE.Vector3(1, 0, 0)

/* ------------------------------------------------------------------ *
 * Static structure
 * ------------------------------------------------------------------ */

/** Lays a straight part along the bed between two arc-length stations. */
function bedSegment(
  merger: MeshMerger,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  d0: number,
  d1: number,
  xOffset: number,
  yOffset: number,
  opts: { cast?: boolean; receive?: boolean } = {},
): void {
  const a = bedPoint(uAtDistance(d0), new THREE.Vector3())
  const b = bedPoint(uAtDistance(d1), new THREE.Vector3())
  const mid = a.clone().lerp(b, 0.5)
  const pitch = Math.atan2(a.y - b.y, b.z - a.z)
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, 0, 0))
  const local = new THREE.Vector3(xOffset, yOffset, 0).applyQuaternion(q)
  const m = new THREE.Matrix4().compose(mid.add(local), q, new THREE.Vector3(1, 1, 1))
  merger.add(geo, mat, m, opts)
}

export function buildSlideStructure(root: THREE.Group, contacts: ContactShadows): void {
  const m = buildMaterials()
  const merger = new MeshMerger()
  const halfW = SLIDE.width / 2

  // --- side beams and guard rails -------------------------------------
  const SEGMENTS = 26
  const step = slideLength / SEGMENTS
  const beamGeo = new THREE.BoxGeometry(0.075, 0.17, step * 1.04)
  const railGeo = new THREE.CylinderGeometry(0.023, 0.023, step * 1.04, 8)
  railGeo.rotateX(Math.PI / 2)
  const crossGeo = new THREE.BoxGeometry(SLIDE.width + 0.2, 0.055, 0.055)
  const panGeo = new THREE.BoxGeometry(SLIDE.width, 0.03, step * 1.04)

  for (let i = 0; i < SEGMENTS; i++) {
    const d0 = i * step
    const d1 = (i + 1) * step
    for (const s of [-1, 1]) {
      bedSegment(merger, beamGeo, m.paintedSteel, d0, d1, s * (halfW + 0.045), -0.078, {
        cast: true,
        receive: true,
      })
      bedSegment(merger, railGeo, m.galvanised, d0, d1, s * (halfW + 0.045), 0.205, {
        cast: true,
      })
    }
    if (i % 2 === 0) {
      bedSegment(merger, crossGeo, m.galvanised, d0, d0 + 0.01, 0, -0.185)
    }
    // Base pan under the rollers: the dark gaps between them are what makes
    // the row read as separate rollers rather than one continuous surface.
    bedSegment(merger, panGeo, m.darkSteel, d0, d1, 0, -0.075, { receive: true })
  }

  // Guard-rail stanchions.
  const stanchion = new THREE.CylinderGeometry(0.017, 0.017, 0.24, 8)
  for (let d = 0.55; d < slideLength - 0.2; d += 1.45) {
    for (const s of [-1, 1]) {
      bedSegment(merger, stanchion, m.galvanised, d, d + 0.01, s * (halfW + 0.045), 0.075, {
        cast: true,
      })
    }
  }

  // --- legs, braces and footings ---------------------------------------
  const legGeo = new THREE.CylinderGeometry(0.045, 0.05, 1, 10)
  const footGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.14, 10)
  for (let d = 0.9; d < slideLength - 0.5; d += 1.85) {
    const u = uAtDistance(d)
    bedPoint(u, _p)
    const top = _p.y - 0.21
    for (const s of [-1, 1]) {
      const footX = s * (halfW + 0.34)
      const legTopX = s * (halfW + 0.06)
      const dx = footX - legTopX
      const h = top
      if (h < 0.25) continue
      const len = Math.hypot(dx, h)
      const tilt = Math.atan2(dx, h)
      const mtx = new THREE.Matrix4().compose(
        new THREE.Vector3((legTopX + footX) / 2, h / 2, _p.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -tilt)),
        new THREE.Vector3(1, len, 1),
      )
      merger.add(legGeo, m.galvanised, mtx, { cast: true })
      merger.addAt(footGeo, m.concrete, footX, 0.04, _p.z, 0, 0, 0, { receive: true })
      contacts.add(footX, 0, _p.z, 0.3, 0.5)
    }
    // Cross brace between the leg pair.
    if (top > 0.9) {
      const brace = new THREE.BoxGeometry(SLIDE.width + 0.68, 0.05, 0.05)
      merger.addAt(brace, m.galvanised, 0, top * 0.45, _p.z, 0, 0, 0, { cast: true })
    }
  }

  // --- concrete apron and rubber landing mat ---------------------------
  bedPoint(1, _p)
  const apron = new THREE.BoxGeometry(2.6, 0.09, 2.4)
  merger.addAt(apron, m.concrete, 0, 0.03, _p.z + 0.85, 0, 0, 0, { receive: true })
  const mat = new THREE.BoxGeometry(1.5, 0.035, 1.2)
  merger.addAt(mat, m.rubber, 0, 0.09, _p.z + 0.5, 0, 0, 0, { receive: true })

  // --- top platform ----------------------------------------------------
  const deckY = STAIR.top
  const deck = new THREE.BoxGeometry(PLATFORM.width, 0.07, PLATFORM.depth)
  merger.addAt(deck, m.paintedSteel, 0, deckY - 0.035, PLATFORM.z, 0, 0, 0, {
    cast: true,
    receive: true,
  })
  const deckLip = new THREE.BoxGeometry(SLIDE.width + 0.2, 0.09, 0.18)
  merger.addAt(deckLip, m.paintedSteel, 0, deckY + 0.02, SLIDE.topZ - 0.09, -0.3, 0, 0, {
    cast: true,
  })

  for (const s of [-1, 1]) {
    // Platform guard panels, open at the slide mouth and the stair head.
    const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.95, 8)
    const zA = PLATFORM.z - PLATFORM.depth / 2 + 0.08
    const zB = PLATFORM.z + PLATFORM.depth / 2 - 0.08
    merger.addAt(postGeo, m.galvanised, s * 0.58, deckY + 0.475, zA, 0, 0, 0, { cast: true })
    merger.addAt(postGeo, m.galvanised, s * 0.58, deckY + 0.475, zB, 0, 0, 0, { cast: true })
    const railBar = new THREE.CylinderGeometry(0.024, 0.024, zB - zA, 8)
    railBar.rotateX(Math.PI / 2)
    merger.addAt(railBar, m.galvanised, s * 0.58, deckY + 0.93, PLATFORM.z, 0, 0, 0, { cast: true })
    merger.addAt(railBar, m.galvanised, s * 0.58, deckY + 0.52, PLATFORM.z, 0, 0, 0)
    const mesh = new THREE.BoxGeometry(0.02, 0.42, zB - zA)
    merger.addAt(mesh, m.darkSteel, s * 0.58, deckY + 0.3, PLATFORM.z, 0, 0, 0)

    // Legs under the platform.
    const legs = new THREE.CylinderGeometry(0.05, 0.055, deckY, 10)
    merger.addAt(legs, m.galvanised, s * 0.5, deckY / 2, PLATFORM.z - 0.42, 0, 0, 0, { cast: true })
    merger.addAt(footGeo, m.concrete, s * 0.5, 0.04, PLATFORM.z - 0.42, 0, 0, 0, {
      receive: true,
    })
    contacts.add(s * 0.5, 0, PLATFORM.z - 0.42, 0.3, 0.55)
  }

  // --- stair flight -----------------------------------------------------
  const rise = STAIR.top / STAIR.steps
  const run = (STAIR.z1 - STAIR.z0) / STAIR.steps
  const treadGeo = new THREE.BoxGeometry(STAIR.width, 0.045, Math.abs(run) * 1.02)
  const riserGeo = new THREE.BoxGeometry(STAIR.width, rise, 0.02)
  for (let i = 0; i < STAIR.steps; i++) {
    const y = rise * (i + 1)
    const z = STAIR.z0 + run * (i + 0.5)
    merger.addAt(treadGeo, m.paintedSteel, 0, y - 0.02, z, 0, 0, 0, {
      cast: true,
      receive: true,
    })
    merger.addAt(riserGeo, m.darkSteel, 0, y - rise / 2, z - Math.abs(run) / 2, 0, 0, 0)
  }
  const stringLen = Math.hypot(STAIR.top, STAIR.z1 - STAIR.z0)
  const stringAngle = Math.atan2(STAIR.top, STAIR.z1 - STAIR.z0)
  const stringGeo = new THREE.BoxGeometry(0.06, 0.2, stringLen)
  for (const s of [-1, 1]) {
    merger.addAt(
      stringGeo,
      m.paintedSteel,
      s * (STAIR.width / 2 + 0.035),
      STAIR.top / 2 - 0.09,
      (STAIR.z0 + STAIR.z1) / 2,
      -stringAngle,
      0,
      0,
      { cast: true },
    )
    // Handrail with newel posts.
    const handGeo = new THREE.CylinderGeometry(0.026, 0.026, stringLen * 0.99, 8)
    merger.addAt(
      handGeo,
      m.galvanised,
      s * (STAIR.width / 2 + 0.09),
      STAIR.top / 2 + 0.76,
      (STAIR.z0 + STAIR.z1) / 2,
      Math.PI / 2 - stringAngle,
      0,
      0,
      { cast: true },
    )
    for (let i = 0; i <= 3; i++) {
      const t = i / 3
      const y = STAIR.top * t
      const z = STAIR.z0 + (STAIR.z1 - STAIR.z0) * t
      const post = new THREE.CylinderGeometry(0.022, 0.022, 0.78, 8)
      merger.addAt(post, m.galvanised, s * (STAIR.width / 2 + 0.09), y + 0.39, z, 0, 0, 0, {
        cast: true,
      })
    }
    const stairFoot = new THREE.CylinderGeometry(0.1, 0.12, 0.12, 8)
    merger.addAt(stairFoot, m.concrete, s * (STAIR.width / 2 + 0.06), 0.03, STAIR.z0 - 0.05, 0, 0, 0, {
      receive: true,
    })
  }
  contacts.add(0, 0, (STAIR.z0 + STAIR.z1) / 2, 1.1, 0.45, 1.3)
  contacts.add(0, 0, _p.z + 0.6, 1.5, 0.4)

  merger.build(root, 'slide-structure')
}

/* ------------------------------------------------------------------ *
 * Rollers
 * ------------------------------------------------------------------ */

export interface RollerBankOptions {
  segments: number
}

/**
 * The roller field. Each roller carries its own angle and angular velocity, so
 * the rumble genuinely travels down the bed under the child rather than being
 * animated as one block.
 */
export class RollerBank {
  readonly mesh: THREE.InstancedMesh
  readonly driveMesh: THREE.InstancedMesh
  readonly angle: Float32Array
  readonly omega: Float32Array
  readonly count: number

  /** Indices of rollers whose extended axles turn the line shaft. */
  readonly driveIndices: number[] = []

  private readonly driveMap = new Map<number, number>()

  constructor(opts: RollerBankOptions) {
    const m = buildMaterials()
    this.count = ROLLERS.length
    this.angle = new Float32Array(this.count)
    this.omega = new Float32Array(this.count)

    const geo = new THREE.CylinderGeometry(
      SLIDE.rollerRadius,
      SLIDE.rollerRadius,
      SLIDE.rollerLength,
      opts.segments,
      1,
      false,
    )
    geo.rotateZ(Math.PI / 2)
    this.mesh = new THREE.InstancedMesh(geo, m.resin, this.count)
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false

    for (let i = 0; i < this.count; i++) {
      if (ROLLERS[i].drive) {
        this.driveMap.set(i, this.driveIndices.length)
        this.driveIndices.push(i)
      }
    }

    // Extended axle and end disc on the drive rollers: the visible mechanical
    // link between the bed and the line shaft.
    const disc = new THREE.CylinderGeometry(SHAFT.discRadius, SHAFT.discRadius, 0.018, 14)
    disc.rotateZ(Math.PI / 2)
    disc.translate(SHAFT.discX, 0, 0)
    const stub = new THREE.CylinderGeometry(0.014, 0.014, 0.16, 8)
    stub.rotateZ(Math.PI / 2)
    stub.translate(SHAFT.discX + 0.08, 0, 0)
    const discGeo = mergeGeometries([disc, stub], false) ?? disc
    disc.dispose()
    stub.dispose()
    this.driveMesh = new THREE.InstancedMesh(
      discGeo,
      m.darkSteel,
      Math.max(1, this.driveIndices.length),
    )
    this.driveMesh.castShadow = true
    this.driveMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.driveMesh.frustumCulled = false

    this.writeMatrices()
  }

  private writeMatrices(): void {
    for (let i = 0; i < this.count; i++) {
      const r = ROLLERS[i]
      _q.setFromAxisAngle(_axisX, this.angle[i])
      _p.set(0, r.y, r.z)
      _m.compose(_p, _q, _s)
      this.mesh.setMatrixAt(i, _m)

      const di = this.driveMap.get(i)
      if (di !== undefined) {
        _p.set(0, r.y, r.z)
        _m.compose(_p, _q, _s)
        this.driveMesh.setMatrixAt(di, _m)
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true
    this.driveMesh.instanceMatrix.needsUpdate = true
  }

  /**
   * Spins up the rollers under a rider travelling at `speed` m/s whose contact
   * patch is centred at arc-length `distance`.
   */
  driveFromRider(distance: number, speed: number, dt: number): void {
    const targetOmega = speed / SLIDE.rollerRadius
    // Contact patch of a seated child, plus the roller the weight is rolling on.
    const halfPatch = 0.34
    for (let i = 0; i < this.count; i++) {
      const d = distanceAtU(ROLLERS[i].u)
      const gap = Math.abs(d - distance)
      if (gap > halfPatch) continue
      const grip = 1 - gap / halfPatch
      this.omega[i] = damp(this.omega[i], targetOmega, Math.pow(2e-7, grip), dt)
    }
  }

  /** Hand-turning a single roller and its immediate neighbours. */
  driveByHand(index: number, targetOmega: number, dt: number): void {
    for (let k = -1; k <= 1; k++) {
      const i = index + k
      if (i < 0 || i >= this.count) continue
      const w = k === 0 ? 1 : 0.35
      this.omega[i] = damp(this.omega[i], targetOmega * w, 0.0015, dt)
    }
  }

  /** Nearest roller to a world point, for hit-testing a finger on the bed. */
  nearestTo(point: THREE.Vector3): number {
    let best = -1
    let bestD = Infinity
    for (let i = 0; i < this.count; i++) {
      const d = Math.abs(ROLLERS[i].z - point.z) + Math.abs(ROLLERS[i].y - point.y) * 0.5
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return best
  }

  update(dt: number): void {
    // Bearing drag: rollers coast for a good while after the child has passed,
    // which is what keeps the generator turning long enough to see.
    const decay = Math.pow(0.42, dt)
    for (let i = 0; i < this.count; i++) {
      this.omega[i] *= decay
      if (Math.abs(this.omega[i]) < 0.02) this.omega[i] = 0
      this.angle[i] += this.omega[i] * dt
      if (this.angle[i] > Math.PI * 2) this.angle[i] -= Math.PI * 2
      else if (this.angle[i] < -Math.PI * 2) this.angle[i] += Math.PI * 2
    }
    this.writeMatrices()
  }

  /**
   * Speed the line shaft actually turns at. The friction wheels can only push
   * the shaft, never hold it back, so the fastest roller in the drive band sets
   * the pace and the slower ones simply slip.
   */
  driveOmega(): number {
    let peak = 0
    for (const i of this.driveIndices) peak = Math.max(peak, Math.abs(this.omega[i]))
    return peak
  }

  /** Loudest roller speed anywhere on the bed, normalised for the audio bed. */
  peakNormalised(): number {
    let peak = 0
    for (let i = 0; i < this.count; i++) peak = Math.max(peak, Math.abs(this.omega[i]))
    return clamp01(peak / 60)
  }

  stopAll(): void {
    this.omega.fill(0)
  }
}

/** Pitch of the bed at a given arc-length station, for seating the child. */
export function pitchAtDistance(d: number): number {
  return bedPitch(uAtDistance(d))
}
