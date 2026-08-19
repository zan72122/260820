import * as THREE from 'three'
import { fbm2, TAU } from '../core/rng'

/**
 * Ring/disc *sector* solids.
 *
 * The whole cake is authored as sectors so a wedge can be lifted out without any
 * runtime CSG: every layer exists twice, once as the big remaining body and once
 * as the slice. Material group 0 is the baked outside, group 1 is the open crumb
 * (hole wall + the two radial cut faces) — that is what makes the cross-section
 * readable after the cut.
 */
export interface SectorParams {
  rOuter: number
  rInner: number
  height: number
  thetaStart: number
  thetaLength: number
  segsPerTurn?: number
  heightSegs?: number
  radialSegs?: number
  /** barrel of the outer wall, cm (a baked layer bulges slightly) */
  bulge?: number
  /** rise of the top cap at the centre, cm */
  domeTop?: number
  /** low frequency radius noise, cm */
  wobble?: number
  seed?: number
  /** emit the two radial faces (skip for a full 360 solid) */
  capped?: boolean
  /** put every face into group 0 (used for cream, which has one material) */
  singleMaterial?: boolean
  /** cm covered by one texture tile */
  uvScale?: number
}

const EPS = 1e-4

export function sectorGeometry(p: SectorParams): THREE.BufferGeometry {
  const segsPerTurn = p.segsPerTurn ?? 96
  const full = p.thetaLength >= TAU - EPS
  const segs = Math.max(3, Math.round((segsPerTurn * p.thetaLength) / TAU))
  const hs = p.heightSegs ?? 3
  const rs = p.radialSegs ?? 4
  const wobble = p.wobble ?? 0
  const bulge = p.bulge ?? 0
  const dome = p.domeTop ?? 0
  const seed = p.seed ?? 1
  const UV = p.uvScale ?? 6
  const capped = p.capped ?? !full
  const rInner = Math.max(p.rInner, 1e-3)

  const pos: number[] = []
  const uv: number[] = []
  const col: number[] = []
  const idxCrust: number[] = []
  const idxCrumb: number[] = []

  const outerR = (th: number) =>
    p.rOuter + wobble * fbm2(Math.cos(th) * 3.1 + 4, Math.sin(th) * 3.1 + 4, 3, seed)
  const innerR = (th: number) =>
    rInner + wobble * 0.55 * fbm2(Math.cos(th) * 4.4, Math.sin(th) * 4.4, 2, seed + 9)
  const bulgeAt = (t: number) => bulge * Math.sin(Math.PI * t)
  const topY = (r: number) => p.height + dome * (1 - Math.pow(r / p.rOuter, 2))

  const pushColor = (a: number, b: number, amp = 0.06) => {
    const n = fbm2(a, b, 2, seed + 3) * amp
    col.push(1 + n, 1 + n * 0.95, 1 + n * 0.85)
  }

  /* --- outer wall (baked) ------------------------------------------ */
  {
    const base = pos.length / 3
    for (let i = 0; i <= segs; i++) {
      const th = p.thetaStart + p.thetaLength * (i / segs)
      for (let j = 0; j <= hs; j++) {
        const t = j / hs
        const y = t * p.height
        const r = outerR(th) + bulgeAt(t)
        pos.push(Math.cos(th) * r, y, Math.sin(th) * r)
        uv.push((th * p.rOuter) / UV, y / UV)
        pushColor(th * 2.4, y * 0.7, 0.08)
      }
    }
    for (let i = 0; i < segs; i++)
      for (let j = 0; j < hs; j++) {
        const a = base + i * (hs + 1) + j
        const b = a + (hs + 1)
        const c = a + 1
        const d = b + 1
        idxCrust.push(a, c, b, c, d, b)
      }
  }

  /* --- inner hole wall (crumb) ------------------------------------- */
  if (p.rInner > 0.05) {
    const base = pos.length / 3
    for (let i = 0; i <= segs; i++) {
      const th = p.thetaStart + p.thetaLength * (i / segs)
      for (let j = 0; j <= hs; j++) {
        const t = j / hs
        const y = t * p.height
        const r = innerR(th) - bulgeAt(t) * 0.3
        pos.push(Math.cos(th) * r, y, Math.sin(th) * r)
        uv.push((th * rInner) / UV, y / UV)
        pushColor(th * 3.1 + 20, y * 0.9, 0.05)
      }
    }
    for (let i = 0; i < segs; i++)
      for (let j = 0; j < hs; j++) {
        const a = base + i * (hs + 1) + j
        const b = a + (hs + 1)
        const c = a + 1
        const d = b + 1
        idxCrumb.push(a, b, c, c, b, d)
      }
  }

  /* --- top / bottom caps (baked) ----------------------------------- */
  const addCap = (up: boolean) => {
    const base = pos.length / 3
    for (let i = 0; i <= segs; i++) {
      const th = p.thetaStart + p.thetaLength * (i / segs)
      const ro = outerR(th)
      const ri = p.rInner > 0.05 ? innerR(th) : 1e-3
      for (let k = 0; k <= rs; k++) {
        const r = ri + (ro - ri) * (k / rs)
        const y = up ? topY(r) : 0
        const x = Math.cos(th) * r
        const z = Math.sin(th) * r
        pos.push(x, y, z)
        uv.push(x / UV, z / UV)
        pushColor(x * 0.6, z * 0.6, up ? 0.07 : 0.05)
      }
    }
    for (let i = 0; i < segs; i++)
      for (let k = 0; k < rs; k++) {
        const a = base + i * (rs + 1) + k
        const b = a + (rs + 1)
        const c = a + 1
        const d = b + 1
        if (up) idxCrust.push(a, b, c, b, d, c)
        else idxCrust.push(a, c, b, b, c, d)
      }
  }
  addCap(true)
  addCap(false)

  /* --- radial cut faces (crumb) ------------------------------------ */
  if (capped) {
    const addFace = (th: number, positive: boolean) => {
      const base = pos.length / 3
      const ro = outerR(th)
      const ri = p.rInner > 0.05 ? innerR(th) : 1e-3
      for (let k = 0; k <= rs; k++) {
        const r = ri + (ro - ri) * (k / rs)
        for (let j = 0; j <= hs; j++) {
          const t = j / hs
          const y = Math.min(t * p.height, topY(r))
          pos.push(Math.cos(th) * r, y, Math.sin(th) * r)
          uv.push(r / UV, y / UV)
          pushColor(r * 1.1 + 40, y * 1.1, 0.05)
        }
      }
      for (let k = 0; k < rs; k++)
        for (let j = 0; j < hs; j++) {
          const a = base + k * (hs + 1) + j
          const b = a + (hs + 1)
          const c = a + 1
          const d = b + 1
          if (positive) idxCrumb.push(a, b, c, c, b, d)
          else idxCrumb.push(a, c, b, b, c, d)
        }
    }
    addFace(p.thetaStart, false)
    addFace(p.thetaStart + p.thetaLength, true)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))

  if (p.singleMaterial) {
    geo.setIndex([...idxCrust, ...idxCrumb])
    geo.addGroup(0, idxCrust.length + idxCrumb.length, 0)
  } else {
    geo.setIndex([...idxCrust, ...idxCrumb])
    geo.addGroup(0, idxCrust.length, 0)
    geo.addGroup(idxCrust.length, idxCrumb.length, 1)
  }
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

