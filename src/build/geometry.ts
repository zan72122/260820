/** 部材づくりの共通ジオメトリ。角を丸めすぎず、面取りと板厚を持たせる。 */
import * as THREE from 'three'

/** 面取り付きの箱。コンクリートや厚板の端部に使う。 */
export function chamferBox(w: number, h: number, d: number, bevel = 0.008): THREE.BufferGeometry {
  const b = Math.min(bevel, w / 2 - 1e-3, d / 2 - 1e-3, h / 2 - 1e-3)
  const shape = new THREE.Shape()
  const hw = w / 2 - b
  const hd = d / 2 - b
  shape.moveTo(-hw, -hd)
  shape.lineTo(hw, -hd)
  shape.lineTo(hw, hd)
  shape.lineTo(-hw, hd)
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: h - b * 2,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    curveSegments: 1,
  })
  g.rotateX(-Math.PI / 2)
  // ExtrudeGeometry は 0..depth+bevel の範囲に出るので、原点中心へ寄せ直す
  g.translate(0, -(h / 2 - b), 0)
  g.computeVertexNormals()
  return g
}

/** ボルト穴つきのベースプレート。柱が降りるとき、穴とアンカーボルトが同じ画面で見えるようにする。 */
export function plateWithHoles(
  w: number,
  d: number,
  t: number,
  holes: Array<{ x: number; z: number; r: number }>,
): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  const b = 0.006
  shape.moveTo(-w / 2 + b, -d / 2)
  shape.lineTo(w / 2 - b, -d / 2)
  shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + b)
  shape.lineTo(w / 2, d / 2 - b)
  shape.quadraticCurveTo(w / 2, d / 2, w / 2 - b, d / 2)
  shape.lineTo(-w / 2 + b, d / 2)
  shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - b)
  shape.lineTo(-w / 2, -d / 2 + b)
  shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + b, -d / 2)
  for (const h of holes) {
    const path = new THREE.Path()
    path.absarc(h.x, h.z, h.r, 0, Math.PI * 2, true)
    shape.holes.push(path)
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 10 })
  g.rotateX(-Math.PI / 2)
  g.translate(0, t, 0)
  g.computeVertexNormals()
  return g
}

/** 六角ボルト頭＋座金。魔法の発光はさせない。 */
export function hexNut(across: number, height: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(across / 2 / Math.cos(Math.PI / 6), across / 2 / Math.cos(Math.PI / 6), height, 6)
  g.translate(0, height / 2, 0)
  return g
}

export function washer(outer: number, inner: number, t: number): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.absarc(0, 0, outer / 2, 0, Math.PI * 2, false)
  const hole = new THREE.Path()
  hole.absarc(0, 0, inner / 2, 0, Math.PI * 2, true)
  shape.holes.push(hole)
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 14 })
  g.rotateX(-Math.PI / 2)
  g.translate(0, t, 0)
  return g
}

export interface SweepFrame {
  position: THREE.Vector3
  tangent: THREE.Vector3
}

/**
 * 断面ポリライン（閉ループ）をパスに沿って掃引する。滑走面のパン断面に使う。
 * side は常に world X 方向、up は tangent と side の外積。
 */
export function sweepClosedProfile(profile: Array<[number, number]>, frames: SweepFrame[]): THREE.BufferGeometry {
  const n = profile.length
  const m = frames.length
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const side = new THREE.Vector3(1, 0, 0)
  const up = new THREE.Vector3()

  let runningLength = 0
  const lengths: number[] = [0]
  for (let i = 1; i < m; i++) {
    runningLength += frames[i].position.distanceTo(frames[i - 1].position)
    lengths.push(runningLength)
  }

  for (let i = 0; i < m; i++) {
    const f = frames[i]
    up.copy(side).cross(f.tangent).normalize()
    for (let j = 0; j < n; j++) {
      const [px, py] = profile[j]
      positions.push(
        f.position.x + side.x * px + up.x * py,
        f.position.y + side.y * px + up.y * py,
        f.position.z + side.z * px + up.z * py,
      )
      uvs.push(j / (n - 1), runningLength > 0 ? lengths[i] / runningLength : 0)
    }
  }
  for (let i = 0; i < m - 1; i++) {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n
      const a = i * n + j
      const b = i * n + j2
      const c = (i + 1) * n + j
      const d = (i + 1) * n + j2
      indices.push(a, c, b, b, c, d)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/** 端部の蓋（断面をそのまま三角形分割する簡易版） */
export function capProfile(profile: Array<[number, number]>, frame: SweepFrame, flip: boolean): THREE.BufferGeometry {
  const shape = new THREE.Shape(profile.map(([x, y]) => new THREE.Vector2(x, y)))
  const g = new THREE.ShapeGeometry(shape)
  const up = new THREE.Vector3(1, 0, 0).cross(frame.tangent).normalize()
  const side = new THREE.Vector3(1, 0, 0)
  const fwd = new THREE.Vector3().copy(side).cross(up).normalize()
  const m = new THREE.Matrix4().makeBasis(side, up, fwd)
  g.applyMatrix4(m)
  g.translate(frame.position.x, frame.position.y, frame.position.z)
  if (flip) g.scale(1, 1, 1)
  g.computeVertexNormals()
  return g
}

/** 曲げパイプ（手すり用） */
export function bentTube(points: THREE.Vector3[], radius: number, radialSegments = 10): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.02)
  return new THREE.TubeGeometry(curve, Math.max(12, points.length * 8), radius, radialSegments, false)
}

/** C形鋼（リップ溝形鋼）断面の押し出し。プラットフォームの下部フレームに使う。 */
export function channelSection(length: number, h: number, w: number, t: number): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(0, -h / 2)
  s.lineTo(w, -h / 2)
  s.lineTo(w, -h / 2 + t)
  s.lineTo(t, -h / 2 + t)
  s.lineTo(t, h / 2 - t)
  s.lineTo(w, h / 2 - t)
  s.lineTo(w, h / 2)
  s.lineTo(0, h / 2)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false, curveSegments: 1 })
  g.translate(-w / 2, 0, -length / 2)
  g.computeVertexNormals()
  return g
}

export function mergeInto(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, castShadow = true) {
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = castShadow
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}
