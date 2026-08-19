import * as THREE from 'three'

export type Pt = { r: number; y: number }
export type ProfileFn = (t: number, theta: number) => Pt

/**
 * Surface of revolution sampled on a (t, theta) grid.
 * Unlike LatheGeometry the profile may vary with theta, which is what lets the
 * cake rise unevenly and crack on top the way a real chiffon does.
 */
export function buildRevolve(
  fn: ProfileFn,
  nT: number,
  nTheta: number,
  opts: { uvScale?: THREE.Vector2 } = {},
): THREE.BufferGeometry {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const us = opts.uvScale?.x ?? 1
  const vs = opts.uvScale?.y ?? 1
  for (let i = 0; i <= nT; i++) {
    const t = i / nT
    for (let j = 0; j <= nTheta; j++) {
      const theta = (j / nTheta) * Math.PI * 2
      const p = fn(t, theta)
      pos.push(Math.cos(theta) * p.r, p.y, Math.sin(theta) * p.r)
      uv.push((j / nTheta) * us, t * vs)
    }
  }
  const row = nTheta + 1
  for (let i = 0; i < nT; i++) {
    for (let j = 0; j < nTheta; j++) {
      const a = i * row + j
      const b = a + 1
      const c = a + row
      const d = c + 1
      idx.push(a, b, c, b, d, c)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Sample a second profile with the same topology so it can be a morph target. */
export function revolveMorph(fn: ProfileFn, nT: number, nTheta: number): THREE.Float32BufferAttribute {
  const pos: number[] = []
  for (let i = 0; i <= nT; i++) {
    const t = i / nT
    for (let j = 0; j <= nTheta; j++) {
      const theta = (j / nTheta) * Math.PI * 2
      const p = fn(t, theta)
      pos.push(Math.cos(theta) * p.r, p.y, Math.sin(theta) * p.r)
    }
  }
  return new THREE.Float32BufferAttribute(pos, 3)
}

/**
 * Relative morph target (delta positions + delta normals) so several
 * deformations — rise, squash, wobble — can stack without fighting.
 */
export function addRelativeMorph(
  geo: THREE.BufferGeometry,
  fn: ProfileFn,
  nT: number,
  nTheta: number,
  refFn?: ProfileFn,
): void {
  let basePos: THREE.BufferAttribute = geo.getAttribute('position') as THREE.BufferAttribute
  let baseNrm: THREE.BufferAttribute = geo.getAttribute('normal') as THREE.BufferAttribute
  if (refFn) {
    const rg = new THREE.BufferGeometry()
    rg.setAttribute('position', revolveMorph(refFn, nT, nTheta))
    rg.setIndex(geo.getIndex())
    rg.computeVertexNormals()
    basePos = rg.getAttribute('position') as THREE.BufferAttribute
    baseNrm = rg.getAttribute('normal') as THREE.BufferAttribute
  }
  const target = revolveMorph(fn, nT, nTheta)

  const tmp = new THREE.BufferGeometry()
  tmp.setAttribute('position', target.clone())
  tmp.setIndex(geo.getIndex())
  tmp.computeVertexNormals()
  const tNrm = tmp.getAttribute('normal') as THREE.BufferAttribute

  const dp = new Float32Array(basePos.count * 3)
  const dn = new Float32Array(basePos.count * 3)
  /* eslint-disable-next-line */
  for (let i = 0; i < basePos.count * 3; i++) {
    dp[i] = target.array[i] - basePos.array[i]
    dn[i] = tNrm.array[i] - baseNrm.array[i]
  }
  tmp.dispose()

  if (!geo.morphAttributes.position) geo.morphAttributes.position = []
  if (!geo.morphAttributes.normal) geo.morphAttributes.normal = []
  geo.morphAttributes.position.push(new THREE.Float32BufferAttribute(dp, 3))
  geo.morphAttributes.normal.push(new THREE.Float32BufferAttribute(dn, 3))
  geo.morphTargetsRelative = true
}

/** Resample a hand-authored cross-section polyline by arc length. */
export function polyline(points: [number, number][]): (t: number) => Pt {
  const cum: number[] = [0]
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0]
    const dy = points[i][1] - points[i - 1][1]
    cum.push(cum[i - 1] + Math.hypot(dx, dy))
  }
  const total = cum[cum.length - 1]
  return (t: number) => {
    const d = Math.max(0, Math.min(1, t)) * total
    let i = 1
    while (i < cum.length - 1 && cum[i] < d) i++
    const f = (d - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1])
    return {
      r: points[i - 1][0] + (points[i][0] - points[i - 1][0]) * f,
      y: points[i - 1][1] + (points[i][1] - points[i - 1][1]) * f,
    }
  }
}

/** Rounded-rectangle shape, used for blades and handles. */
export function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape()
  const x = -w / 2, y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

/** Disc grid used for liquid surfaces that need per-vertex deformation. */
export function discGrid(radius: number, rings: number, segments: number): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(radius, segments, 0, Math.PI * 2)
  const dense = new THREE.RingGeometry(0.0001, radius, segments, rings)
  dense.rotateX(-Math.PI / 2)
  g.dispose()
  return dense
}