/**
 * The outside coating: a skirt around the cake plus the top surface, with the
 * index buffer ordered by angle so `setDrawRange` sweeps the frosting on as the
 * turntable spins. No shader, no geometry rebuild per frame.
 */
export interface CoatingParams {
  radius: number
  /** inner radius of the top face; > 0 also emits an inner wall (cream rings) */
  rInner?: number
  yBottom: number
  yTop: number
  thetaStart: number
  thetaLength: number
  segsPerTurn?: number
  heightSegs?: number
  /** also cap the top */
  withTop?: boolean
  /** height of the dome at the centre of the top face */
  domeTop?: number
  wobble?: number
  seed?: number
  uvScale?: number
}

export interface CoatingResult {
  geometry: THREE.BufferGeometry
  /** index count for one angular column, used for the sweep */
  columns: number
  perColumn: number
}

export function coatingGeometry(p: CoatingParams): CoatingResult {
  const segsPerTurn = p.segsPerTurn ?? 108
  const segs = Math.max(2, Math.round((segsPerTurn * p.thetaLength) / TAU))
  const hs = p.heightSegs ?? 5
  const rs = 5
  const wobble = p.wobble ?? 0.1
  const seed = p.seed ?? 5
  const UV = p.uvScale ?? 7
  const h = p.yTop - p.yBottom

  const pos: number[] = []
  const uv: number[] = []
  const col: number[] = []
  const index: number[] = []

  const rAt = (th: number, t: number) =>
    p.radius +
    wobble * fbm2(Math.cos(th) * 3.6, Math.sin(th) * 3.6 + t * 2.2, 3, seed) +
    0.05 * Math.sin(t * 9 + th * 3)

  // vertices: side ring grid then top ring grid, both indexed [i][*]
  const sideBase = 0
  for (let i = 0; i <= segs; i++) {
    const th = p.thetaStart + p.thetaLength * (i / segs)
    for (let j = 0; j <= hs; j++) {
      const t = j / hs
      const y = p.yBottom + t * h
      const r = rAt(th, t)
      pos.push(Math.cos(th) * r, y, Math.sin(th) * r)
      uv.push((th * p.radius) / UV, y / UV)
      const n = fbm2(th * 3, y, 2, seed + 2) * 0.05
      col.push(1 + n, 1 + n, 1 + n * 0.95)
    }
  }
  const rIn = p.rInner ?? 0
  const hasInner = rIn > 0.05
  const dome = p.domeTop ?? 0.16

  const innerBase = pos.length / 3
  if (hasInner) {
    for (let i = 0; i <= segs; i++) {
      const th = p.thetaStart + p.thetaLength * (i / segs)
      for (let j = 0; j <= hs; j++) {
        const t = j / hs
        const y = p.yBottom + t * h
        pos.push(Math.cos(th) * rIn, y, Math.sin(th) * rIn)
        uv.push((th * rIn) / UV, y / UV)
        col.push(1, 1, 1)
      }
    }
  }

  const topBase = pos.length / 3
  if (p.withTop) {
    for (let i = 0; i <= segs; i++) {
      const th = p.thetaStart + p.thetaLength * (i / segs)
      const ro = rAt(th, 1)
      const ri = hasInner ? rIn : 1e-3
      for (let k = 0; k <= rs; k++) {
        const r = ri + (ro - ri) * (k / rs)
        const x = Math.cos(th) * r
        const z = Math.sin(th) * r
        // gently domed top, like spread frosting
        const y = p.yTop + dome * (1 - Math.pow(r / ro, 2))
        pos.push(x, y, z)
        uv.push(x / UV, z / UV)
        const n = fbm2(x * 0.8, z * 0.8, 2, seed + 4) * 0.05
        col.push(1 + n, 1 + n, 1 + n * 0.95)
      }
    }
  }

  // index, grouped per angular column so drawRange == angular sweep
  const perColumn = hs * 6 + (hasInner ? hs * 6 : 0) + (p.withTop ? rs * 6 : 0)
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < hs; j++) {
      const a = sideBase + i * (hs + 1) + j
      const b = a + (hs + 1)
      const c = a + 1
      const d = b + 1
      index.push(a, c, b, c, d, b)
    }
    if (hasInner) {
      for (let j = 0; j < hs; j++) {
        const a = innerBase + i * (hs + 1) + j
        const b = a + (hs + 1)
        const c = a + 1
        const d = b + 1
        index.push(a, b, c, c, b, d)
      }
    }
    if (p.withTop) {
      for (let k = 0; k < rs; k++) {
        const a = topBase + i * (rs + 1) + k
        const b = a + (rs + 1)
        const c = a + 1
        const d = b + 1
        index.push(a, b, c, b, d, c)
      }
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return { geometry: geo, columns: segs, perColumn }
}

