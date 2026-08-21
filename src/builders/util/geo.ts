import { BufferAttribute, BufferGeometry, Color } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Rng } from '../../core/rng'

/**
 * Chamfered box: flat 45° 面取り on every edge — the way planed timber and
 * dressed stone actually look. Never a large smooth radius (that is the
 * over-rounded AI-CG tell this project bans).
 *
 * UVs are in METRES (each big face planar-mapped at real scale) so materials
 * can tile textures at physical size via texture.repeat.
 */
export function chamferBox(
  w: number,
  h: number,
  d: number,
  chamfer: number,
): BufferGeometry {
  const c = Math.min(chamfer, w / 2.001, h / 2.001, d / 2.001)
  const x = w / 2
  const y = h / 2
  const z = d / 2

  const positions: number[] = []
  const uvs: number[] = []

  // The solid is convex and centred at the origin, so outward orientation is
  // decidable per-triangle: flip whenever the winding normal points inward.
  const tri = (
    a: readonly number[],
    b: readonly number[],
    cc: readonly number[],
    uvAxisU: 0 | 1 | 2,
    uvAxisV: 0 | 1 | 2,
  ) => {
    const abx = (b[0] as number) - (a[0] as number)
    const aby = (b[1] as number) - (a[1] as number)
    const abz = (b[2] as number) - (a[2] as number)
    const acx = (cc[0] as number) - (a[0] as number)
    const acy = (cc[1] as number) - (a[1] as number)
    const acz = (cc[2] as number) - (a[2] as number)
    const nx = aby * acz - abz * acy
    const ny = abz * acx - abx * acz
    const nz = abx * acy - aby * acx
    const cx = ((a[0] as number) + (b[0] as number) + (cc[0] as number)) / 3
    const cy = ((a[1] as number) + (b[1] as number) + (cc[1] as number)) / 3
    const cz = ((a[2] as number) + (b[2] as number) + (cc[2] as number)) / 3
    const pts = nx * cx + ny * cy + nz * cz >= 0 ? [a, b, cc] : [a, cc, b]
    for (const p of pts) {
      positions.push(p[0] as number, p[1] as number, p[2] as number)
      uvs.push(p[uvAxisU] as number, p[uvAxisV] as number)
    }
  }
  const quad = (
    a: readonly number[],
    b: readonly number[],
    cc: readonly number[],
    dd: readonly number[],
    uvAxisU: 0 | 1 | 2,
    uvAxisV: 0 | 1 | 2,
  ) => {
    tri(a, b, cc, uvAxisU, uvAxisV)
    tri(a, cc, dd, uvAxisU, uvAxisV)
  }

  // Big faces (inset by the chamfer).
  // +X / -X
  quad([x, -(y - c), -(z - c)], [x, y - c, -(z - c)], [x, y - c, z - c], [x, -(y - c), z - c], 2, 1)
  quad([-x, -(y - c), z - c], [-x, y - c, z - c], [-x, y - c, -(z - c)], [-x, -(y - c), -(z - c)], 2, 1)
  // +Y / -Y
  quad([-(x - c), y, -(z - c)], [-(x - c), y, z - c], [x - c, y, z - c], [x - c, y, -(z - c)], 0, 2)
  quad([-(x - c), -y, z - c], [-(x - c), -y, -(z - c)], [x - c, -y, -(z - c)], [x - c, -y, z - c], 0, 2)
  // +Z / -Z
  quad([-(x - c), -(y - c), z], [x - c, -(y - c), z], [x - c, y - c, z], [-(x - c), y - c, z], 0, 1)
  quad([x - c, -(y - c), -z], [-(x - c), -(y - c), -z], [-(x - c), y - c, -z], [x - c, y - c, -z], 0, 1)

  // Edge bevels. sx/sy/sz pick the octant signs.
  for (const sy of [1, -1]) {
    for (const sz of [1, -1]) {
      // Edges along X between the ±Y and ±Z faces.
      const pY0 = [-(x - c), sy * y, sz * (z - c)]
      const pY1 = [x - c, sy * y, sz * (z - c)]
      const pZ0 = [-(x - c), sy * (y - c), sz * z]
      const pZ1 = [x - c, sy * (y - c), sz * z]
      if (sy * sz > 0) quad(pY0, pY1, pZ1, pZ0, 0, 1)
      else quad(pY1, pY0, pZ0, pZ1, 0, 1)
    }
  }
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      // Edges along Y between the ±X and ±Z faces.
      const pX0 = [sx * x, -(y - c), sz * (z - c)]
      const pX1 = [sx * x, y - c, sz * (z - c)]
      const pZ0 = [sx * (x - c), -(y - c), sz * z]
      const pZ1 = [sx * (x - c), y - c, sz * z]
      if (sx * sz > 0) quad(pX1, pX0, pZ0, pZ1, 1, 2)
      else quad(pX0, pX1, pZ1, pZ0, 1, 2)
    }
  }
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      // Edges along Z between the ±X and ±Y faces.
      const pX0 = [sx * x, sy * (y - c), -(z - c)]
      const pX1 = [sx * x, sy * (y - c), z - c]
      const pY0 = [sx * (x - c), sy * y, -(z - c)]
      const pY1 = [sx * (x - c), sy * y, z - c]
      if (sx * sy > 0) quad(pX0, pX1, pY1, pY0, 2, 0)
      else quad(pX1, pX0, pY0, pY1, 2, 0)
    }
  }

  // Corner triangles.
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      for (const sz of [1, -1]) {
        const pX = [sx * x, sy * (y - c), sz * (z - c)]
        const pY = [sx * (x - c), sy * y, sz * (z - c)]
        const pZ = [sx * (x - c), sy * (y - c), sz * z]
        if (sx * sy * sz > 0) tri(pX, pY, pZ, 0, 1)
        else tri(pX, pZ, pY, 0, 1)
      }
    }
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
  geo.computeVertexNormals()
  return geo
}

