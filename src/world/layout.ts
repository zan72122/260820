import * as THREE from 'three'
import { clamp01, lerp, smoothstep } from '../core/math'

/* ------------------------------------------------------------------ *
 * Slide geometry
 * ------------------------------------------------------------------ */

export const SLIDE = {
  topZ: -11.4,
  topY: 4.25,
  exitZ: 2.0,
  exitY: 0.42,
  /** Clear width between the side rails. */
  width: 0.66,
  rollerRadius: 0.079,
  rollerLength: 0.6,
  rollerSpacing: 0.176,
  /** Rollers inside this z range drive the line shaft. */
  driveZFrom: -0.95,
  driveZTo: 0.92,
} as const

const SAMPLES = 257

/** Normalised descent rate along the bed: steady pitch, then a flat run-out. */
function slopeProfile(u: number): number {
  return lerp(1, 0.045, smoothstep(0.52, 0.95, u))
}

function buildCurve(): {
  y: Float32Array
  z: Float32Array
  arc: Float32Array
  total: number
} {
  const y = new Float32Array(SAMPLES)
  const z = new Float32Array(SAMPLES)
  const raw = new Float32Array(SAMPLES)
  let acc = 0
  for (let i = 0; i < SAMPLES; i++) {
    const u = i / (SAMPLES - 1)
    raw[i] = acc
    acc += slopeProfile(u) / (SAMPLES - 1)
  }
  const norm = acc > 0 ? acc : 1
  const drop = SLIDE.topY - SLIDE.exitY
  for (let i = 0; i < SAMPLES; i++) {
    const u = i / (SAMPLES - 1)
    z[i] = lerp(SLIDE.topZ, SLIDE.exitZ, u)
    y[i] = SLIDE.topY - drop * (raw[i] / norm)
  }
  const arc = new Float32Array(SAMPLES)
  for (let i = 1; i < SAMPLES; i++) {
    arc[i] = arc[i - 1] + Math.hypot(z[i] - z[i - 1], y[i] - y[i - 1])
  }
  return { y, z, arc, total: arc[SAMPLES - 1] }
}

const CURVE = buildCurve()

export const slideLength = CURVE.total

/** Bed surface point for a normalised parameter u in 0..1. */
export function bedPoint(u: number, out = new THREE.Vector3()): THREE.Vector3 {
  const t = clamp01(u) * (SAMPLES - 1)
  const i = Math.min(SAMPLES - 2, Math.floor(t))
  const f = t - i
  return out.set(0, lerp(CURVE.y[i], CURVE.y[i + 1], f), lerp(CURVE.z[i], CURVE.z[i + 1], f))
}

/** Bed tangent, pointing down-slope. */
export function bedTangent(u: number, out = new THREE.Vector3()): THREE.Vector3 {
  const e = 0.004
  const a = bedPoint(clamp01(u) - e, _tA)
  const b = bedPoint(clamp01(u) + e, _tB)
  return out.copy(b).sub(a).normalize()
}

/** Bed pitch as a rotation about the X axis, for laying parts flat on the slide. */
export function bedPitch(u: number): number {
  const t = bedTangent(u, _tC)
  return Math.atan2(-t.y, t.z)
}

const _tA = new THREE.Vector3()
const _tB = new THREE.Vector3()
const _tC = new THREE.Vector3()

/** Convert an arc-length distance from the top into the normalised parameter. */
export function uAtDistance(d: number): number {
  const target = clamp01(d / CURVE.total) * CURVE.total
  let lo = 0
  let hi = SAMPLES - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (CURVE.arc[mid] < target) lo = mid
    else hi = mid
  }
  const span = CURVE.arc[hi] - CURVE.arc[lo]
  const f = span > 0 ? (target - CURVE.arc[lo]) / span : 0
  return (lo + f) / (SAMPLES - 1)
}

export function distanceAtU(u: number): number {
  const t = clamp01(u) * (SAMPLES - 1)
  const i = Math.min(SAMPLES - 2, Math.floor(t))
  const f = t - i
  return lerp(CURVE.arc[i], CURVE.arc[i + 1], f)
}

export interface RollerDef {
  u: number
  y: number
  z: number
  /** True when this roller's extended axle drives the line shaft. */
  drive: boolean
}

export const ROLLERS: RollerDef[] = (() => {
  const out: RollerDef[] = []
  const count = Math.floor(CURVE.total / SLIDE.rollerSpacing)
  const p = new THREE.Vector3()
  for (let i = 0; i <= count; i++) {
    const u = uAtDistance(i * SLIDE.rollerSpacing + SLIDE.rollerSpacing * 0.5)
    bedPoint(u, p)
    out.push({
      u,
      y: p.y,
      z: p.z,
      drive: p.z >= SLIDE.driveZFrom && p.z <= SLIDE.driveZTo,
    })
  }
  return out
})()

