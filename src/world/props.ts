import * as THREE from 'three'
import { box, merge, strut } from './geom'
import { groundHeight, inCameraZone, L, wearAmount } from './layout'
import type { MaterialLib } from './materials'
import { lerp, makeRng, rand, type Rng } from '../core/util'
import { deckY } from './bridge'

/**
 * 会場の「置かれているもの」。
 * 柵・コーン・ブルーシート・本部テント・仮設トイレ・電柱・木。
 * 毎年ここで花火大会をやっている場所に見えるように、
 * きれいに並びすぎないよう少しずつ崩して置く。
 */

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/** たるんだロープ（懸垂線もどき）。 */
function ropeSpan(a: THREE.Vector3, b: THREE.Vector3, sag: number, seg = 6, r = 0.035) {
  const parts: (THREE.BufferGeometry | null)[] = []
  let prev = a.clone()
  for (let i = 1; i <= seg; i++) {
    const t = i / seg
    const p = a.clone().lerp(b, t)
    p.y -= Math.sin(t * Math.PI) * sag
    parts.push(strut(prev, p, r * 2, r * 2, 1.2))
    prev = p
  }
  return parts
}

/** 簡易柵（単管の杭 + ロープ）。 */
export function buildRopeFence(
  points: THREE.Vector3[],
  lib: MaterialLib,
  rng: Rng,
  height = 0.95,
  spacing = 3.2,
) {
  const stakes: (THREE.BufferGeometry | null)[] = []
  const ropes: (THREE.BufferGeometry | null)[] = []
  const nodes: THREE.Vector3[] = []

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const len = a.distanceTo(b)
    const n = Math.max(1, Math.round(len / spacing))
    for (let k = 0; k < n; k++) {
      const t = k / n
      const p = a.clone().lerp(b, t)
      p.y = groundHeight(p.x, p.z)
      nodes.push(p)
    }
  }
  nodes.push(points[points.length - 1].clone())
  nodes[nodes.length - 1].y = groundHeight(
    nodes[nodes.length - 1].x,
    nodes[nodes.length - 1].z,
  )

  for (const p of nodes) {
    const h = height * rand(rng, 0.94, 1.06)
    const tilt = rand(rng, -0.05, 0.05)
    stakes.push(
      strut(
        V(p.x, p.y - 0.15, p.z),
        V(p.x + tilt * h, p.y + h, p.z + rand(rng, -0.03, 0.03) * h),
        0.062,
        0.062,
        1.4,
      ),
    )
  }
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i].clone()
    const b = nodes[i + 1].clone()
    a.y += height * 0.92
    b.y += height * 0.92
    ropes.push(...ropeSpan(a, b, 0.075 * a.distanceTo(b) * 0.14 + 0.05, 5))
  }

  const g = new THREE.Group()
  const sm = new THREE.Mesh(merge(stakes), lib.steel)
  sm.castShadow = true
  g.add(sm)
  const rm = new THREE.Mesh(merge(ropes), lib.paintWhite)
  rm.castShadow = false
  g.add(rm)
  return g
}

/** 三角コーン。 */
function coneGeo(rng: Rng) {
  const parts: THREE.BufferGeometry[] = []
  const h = rand(rng, 0.66, 0.74)
  const c = new THREE.ConeGeometry(0.19, h, 10, 1, true)
  c.translate(0, h / 2 + 0.03, 0)
  parts.push(c)
  parts.push(box(0.38, 0.035, 0.38, 0, 0.018, 0, 1.6))
  return merge(parts)
}

export function buildCones(positions: THREE.Vector3[], lib: MaterialLib, rng: Rng) {
  const geo = coneGeo(rng)
  const mesh = new THREE.InstancedMesh(geo, lib.plasticOrange, positions.length)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const s = new THREE.Vector3(1, 1, 1)
  positions.forEach((p, i) => {
    q.setFromEuler(new THREE.Euler(rand(rng, -0.04, 0.04), rng() * 6.28, rand(rng, -0.04, 0.04)))
    m.compose(p, q, s)
    mesh.setMatrixAt(i, m)
  })
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.instanceMatrix.needsUpdate = true
  return mesh
}

