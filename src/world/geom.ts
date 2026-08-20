import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/** 2 点をつなぐ角材。トラスや柵の部材をこれで組む。 */
export function strut(a: THREE.Vector3, b: THREE.Vector3, w: number, h = w, uvScale = 0.8) {
  const dir = new THREE.Vector3().subVectors(b, a)
  const len = dir.length()
  if (len < 1e-4) return null
  const g = new THREE.BoxGeometry(w, h, len)
  scaleBoxUV(g, w, h, len, uvScale)
  const m = new THREE.Matrix4()
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5)
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    dir.clone().normalize(),
  )
  m.compose(mid, q, new THREE.Vector3(1, 1, 1))
  g.applyMatrix4(m)
  return g
}

/** BoxGeometry の UV をワールド寸法に合わせて引き伸ばす（模様の密度を揃える）。 */
export function scaleBoxUV(g: THREE.BufferGeometry, w: number, h: number, d: number, s = 1) {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute
  // BoxGeometry の面順: +X, -X, +Y, -Y, +Z, -Z （各 4 頂点）
  const spans: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ]
  for (let f = 0; f < 6; f++) {
    const [su, sv] = spans[f]
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i
      uv.setXY(idx, uv.getX(idx) * su * s, uv.getY(idx) * sv * s)
    }
  }
  uv.needsUpdate = true
  return g
}

export function box(
  w: number,
  h: number,
  d: number,
  x = 0,
  y = 0,
  z = 0,
  uvScale = 0.8,
  rotY = 0,
) {
  const g = new THREE.BoxGeometry(w, h, d)
  scaleBoxUV(g, w, h, d, uvScale)
  if (rotY) g.rotateY(rotY)
  g.translate(x, y, z)
  return g
}

export function merge(parts: (THREE.BufferGeometry | null)[]) {
  const list = parts.filter((p): p is THREE.BufferGeometry => !!p)
  if (list.length === 0) return new THREE.BufferGeometry()
  const g = mergeGeometries(list, false)
  list.forEach((p) => p.dispose())
  g.computeVertexNormals()
  return g
}

/**
 * 断面を z 方向に掃引して立体を作る（橋桁など）。
 * section は (x, y) の閉ポリゴン。yFn(z) で高さが変わる。
 */
export function sweep(
  zs: number[],
  section: [number, number][],
  yFn: (z: number) => number,
  uvScale = 0.25,
) {
  const rings = zs.length
  const n = section.length
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []

  // 断面の周長パラメータ
  const perim: number[] = [0]
  for (let i = 1; i <= n; i++) {
    const a = section[i - 1]
    const b = section[i % n]
    perim.push(perim[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }

  for (let r = 0; r < rings; r++) {
    const z = zs[r]
    const y0 = yFn(z)
    for (let i = 0; i <= n; i++) {
      const s = section[i % n]
      pos.push(s[0], y0 + s[1], z)
      uv.push(perim[i] * uvScale, z * uvScale)
    }
  }
  const stride = n + 1
  for (let r = 0; r < rings - 1; r++) {
    for (let i = 0; i < n; i++) {
      const a = r * stride + i
      const b = a + 1
      const c = (r + 1) * stride + i
      const d = c + 1
      idx.push(a, c, b, b, c, d)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}