/** Shift all UVs — per-plank/per-tile offsets so no two repeats align. */
export function offsetUvs(geo: BufferGeometry, du: number, dv: number): void {
  const uv = geo.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) + du, uv.getY(i) + dv)
  }
  uv.needsUpdate = true
}

/** Subtle per-instance colour variation (no two boards identical). */
export function tintJitter(rng: Rng, base: string, amount: number): Color {
  const c = new Color(base)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL(
    hsl.h + (rng() * 2 - 1) * amount * 0.15,
    Math.max(0, hsl.s + (rng() * 2 - 1) * amount * 0.5),
    Math.max(0, Math.min(1, hsl.l + (rng() * 2 - 1) * amount)),
  )
  return c
}

/** Translate a geometry in place (convenience wrapper). */
export function moveGeo(geo: BufferGeometry, x: number, y: number, z: number): BufferGeometry {
  geo.translate(x, y, z)
  return geo
}

/** Fill (or overwrite) a constant per-vertex colour attribute. */
export function setVertexColor(geo: BufferGeometry, color: Color): BufferGeometry {
  const count = geo.getAttribute('position').count
  const arr = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    arr[i * 3] = color.r
    arr[i * 3 + 1] = color.g
    arr[i * 3 + 2] = color.b
  }
  geo.setAttribute('color', new BufferAttribute(arr, 3))
  return geo
}

/** Merge parts into one draw call. Indexed parts are de-indexed first so
 * mixed sources (chamferBox, Cylinder, Plane...) always merge. */
export function mergeParts(parts: BufferGeometry[]): BufferGeometry {
  if (parts.length === 0) throw new Error('mergeParts: empty')
  const normalized = parts.map((p) => (p.getIndex() ? p.toNonIndexed() : p))
  const merged = mergeGeometries(normalized, false)
  if (!merged) throw new Error('mergeParts: attribute mismatch')
  for (const p of parts) p.dispose()
  return merged
}