/** 観覧エリアのブルーシート。しわを付けて地面になじませる。 */
export function buildTarps(lib: MaterialLib, rng: Rng, count: number) {
  const group = new THREE.Group()
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < count; i++) {
    const x = rand(rng, -110, 210)
    const z = rand(rng, 124, 149)
    if (wearAmount(x, z) > 0.72) continue
    const w = rand(rng, 1.7, 3.4)
    const d = rand(rng, 1.5, 2.6)
    const rot = rand(rng, -0.35, 0.35)
    const nx = Math.round(w / 0.45)
    const nz = Math.round(d / 0.45)
    const g = new THREE.PlaneGeometry(w, d, nx, nz)
    g.rotateX(-Math.PI / 2)
    const pos = g.getAttribute('position') as THREE.BufferAttribute
    for (let v = 0; v < pos.count; v++) {
      const px = pos.getX(v)
      const pz = pos.getZ(v)
      const wrinkle =
        Math.sin(px * 3.1 + i) * 0.014 + Math.sin(pz * 4.3 - i * 1.7) * 0.012 + rng() * 0.008
      pos.setY(v, wrinkle)
    }
    pos.needsUpdate = true
    g.computeVertexNormals()
    g.rotateY(rot)
    g.translate(x, groundHeight(x, z) + 0.035, z)
    parts.push(g)
  }
  const mesh = new THREE.Mesh(merge(parts), lib.tarp)
  mesh.receiveShadow = true
  group.add(mesh)
  return group
}

/** 本部テント（最後の操作をする場所）。 */
export function buildTent(lib: MaterialLib) {
  const g = new THREE.Group()
  const x = L.hq.x
  const z = L.hq.z
  const y = groundHeight(x, z)
  g.position.set(x, y, z)

  const half = 2.6
  const legH = 2.3
  const steelParts: (THREE.BufferGeometry | null)[] = []
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      steelParts.push(
        strut(V(sx * half, 0, sz * half), V(sx * half, legH, sz * half), 0.09, 0.09, 1.2),
      )
    }
  }
  // 桁
  steelParts.push(strut(V(-half, legH, -half), V(half, legH, -half), 0.08, 0.08, 1.2))
  steelParts.push(strut(V(-half, legH, half), V(half, legH, half), 0.08, 0.08, 1.2))
  steelParts.push(strut(V(-half, legH, -half), V(-half, legH, half), 0.08, 0.08, 1.2))
  steelParts.push(strut(V(half, legH, -half), V(half, legH, half), 0.08, 0.08, 1.2))
  const frame = new THREE.Mesh(merge(steelParts), lib.steel)
  frame.castShadow = true
  g.add(frame)

  // 天幕（寄棟）
  const roof = new THREE.BufferGeometry()
  const apex = legH + 0.95
  const eave = legH + 0.06
  const verts = new Float32Array([
    -half - 0.35, eave, -half - 0.35,
    half + 0.35, eave, -half - 0.35,
    half + 0.35, eave, half + 0.35,
    -half - 0.35, eave, half + 0.35,
    0, apex, 0,
  ])
  roof.setAttribute('position', new THREE.BufferAttribute(verts, 3))
  roof.setIndex([0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4])
  roof.computeVertexNormals()
  const roofMesh = new THREE.Mesh(roof, lib.cloth)
  roofMesh.castShadow = true
  g.add(roofMesh)

  // 長机とコンテナ
  const table = new THREE.Mesh(
    merge([
      box(2.0, 0.05, 0.62, 0, 0.72, 0, 1.2),
      box(0.06, 0.72, 0.06, -0.9, 0.36, -0.25, 1.2),
      box(0.06, 0.72, 0.06, 0.9, 0.36, -0.25, 1.2),
      box(0.06, 0.72, 0.06, -0.9, 0.36, 0.25, 1.2),
      box(0.06, 0.72, 0.06, 0.9, 0.36, 0.25, 1.2),
    ]),
    lib.paintWhite,
  )
  table.position.set(0.2, 0, -1.5)
  table.castShadow = true
  table.receiveShadow = true
  g.add(table)

  const crates = new THREE.Mesh(
    merge([
      box(0.62, 0.4, 0.44, -1.7, 0.2, 1.4, 1.4, 0.2),
      box(0.62, 0.4, 0.44, -1.7, 0.61, 1.4, 1.4, -0.1),
      box(0.55, 0.36, 0.4, 1.8, 0.18, 1.5, 1.4, 0.5),
    ]),
    lib.plasticOrange,
  )
  crates.castShadow = true
  crates.receiveShadow = true
  g.add(crates)

  return g
}