export const DRIVE_INDICES: number[] = ROLLERS.map((r, i) => (r.drive ? i : -1)).filter(
  (i) => i >= 0,
)

/* ------------------------------------------------------------------ *
 * Machinery anchors
 * ------------------------------------------------------------------ */

/**
 * Line shaft: the drive rollers carry their axles through the left beam and end
 * in friction discs, whose faces turn the rubber wheels on this shaft.
 */
export const SHAFT = {
  x: -0.525,
  radius: 0.018,
  /** Radius of the rubber wheels riding on the roller end discs. */
  wheelRadius: 0.075,
  /** Radius of the steel disc on the extended roller axle. */
  discRadius: 0.075,
  discX: -0.44,
  zFrom: -1.2,
  zTo: 2.86,
  /** Shaft centreline height at each end. */
  yFrom: 0.565,
  yTo: 0.3,
  /** Turns of the shaft per turn of a roller. */
  ratio: 0.42,
} as const

export const GENERATOR = {
  /** Weatherproof housing on a plinth just past the run-out, on the shaft line. */
  pos: new THREE.Vector3(SHAFT.x, 0.3, 3.08),
  size: new THREE.Vector3(0.34, 0.3, 0.42),
} as const

/** Small storage box on the cable run between the generator and the conduit. */
export const STORAGE_BOX = {
  pos: new THREE.Vector3(-1.06, 0.52, 2.72),
  yaw: 0.5,
  segments: 5,
} as const

export const DIST_BOX = {
  pos: new THREE.Vector3(-2.55, 0, 1.72),
  yaw: 0.3,
  bodyHeight: 0.62,
  bodyWidth: 0.72,
  bodyDepth: 0.3,
  /** Height of the lever pivot row above the ground. */
  leverY: 0.86,
} as const

/* ------------------------------------------------------------------ *
 * Circuits and fixtures
 * ------------------------------------------------------------------ */

export type CircuitId = 'path' | 'pavilion' | 'tree'
export const CIRCUIT_IDS: CircuitId[] = ['path', 'pavilion', 'tree']

export type FixtureKind = 'bollard' | 'bench' | 'lantern' | 'uplight' | 'safety'

export interface FixtureDef {
  id: string
  circuit: CircuitId | 'safety'
  kind: FixtureKind
  /** Position of the fixture base on the ground (or of the hanging point). */
  pos: THREE.Vector3
  yaw: number
  /** Order in which the circuit brings its fixtures up. */
  order: number
  colour: number
  /** Peak real-light intensity in watts-ish units, before the master lamp gain. */
  power: number
  /** Radius of the faked ground pool. */
  poolRadius: number
  /** Offset of the pool centre from the fixture, in the direction of throw. */
  poolOffset: THREE.Vector2
}

const WARM_PATH = 0xffb066
const WARM_LANTERN = 0xffa54e
const WARM_TREE = 0xffc48a
const SAFETY_WHITE = 0xd9dcc9

function f(
  id: string,
  circuit: CircuitId | 'safety',
  kind: FixtureKind,
  x: number,
  y: number,
  z: number,
  yaw: number,
  order: number,
  colour: number,
  power: number,
  poolRadius: number,
  ox = 0,
  oz = 0,
): FixtureDef {
  return {
    id,
    circuit,
    kind,
    pos: new THREE.Vector3(x, y, z),
    yaw,
    order,
    colour,
    power,
    poolRadius,
    poolOffset: new THREE.Vector2(ox, oz),
  }
}

/**
 * The path run climbs away from the slide exit, so in portrait the lit bollards
 * stack up the screen and in landscape the three zones spread left to right.
 */