/** A rounded, slightly squashed candy shell (smartie / dragee). */
export function dragee(r: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, 14, 10)
  g.scale(1, 0.62, 1)
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const s = 1 + 0.03 * fbm2(x * 6, z * 6, 2, 11)
    pos.setXYZ(i, x * s, y * s, z * s)
  }
  g.computeVertexNormals()
  return g
}

/** Extruded star, the classic sugar sprinkle shape. */
export function starShape(r: number, points = 5): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * TAU - Math.PI / 2
    const rr = i % 2 === 0 ? r : r * 0.46
    const x = Math.cos(a) * rr
    const y = Math.sin(a) * rr
    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: r * 0.44,
    bevelEnabled: true,
    bevelSize: r * 0.1,
    bevelThickness: r * 0.08,
    bevelSegments: 1,
    curveSegments: 1,
  })
  g.center()
  g.rotateX(Math.PI / 2)
  g.computeVertexNormals()
  return g
}

/** Extruded heart sugar candy. */
export function heartShape(r: number): THREE.BufferGeometry {
  const s = new THREE.Shape()
  const k = r * 1.05
  s.moveTo(0, -k * 0.9)
  s.bezierCurveTo(k * 1.35, k * 0.15, k * 0.62, k * 1.15, 0, k * 0.45)
  s.bezierCurveTo(-k * 0.62, k * 1.15, -k * 1.35, k * 0.15, 0, -k * 0.9)
  const g = new THREE.ExtrudeGeometry(s, {
    depth: r * 0.46,
    bevelEnabled: true,
    bevelSize: r * 0.1,
    bevelThickness: r * 0.09,
    bevelSegments: 1,
    curveSegments: 4,
  })
  g.center()
  g.rotateX(Math.PI / 2)
  g.computeVertexNormals()
  return g
}

/** Rough broken chocolate chunk. */
export function chocChunk(r: number, seed = 3): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(r * 1.7, r * 1.15, r * 1.5, 2, 2, 2)
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    pos.setXYZ(
      i,
      x + fbm2(x * 9 + i, z * 9, 2, seed) * r * 0.24,
      y + fbm2(y * 9, x * 9 + i, 2, seed + 5) * r * 0.2,
      z + fbm2(z * 9, y * 9 + i, 2, seed + 9) * r * 0.24,
    )
  }
  g.computeVertexNormals()
  return g
}

/** Small chocolate button/lentil. */
export function lentil(r: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r * 0.86, r * 0.72, 12, 1)
  g.computeVertexNormals()
  return g
}