/** 仮設トイレ。 */
export function buildToilets(lib: MaterialLib, rng: Rng) {
  const parts: THREE.BufferGeometry[] = []
  const doors: THREE.BufferGeometry[] = []
  for (let i = 0; i < 4; i++) {
    const x = 150 + i * 1.35
    const z = 199 + rand(rng, -0.25, 0.25)
    const y = groundHeight(x, z)
    parts.push(box(1.2, 2.25, 1.2, x, y + 1.13, z, 0.9, rand(rng, -0.03, 0.03)))
    parts.push(box(1.32, 0.1, 1.32, x, y + 2.28, z, 0.9))
    doors.push(box(0.86, 1.85, 0.06, x, y + 1.0, z - 0.62, 0.9))
  }
  const g = new THREE.Group()
  const body = new THREE.Mesh(merge(parts), lib.paintWhite)
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)
  const d = new THREE.Mesh(merge(doors), lib.paintYellow)
  d.castShadow = true
  g.add(d)
  return g
}

/** ゴミ箱と資材。 */
export function buildClutter(lib: MaterialLib, rng: Rng) {
  const g = new THREE.Group()
  const binParts: THREE.BufferGeometry[] = []
  const spots: [number, number][] = [
    [26, 156],
    [28.4, 156.4],
    [92, 154],
    [94.2, 154.6],
    [-42, 153],
  ]
  for (const [x, z] of spots) {
    const y = groundHeight(x, z)
    binParts.push(box(0.62, 0.92, 0.62, x, y + 0.46, z, 1.1, rand(rng, -0.2, 0.2)))
  }
  const bins = new THREE.Mesh(merge(binParts), lib.steelDark)
  bins.castShadow = true
  bins.receiveShadow = true
  g.add(bins)

  // 単管とバリケード資材の仮置き
  const stack: (THREE.BufferGeometry | null)[] = []
  const bx = 150
  const bz = 186
  const by = groundHeight(bx, bz)
  for (let i = 0; i < 7; i++) {
    const yy = by + 0.06 + Math.floor(i / 3) * 0.11
    const off = (i % 3) * 0.12 - 0.12
    stack.push(
      strut(V(bx - 1.8, yy, bz + off), V(bx + 1.8, yy + rand(rng, -0.01, 0.01), bz + off), 0.05, 0.05, 1.4),
    )
  }
  const pipes = new THREE.Mesh(merge(stack), lib.steel)
  pipes.castShadow = true
  g.add(pipes)
  return g
}

/** 堤防天端の道と、その脇のガードレール。 */
export function buildLeveeRoad(lib: MaterialLib) {
  const g = new THREE.Group()
  const zA = 214.5
  const zB = 241.0
  const road = new THREE.PlaneGeometry(1400, zB - zA, 140, 10)
  road.rotateX(-Math.PI / 2)
  const pos = road.getAttribute('position') as THREE.BufferAttribute
  const uv = road.getAttribute('uv') as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i) + (zA + zB) / 2
    pos.setXYZ(i, x, groundHeight(x, z) + 0.05, z - (zA + zB) / 2)
    uv.setXY(i, x / 5, z / 5)
  }
  pos.needsUpdate = true
  uv.needsUpdate = true
  road.computeVertexNormals()
  road.translate(0, 0, (zA + zB) / 2)
  const rm = new THREE.Mesh(road, lib.asphalt)
  rm.receiveShadow = true
  g.add(rm)

  // ガードレール（川側）
  const parts: (THREE.BufferGeometry | null)[] = []
  for (let x = -300; x <= 320; x += 4) {
    if (Math.abs(x) < 9) continue // 橋の取り付け部はあける
    const z = 213.6
    const y = groundHeight(x, z)
    parts.push(strut(V(x, y, z), V(x, y + 0.78, z), 0.1, 0.1, 1.2))
    const y2 = groundHeight(x + 4, z)
    parts.push(strut(V(x, y + 0.7, z), V(x + 4, y2 + 0.7, z), 0.26, 0.14, 0.9))
  }
  const gr = new THREE.Mesh(merge(parts), lib.paintWhite)
  gr.castShadow = true
  g.add(gr)
  return g
}

