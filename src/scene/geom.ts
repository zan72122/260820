import {
  BufferGeometry,
  Euler,
  ExtrudeGeometry,
  type Material,
  Matrix4,
  Mesh,
  Path,
  Quaternion,
  Shape,
  Vector2,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { TAU } from '../util/math'

const EXTRUDE = { depth: 1, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1, curveSegments: 8 }

/** An involute-ish spur gear: round body, trapezoidal teeth, optional bore and lightening holes. */
export function makeGearGeometry(
  radius: number,
  teeth: number,
  thickness: number,
  opts: { toothDepth?: number; bore?: number; spokes?: number } = {},
): BufferGeometry {
  const toothDepth = opts.toothDepth ?? radius * 0.13
  const root = radius - toothDepth
  const shape = new Shape()
  const pts: Vector2[] = []
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * TAU
    const step = TAU / teeth
    // root -> flank -> tip -> flank -> root
    pts.push(new Vector2(Math.cos(a0) * root, Math.sin(a0) * root))
    pts.push(new Vector2(Math.cos(a0 + step * 0.18) * radius, Math.sin(a0 + step * 0.18) * radius))
    pts.push(new Vector2(Math.cos(a0 + step * 0.34) * radius, Math.sin(a0 + step * 0.34) * radius))
    pts.push(new Vector2(Math.cos(a0 + step * 0.52) * root, Math.sin(a0 + step * 0.52) * root))
  }
  shape.setFromPoints(pts)

  if (opts.bore) {
    const hole = new Path()
    hole.absarc(0, 0, opts.bore, 0, TAU, true)
    shape.holes.push(hole)
  }
  const spokes = opts.spokes ?? 0
  if (spokes > 0) {
    const hr = root * 0.56
    const rr = root * 0.22
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * TAU + 0.2
      const hole = new Path()
      hole.absarc(Math.cos(a) * hr, Math.sin(a) * hr, rr, 0, TAU, true)
      shape.holes.push(hole)
    }
  }
  const g = new ExtrudeGeometry(shape, { ...EXTRUDE, depth: thickness })
  g.translate(0, 0, -thickness / 2)
  g.computeVertexNormals()
  return g
}

/** One-way saw-tooth ratchet wheel — the asymmetry is what makes "forward only" readable. */
export function makeRatchetGeometry(
  radius: number,
  teeth: number,
  thickness: number,
  bore = radius * 0.16,
): BufferGeometry {
  const root = radius * 0.84
  const shape = new Shape()
  const pts: Vector2[] = []
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * TAU
    const a1 = ((i + 1) / teeth) * TAU
    // gentle rising flank, then a radial cliff the pawl locks against
    pts.push(new Vector2(Math.cos(a0) * root, Math.sin(a0) * root))
    pts.push(new Vector2(Math.cos(a1 - 0.004) * radius, Math.sin(a1 - 0.004) * radius))
    pts.push(new Vector2(Math.cos(a1) * root, Math.sin(a1) * root))
  }
  shape.setFromPoints(pts)
  const hole = new Path()
  hole.absarc(0, 0, bore, 0, TAU, true)
  shape.holes.push(hole)
  const g = new ExtrudeGeometry(shape, { ...EXTRUDE, depth: thickness })
  g.translate(0, 0, -thickness / 2)
  g.computeVertexNormals()
  return g
}

/** Flat annulus with a chosen number of index notches cut into the outer edge. */
export function makeIndexRingGeometry(
  outer: number,
  inner: number,
  notches: number,
  thickness: number,
): BufferGeometry {
  const shape = new Shape()
  const pts: Vector2[] = []
  const seg = 4
  for (let i = 0; i < notches; i++) {
    for (let s = 0; s < seg; s++) {
      const f = (i + s / seg) / notches
      const a = f * TAU
      const sub = s / seg
      const r = sub < 0.22 ? outer * 0.965 : outer
      pts.push(new Vector2(Math.cos(a) * r, Math.sin(a) * r))
    }
  }
  shape.setFromPoints(pts)
  const hole = new Path()
  hole.absarc(0, 0, inner, 0, TAU, true)
  shape.holes.push(hole)
  const g = new ExtrudeGeometry(shape, { ...EXTRUDE, depth: thickness })
  g.translate(0, 0, -thickness / 2)
  g.computeVertexNormals()
  return g
}

/** Tapered clock hand with a counterweighted tail. */
export function makeHandGeometry(length: number, width: number, thickness: number): BufferGeometry {
  const shape = new Shape()
  shape.moveTo(-width * 1.6, -width * 0.9)
  shape.lineTo(-width * 2.5, 0)
  shape.lineTo(-width * 1.6, width * 0.9)
  shape.lineTo(length * 0.72, width * 0.42)
  shape.lineTo(length, 0)
  shape.lineTo(length * 0.72, -width * 0.42)
  shape.closePath()
  const g = new ExtrudeGeometry(shape, { ...EXTRUDE, depth: thickness, bevelSize: 0.003, bevelThickness: 0.003 })
  g.translate(0, 0, -thickness / 2)
  g.computeVertexNormals()
  return g
}

export function mergeAll(geos: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(geos, false)
  if (!merged) throw new Error('merge failed')
  for (const g of geos) g.dispose()
  return merged
}

/**
 * Collects repeated static parts — fence posts, dial marks, road segments — into
 * one geometry so they cost one draw call instead of eighty. Everything added
 * here must share a single material and never move independently.
 */
export class Batch {
  private parts: BufferGeometry[] = []
  private m = new Matrix4()
  private q = new Quaternion()
  private e = new Euler()
  private s = new Vector3(1, 1, 1)

  add(
    geo: BufferGeometry,
    position: Vector3Like,
    rotation?: Vector3Like,
    scale?: Vector3Like,
  ): this {
    this.e.set(rotation?.x ?? 0, rotation?.y ?? 0, rotation?.z ?? 0)
    this.q.setFromEuler(this.e)
    this.s.set(scale?.x ?? 1, scale?.y ?? 1, scale?.z ?? 1)
    this.m.compose(
      new Vector3(position.x, position.y, position.z),
      this.q,
      this.s,
    )
    this.parts.push(geo.clone().applyMatrix4(this.m))
    return this
  }

  /** Adds a geometry already positioned in the batch's own frame. */
  addRaw(geo: BufferGeometry): this {
    this.parts.push(geo)
    return this
  }

  get size(): number {
    return this.parts.length
  }

  build(material: Material, opts: { cast?: boolean; receive?: boolean } = {}): Mesh {
    const mesh = new Mesh(mergeAll(this.parts), material)
    mesh.castShadow = !!opts.cast
    mesh.receiveShadow = !!opts.receive
    this.parts = []
    return mesh
  }
}

export interface Vector3Like {
  x: number
  y: number
  z: number
}