export const FIXTURES: FixtureDef[] = [
  // --- path circuit -------------------------------------------------
  f('path-0', 'path', 'bollard', 1.05, 0, 4.3, -0.16, 0, WARM_PATH, 2.1, 1.9),
  f('path-1', 'path', 'bollard', 1.42, 0, 7.05, -0.12, 1, WARM_PATH, 2.1, 1.9),
  f('path-2', 'path', 'bollard', 1.94, 0, 9.8, -0.1, 2, WARM_PATH, 2.1, 1.9),
  f('path-3', 'path', 'bench', 1.62, 0, 2.42, -1.45, 3, WARM_PATH, 1.15, 1.3, -0.4, 0),
  f('path-4', 'path', 'bollard', 2.62, 0, 12.5, -0.08, 4, WARM_PATH, 2.1, 1.9),
  f('path-5', 'path', 'bench', 3.15, 0, 8.2, -1.5, 5, WARM_PATH, 1.15, 1.25, -0.35, 0),

  // --- pavilion circuit ---------------------------------------------
  f('pav-0', 'pavilion', 'lantern', -8.55, 2.18, 6.05, 0, 0, WARM_LANTERN, 2.6, 2.5),
  f('pav-1', 'pavilion', 'lantern', -6.55, 2.18, 6.05, 0, 1, WARM_LANTERN, 2.6, 2.5),
  f('pav-2', 'pavilion', 'lantern', -7.55, 2.18, 8.35, 0, 2, WARM_LANTERN, 2.6, 2.5),

  // --- tree circuit --------------------------------------------------
  f('tree-0', 'tree', 'uplight', 6.35, 0, 4.9, 0.4, 0, WARM_TREE, 1.5, 1.35, 0.2, 0.25),
  f('tree-1', 'tree', 'uplight', 8.7, 0, 8.35, 0.9, 1, WARM_TREE, 1.5, 1.35, 0.2, 0.25),
  f('tree-2', 'tree', 'uplight', 5.7, 0, 11.4, 0.2, 2, WARM_TREE, 1.5, 1.35, 0.2, 0.25),
  f('tree-3', 'tree', 'uplight', 9.6, 0, 12.9, 0.6, 3, WARM_TREE, 1.5, 1.35, 0.2, 0.25),

  // --- permanent night-safety lighting on the stair tower ------------
  f('safe-0', 'safety', 'safety', -0.92, 2.42, -12.55, 0.6, 0, SAFETY_WHITE, 0.9, 1.5),
  f('safe-1', 'safety', 'safety', 0.94, 3.42, -11.95, -0.6, 1, SAFETY_WHITE, 0.9, 1.4),
  f('safe-2', 'safety', 'safety', -1.12, 0.62, 2.35, 0.9, 2, SAFETY_WHITE, 0.55, 1.1),
]

/** Fixture that answers the hand-crank: the bench lamp beside the slide exit. */
export const DISCOVERY_FIXTURE = 'path-3'

export interface ZoneDef {
  id: CircuitId
  /** Framing target when the camera pans to show the result of a slide. */
  anchor: THREE.Vector3
  /** Radius of the invisible tap target on the finale screen. */
  tapRadius: number
}

export const ZONES: ZoneDef[] = [
  { id: 'path', anchor: new THREE.Vector3(1.7, 0.9, 8.2), tapRadius: 2.6 },
  { id: 'pavilion', anchor: new THREE.Vector3(-7.55, 1.7, 7.0), tapRadius: 2.6 },
  { id: 'tree', anchor: new THREE.Vector3(7.6, 2.1, 8.6), tapRadius: 2.6 },
]

/* ------------------------------------------------------------------ *
 * Trees, benches and the climb route
 * ------------------------------------------------------------------ */

export interface TreeDef {
  x: number
  z: number
  height: number
  spread: number
  seed: number
}

export const TREES: TreeDef[] = [
  { x: 6.35, z: 4.9, height: 4.6, spread: 2.1, seed: 11 },
  { x: 8.7, z: 8.35, height: 5.3, spread: 2.5, seed: 12 },
  { x: 5.7, z: 11.4, height: 4.2, spread: 2.0, seed: 13 },
  { x: 9.6, z: 12.9, height: 5.0, spread: 2.4, seed: 14 },
  { x: -5.4, z: -2.4, height: 5.4, spread: 2.6, seed: 15 },
  { x: -10.3, z: 1.6, height: 6.0, spread: 2.9, seed: 16 },
  { x: 7.2, z: -3.6, height: 5.0, spread: 2.3, seed: 17 },
  { x: -3.9, z: 12.6, height: 5.6, spread: 2.7, seed: 18 },
  { x: 12.4, z: 1.2, height: 5.8, spread: 2.8, seed: 19 },
  { x: -12.0, z: 9.4, height: 6.2, spread: 3.0, seed: 20 },
  { x: -8.6, z: -7.2, height: 5.2, spread: 2.5, seed: 21 },
  { x: 11.0, z: -8.0, height: 5.5, spread: 2.6, seed: 22 },
]

export interface BenchDef {
  x: number
  z: number
  yaw: number
  /** Fixture id of the under-seat lamp, when this bench carries one. */
  lamp?: string
}

export const BENCHES: BenchDef[] = [
  { x: 1.62, z: 2.42, yaw: -1.45, lamp: 'path-3' },
  { x: 3.15, z: 8.2, yaw: -1.5, lamp: 'path-5' },
  { x: -7.55, z: 7.2, yaw: 0, lamp: undefined },
]

export const PAVILION = {
  x: -7.55,
  z: 7.2,
  width: 3.4,
  depth: 3.4,
  postHeight: 2.45,
} as const

/** Ground-level route the child walks from the park up to the slide seat. */
export const CLIMB_ROUTE: THREE.Vector3[] = [
  new THREE.Vector3(-0.02, 0, -14.35),
  new THREE.Vector3(-0.02, 0.04, -13.85),
  new THREE.Vector3(-0.02, 4.16, -12.16),
  new THREE.Vector3(-0.02, 4.2, -11.72),
]

export const STAIR = {
  z0: -13.85,
  z1: -12.16,
  top: 4.16,
  width: 0.86,
  steps: 12,
} as const