/** 電柱と電線。日本の河川敷の風景に効く。 */
export function buildUtilityPoles(lib: MaterialLib, rng: Rng) {
  const g = new THREE.Group()
  const poleParts: (THREE.BufferGeometry | null)[] = []
  const wirePts: number[] = []
  const xs = [-230, -170, -110, -50, 44, 104, 164, 224, 284]
  const z = 231
  let prevTop: THREE.Vector3 | null = null
  for (const x of xs) {
    const y = groundHeight(x, z)
    const h = rand(rng, 9.6, 10.8)
    poleParts.push(strut(V(x, y - 0.4, z), V(x, y + h, z), 0.24, 0.24, 0.7))
    poleParts.push(strut(V(x - 1.1, y + h - 0.9, z), V(x + 1.1, y + h - 0.9, z), 0.11, 0.11, 1))
    poleParts.push(strut(V(x - 0.85, y + h - 1.9, z), V(x + 0.85, y + h - 1.9, z), 0.1, 0.1, 1))
    const top = V(x, y + h - 0.85, z)
    if (prevTop) {
      for (const dy of [0, -1.0]) {
        for (const dx of [-0.85, 0.85]) {
          const a = prevTop.clone().add(V(dx, dy, 0))
          const b = top.clone().add(V(dx, dy, 0))
          const seg = 8
          for (let i = 0; i < seg; i++) {
            const t0 = i / seg
            const t1 = (i + 1) / seg
            const p0 = a.clone().lerp(b, t0)
            const p1 = a.clone().lerp(b, t1)
            p0.y -= Math.sin(t0 * Math.PI) * 1.5
            p1.y -= Math.sin(t1 * Math.PI) * 1.5
            wirePts.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z)
          }
        }
      }
    }
    prevTop = top
  }
  const poles = new THREE.Mesh(merge(poleParts), lib.wood)
  poles.castShadow = true
  g.add(poles)

  const wireGeo = new THREE.BufferGeometry()
  wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wirePts, 3))
  const wires = new THREE.LineSegments(
    wireGeo,
    new THREE.LineBasicMaterial({ color: 0x12161c, transparent: true, opacity: 0.85, fog: true }),
  )
  g.add(wires)
  return g
}

/** ヤナギ・ポプラ。近景は形、遠景はシルエットとして効く。 */
export function buildTrees(lib: MaterialLib, rng: Rng, quality: number) {
  const trunkMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4a3d31'),
    roughness: 1,
    metalness: 0,
  })
  const leafMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffffff'),
    roughness: 1,
    metalness: 0,
    vertexColors: true,
  })

  const trunkGeos: THREE.BufferGeometry[] = []
  const leafGeos: THREE.BufferGeometry[] = []
  const detail = quality > 0.6 ? 1 : 0

  const spots: { p: THREE.Vector3; h: number }[] = []
  // 堤防の法尻に並ぶ木（背は低め）
  for (let x = -240; x <= 320; x += rand(rng, 15, 30)) {
    if (Math.abs(x) < 24) continue
    const z = 201 + rand(rng, -5, 5)
    if (inCameraZone(x, z, 12)) continue
    spots.push({ p: V(x, groundHeight(x, z), z), h: rand(rng, 5.0, 8.2) })
  }
  // 対岸の林（遠景のシルエット）
  for (let x = -460; x <= 500; x += rand(rng, 11, 24)) {
    const z = -150 + rand(rng, -24, 24)
    spots.push({ p: V(x, groundHeight(x, z), z), h: rand(rng, 6.5, 12) })
  }

  const tmp = new THREE.Color()
  for (const { p, h } of spots) {
    const r = h * rand(rng, 0.26, 0.36)
    const tw = h * 0.038
    const t = new THREE.CylinderGeometry(tw * 0.55, tw, h * 0.62, 6, 1)
    t.translate(p.x, p.y + h * 0.31, p.z)
    trunkGeos.push(t)

    const blobs = 7 + Math.floor(rng() * 5)
    const hue = rand(rng, -0.02, 0.03)
    for (let i = 0; i < blobs; i++) {
      const u = i / blobs
      const br = r * rand(rng, 0.3, 0.52) * (1 - u * 0.22)
      const b = new THREE.IcosahedronGeometry(br, detail)
      b.scale(rand(rng, 0.85, 1.2), rand(rng, 0.62, 0.9), rand(rng, 0.85, 1.2))
      b.rotateY(rng() * 3.14)
      const spread = r * 0.62
      b.translate(
        p.x + rand(rng, -spread, spread),
        p.y + h * (0.52 + 0.46 * Math.pow(rng(), 0.7)),
        p.z + rand(rng, -spread, spread),
      )
      // 上のかたまりほど明るい（空からの光）
      tmp.setHSL(0.26 + hue, rand(rng, 0.26, 0.4), rand(rng, 0.09, 0.2))
      const cnt = b.getAttribute('position').count
      const col = new Float32Array(cnt * 3)
      for (let v = 0; v < cnt; v++) {
        col[v * 3] = tmp.r
        col[v * 3 + 1] = tmp.g
        col[v * 3 + 2] = tmp.b
      }
      b.setAttribute('color', new THREE.BufferAttribute(col, 3))
      leafGeos.push(b)
    }
  }

  const g = new THREE.Group()
  const tm = new THREE.Mesh(merge(trunkGeos), trunkMat)
  tm.castShadow = true
  g.add(tm)
  const lm = new THREE.Mesh(merge(leafGeos), leafMat)
  lm.castShadow = true
  lm.receiveShadow = true
  g.add(lm)
  void lib
  return g
}

/** 会場のこまごまを一括で組む。 */
export function buildProps(lib: MaterialLib, quality: number) {
  const g = new THREE.Group()
  g.name = 'props'
  const rng = makeRng(19960802)

  g.add(buildLeveeRoad(lib))

  // 水際の簡易柵（法肩に沿って）
  const fencePts: THREE.Vector3[] = []
  for (let x = -210; x <= 280; x += 14) {
    const z = 119 + Math.sin(x * 0.021) * 2.2
    fencePts.push(V(x, 0, z))
  }
  g.add(buildRopeFence(fencePts, lib, rng, 0.95, 3.4))

  // 遊歩道ぎわの短い柵（本部まわり）
  const hqFence: THREE.Vector3[] = [
    V(L.hq.x - 9, 0, L.hq.z - 7),
    V(L.hq.x + 8, 0, L.hq.z - 7),
    V(L.hq.x + 8, 0, L.hq.z + 6),
  ]
  g.add(buildRopeFence(hqFence, lib, rng, 0.85, 2.8))

  // コーン
  const conePos: THREE.Vector3[] = []
  for (let i = 0; i < 9; i++) {
    const x = lerp(-5.4, 5.4, i / 8)
    const z = L.bridge.gateZ - 6
    conePos.push(V(x, deckY(z), z))
  }
  for (let i = 0; i < 10; i++) {
    const x = rand(rng, -60, 190)
    const z = L.path.z + rand(rng, -4.5, 4.5)
    conePos.push(V(x, groundHeight(x, z), z))
  }
  g.add(buildCones(conePos, lib, rng))

  g.add(buildTarps(lib, rng, quality > 0.6 ? 34 : 20))
  g.add(buildTent(lib))
  g.add(buildToilets(lib, rng))
  g.add(buildClutter(lib, rng))
  g.add(buildUtilityPoles(lib, rng))
  g.add(buildTrees(lib, rng, quality))

  return g
}
