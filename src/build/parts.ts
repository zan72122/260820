/** 滑り台の各部材。板厚・リブ・接合フランジを持たせ、玩具にしない。 */
import * as THREE from 'three'
import type { Palette } from '../world/materials'
import type { QualitySettings } from '../core/env'
import { CHUTE_VARIANTS, ROLLER_START_S, SITE, chuteCenter, type ChuteVariant, type PartId } from './layout'
import { bentTube, chamferBox, channelSection, hexNut, mergeInto, plateWithHoles, sweepClosedProfile, washer, type SweepFrame } from './geometry'

const DECK_UNDER = SITE.deckTop - SITE.deckSlab - SITE.frameH

export interface ChuteSample {
  s: number
  pos: THREE.Vector3
  tangent: THREE.Vector3
  up: THREE.Vector3
}

/** 滑走面中心線のサンプリング（部材ローカル座標） */
export function chuteSamples(variant: ChuteVariant, segments: number): ChuteSample[] {
  const out: ChuteSample[] = []
  const eps = 1 / (segments * 4)
  for (let i = 0; i <= segments; i++) {
    const s = i / segments
    const c = chuteCenter(s, variant)
    const a = chuteCenter(Math.max(0, s - eps), variant)
    const b = chuteCenter(Math.min(1, s + eps), variant)
    const tangent = new THREE.Vector3(0, b.y - a.y, b.z - a.z).normalize()
    const up = new THREE.Vector3(1, 0, 0).cross(tangent).normalize()
    out.push({ s, pos: new THREE.Vector3(0, c.y, c.z), tangent, up })
  }
  return out
}

function framesFrom(samples: ChuteSample[]): SweepFrame[] {
  return samples.map((s) => ({ position: s.pos, tangent: s.tangent }))
}

const W = SITE.chuteHalfWidth
const T = SITE.chuteThick
const H = SITE.chuteWall
const F = 0.05

/** 成形パン断面：床板・側壁・接続フランジ・補強リブ */
const PAN_PROFILE: Array<[number, number]> = [
  [-(W + T + F), H - 0.02],
  [-(W + T + F), H - 0.038],
  [-(W + T), H - 0.038],
  [-(W + T), 0],
  [-0.14, 0],
  [-0.14, -0.035],
  [-0.1, -0.035],
  [-0.1, 0],
  [0.1, 0],
  [0.1, -0.035],
  [0.14, -0.035],
  [0.14, 0],
  [W + T, 0],
  [W + T, H - 0.038],
  [W + T + F, H - 0.038],
  [W + T + F, H - 0.02],
  [W, H - 0.02],
  [W, T],
  [-W, T],
  [-W, H - 0.02],
]

/** ローラー区間の側枠断面（床板なし） */
function railProfile(sign: 1 | -1): Array<[number, number]> {
  const p: Array<[number, number]> = [
    [-(W + T + F), H - 0.02],
    [-(W + T + F), H - 0.038],
    [-(W + T), H - 0.038],
    [-(W + T), -0.045],
    [-W, -0.045],
    [-W, H - 0.02],
  ]
  return sign === -1 ? p : p.map(([x, y]) => [-x, y] as [number, number]).reverse()
}

function anchorBolt(parent: THREE.Object3D, pal: Palette, x: number, z: number, baseY: number, projection: number, withNut: boolean) {
  const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.008, projection, 10), pal.boltSteel)
  shank.position.set(x, baseY + projection / 2, z)
  shank.castShadow = true
  parent.add(shank)
  if (withNut) {
    const w = new THREE.Mesh(washer(0.034, 0.019, 0.004), pal.boltSteel)
    w.position.set(x, baseY, z)
    parent.add(w)
    const n = new THREE.Mesh(hexNut(0.026, 0.013), pal.boltSteel)
    n.position.set(x, baseY + 0.004, z)
    n.castShadow = true
    parent.add(n)
  }
}

/** 支持柱：ベースプレート＋ガセット＋鋼管＋天板＋ピン耳＋吊り金具 */
export function buildColumn(pal: Palette, q: QualitySettings): THREE.Group {
  const g = new THREE.Group()
  const seg = q.tier === 'low' ? 12 : 20
  const bp = SITE.basePlate
  const plate = plateWithHoles(bp.w, bp.d, bp.t, [
    { x: -bp.boltDx, z: -bp.boltDx, r: bp.holeR },
    { x: bp.boltDx, z: -bp.boltDx, r: bp.holeR },
    { x: -bp.boltDx, z: bp.boltDx, r: bp.holeR },
    { x: bp.boltDx, z: bp.boltDx, r: bp.holeR },
  ])
  const plateMesh = mergeInto(g, plate, pal.galvanizedDull)
  plateMesh.position.y = 0

  const tubeLen = 1.512
  const tube = new THREE.CylinderGeometry(SITE.colTubeR, SITE.colTubeR, tubeLen, seg, 1, false)
  tube.translate(0, bp.t + tubeLen / 2, 0)
  mergeInto(g, tube, pal.galvanized)

  // 溶接ガセット（4枚）
  const gs = new THREE.Shape()
  gs.moveTo(0, 0)
  gs.lineTo(0.095, 0)
  gs.lineTo(0, 0.17)
  gs.closePath()
  const gus = new THREE.ExtrudeGeometry(gs, { depth: 0.008, bevelEnabled: false, curveSegments: 1 })
  gus.translate(0, 0, -0.004)
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(gus, pal.galvanizedDull)
    m.rotation.y = (i * Math.PI) / 2
    m.position.set(0, bp.t, 0)
    m.translateX(SITE.colTubeR * 0.85)
    m.castShadow = true
    g.add(m)
  }

  const topY = bp.t + tubeLen
  const cap = mergeInto(g, chamferBox(0.2, 0.012, 0.2, 0.004), pal.galvanizedDull)
  cap.position.y = topY + 0.006

  // ピン耳（プラットフォーム側のブラケットを挟む）
  const earShape = plateWithHoles(0.01, 0.17, 0.17, [])
  earShape.rotateZ(Math.PI / 2)
  for (const sx of [-0.055, 0.055]) {
    const ear = new THREE.Mesh(
      (() => {
        const s = new THREE.Shape()
        s.moveTo(-0.085, 0)
        s.lineTo(0.085, 0)
        s.lineTo(0.085, 0.13)
        s.absarc(0, 0.13, 0.085, 0, Math.PI, false)
        s.lineTo(-0.085, 0)
        const hole = new THREE.Path()
        hole.absarc(0, 0.13, 0.014, 0, Math.PI * 2, true)
        s.holes.push(hole)
        const eg = new THREE.ExtrudeGeometry(s, { depth: 0.01, bevelEnabled: false, curveSegments: 10 })
        eg.rotateY(Math.PI / 2)
        return eg
      })(),
      pal.galvanizedDull,
    )
    ear.position.set(sx, topY + 0.012, 0)
    ear.castShadow = true
    g.add(ear)
  }
  earShape.dispose()

  // 吊り金具（重心の上に来る位置）
  const lugShape = new THREE.Shape()
  lugShape.moveTo(-0.05, 0)
  lugShape.lineTo(0.05, 0)
  lugShape.lineTo(0.05, 0.07)
  lugShape.absarc(0, 0.07, 0.05, 0, Math.PI, false)
  lugShape.lineTo(-0.05, 0)
  const lugHole = new THREE.Path()
  lugHole.absarc(0, 0.07, 0.02, 0, Math.PI * 2, true)
  lugShape.holes.push(lugHole)
  const lug = new THREE.Mesh(
    new THREE.ExtrudeGeometry(lugShape, { depth: 0.012, bevelEnabled: false, curveSegments: 10 }),
    pal.galvanizedDull,
  )
  lug.position.set(-0.006, topY + 0.012, 0)
  lug.rotation.y = Math.PI / 2
  lug.castShadow = true
  g.add(lug)

  g.userData.height = topY + 0.012
  return g
}

/** 踊り場：厚みのあるデッキ＋下部フレーム＋柱接合ブラケット＋滑走面受けフランジ */
export function buildPlatform(pal: Palette, _q: QualitySettings): THREE.Group {
  const g = new THREE.Group()
  const fh = SITE.frameH
  // 主桁（X方向）
  for (const z of [-0.42, 0.42]) {
    const geo = channelSection(SITE.deckW, fh, 0.05, 0.005)
    geo.rotateY(Math.PI / 2)
    const m = mergeInto(g, geo, pal.frame)
    m.position.set(0, fh / 2, z)
  }
  // 小梁（Z方向）
  for (const x of [-0.5, 0, 0.5]) {
    const geo = channelSection(0.84, fh * 0.8, 0.04, 0.004)
    const m = mergeInto(g, geo, pal.frame)
    m.position.set(x, fh / 2, 0)
  }
  // デッキ板（縁に立ち上がりを付ける）
  const slab = mergeInto(g, chamferBox(SITE.deckW, SITE.deckSlab, SITE.deckD, 0.005), pal.deck)
  slab.position.y = fh + SITE.deckSlab / 2
  for (const [w, d, x, z] of [
    [SITE.deckW, 0.03, 0, SITE.deckD / 2 - 0.015],
    [0.03, SITE.deckD, -SITE.deckW / 2 + 0.015, 0],
    [0.03, SITE.deckD, SITE.deckW / 2 - 0.015, 0],
  ] as Array<[number, number, number, number]>) {
    const lip = mergeInto(g, chamferBox(w, 0.03, d, 0.004), pal.deck)
    lip.position.set(x, fh + SITE.deckSlab + 0.015, z)
  }
  // 柱との接合ブラケット（ピンが通る）
  for (const x of [-SITE.colX, SITE.colX]) {
    const s = new THREE.Shape()
    s.moveTo(-0.085, 0)
    s.lineTo(0.085, 0)
    s.lineTo(0.085, 0.075)
    s.lineTo(-0.085, 0.075)
    s.closePath()
    const hole = new THREE.Path()
    hole.absarc(0, 0.03, 0.014, 0, Math.PI * 2, true)
    s.holes.push(hole)
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false, curveSegments: 10 })
    geo.rotateY(Math.PI / 2)
    const m = mergeInto(g, geo, pal.galvanizedDull)
    m.position.set(x + 0.006, 0, SITE.colZ)
  }
  // 滑走面受けフランジ（前縁）：ここに大きなボルトを締める
  const seat = mergeInto(g, chamferBox(1.0, 0.016, 0.12, 0.003), pal.galvanizedDull)
  seat.position.set(0, 0.086, -0.45)
  for (const x of [-0.36, 0.36]) {
    const boss = mergeInto(g, new THREE.CylinderGeometry(0.032, 0.032, 0.022, 10), pal.galvanizedDull)
    boss.position.set(x, 0.094, -0.47)
  }
  // 前縁の落下防止バー（滑り出し口の左右）
  for (const x of [-0.4, 0.4]) {
    const bar = mergeInto(
      g,
      bentTube(
        [new THREE.Vector3(x, fh + 0.05, -0.48), new THREE.Vector3(x, fh + 0.5, -0.5), new THREE.Vector3(x, fh + 0.55, -0.3)],
        0.016,
        8,
      ),
      pal.rail,
    )
    bar.castShadow = true
  }
  g.userData.height = fh + SITE.deckSlab
  return g
}

/** 階段：ストリンガー＋踏板＋上部フックブラケット＋脚部ベースプレート */
export function buildStair(pal: Palette, _q: QualitySettings): THREE.Group {
  const g = new THREE.Group()
  const rise = SITE.deckTop - 0.02
  const run = SITE.stairBaseZ - SITE.stairTopZ
  const len = Math.hypot(rise, run)
  const angle = Math.atan2(rise, run)
  for (const x of [-0.32, 0.32]) {
    const geo = channelSection(len, 0.16, 0.045, 0.005)
    geo.rotateY(Math.PI / 2)
    const m = mergeInto(g, geo, pal.frame)
    m.position.set(x, rise / 2, -run / 2)
    m.rotation.x = -angle + Math.PI / 2
    m.rotation.order = 'YXZ'
    m.rotation.set(0, 0, 0)
    m.quaternion.setFromEuler(new THREE.Euler(angle - Math.PI / 2, 0, 0))
  }
  const steps = 6
  for (let i = 1; i <= steps - 1; i++) {
    const f = i / steps
    const tread = mergeInto(g, chamferBox(0.68, 0.028, 0.24, 0.003), pal.galvanized)
    tread.position.set(0, rise * f - 0.014, -run * f + 0.09)
    // 蹴込み板
    const riser = mergeInto(g, chamferBox(0.66, 0.13, 0.014, 0.002), pal.frame)
    riser.position.set(0, rise * f - 0.07, -run * f - 0.03)
  }
  // 脚部ベースプレート＋アンカー
  for (const x of [-0.32, 0.32]) {
    const p = mergeInto(g, plateWithHoles(0.16, 0.16, 0.012, [{ x: 0, z: 0, r: 0.011 }]), pal.galvanizedDull)
    p.position.set(x, 0, -0.02)
  }
  // 上部フックブラケット（デッキ後桁に掛かる）
  for (const x of [-0.32, 0.32]) {
    const hook = mergeInto(g, chamferBox(0.05, 0.16, 0.09, 0.004), pal.galvanizedDull)
    hook.position.set(x, rise - 0.06, -run - 0.03)
  }
  // 階段側の手すり（ストリンガーへ構造的に取り付く）
  const rakeAt = (f: number) => ({ y: rise * f, z: -run * f })
  for (const x of [-0.44, 0.44]) {
    const pts = [0.02, 0.35, 0.7, 0.88].map((f) => {
      const r = rakeAt(f)
      return new THREE.Vector3(x, r.y + 0.72, r.z)
    })
    mergeInto(g, bentTube(pts, 0.018, 8), pal.rail)
    for (const f of [0.05, 0.86]) {
      const r = rakeAt(f)
      const p = mergeInto(g, new THREE.CylinderGeometry(0.016, 0.016, 0.72, 8), pal.rail)
      p.position.set(x, r.y + 0.36, r.z)
      const fl = mergeInto(g, chamferBox(0.09, 0.008, 0.09, 0.002), pal.galvanizedDull)
      fl.position.set(x, r.y + 0.004, r.z)
    }
  }
  g.userData.height = rise
  return g
}

/** 一体成形の長い滑走面。中間支持と出口フットを一体で持つ。 */
export function buildChute(pal: Palette, q: QualitySettings, variant: ChuteVariant): THREE.Group {
  const g = new THREE.Group()
  const segments = q.tier === 'low' ? 44 : q.tier === 'medium' ? 68 : 96
  const all = chuteSamples(variant, segments)

  if (variant === 'roller') {
    const cut = Math.max(2, Math.round(ROLLER_START_S * segments))
    const panFrames = framesFrom(all.slice(0, cut + 1))
    mergeInto(g, sweepClosedProfile(PAN_PROFILE, panFrames), pal.chute)
    const railFrames = framesFrom(all.slice(cut))
    mergeInto(g, sweepClosedProfile(railProfile(-1), railFrames), pal.chuteBack)
    mergeInto(g, sweepClosedProfile(railProfile(1), railFrames), pal.chuteBack)
    // ローラー
    const rollerGeo = new THREE.CylinderGeometry(0.028, 0.028, W * 2, q.tier === 'low' ? 8 : 12)
    rollerGeo.rotateZ(Math.PI / 2)
    const picks: ChuteSample[] = []
    let acc = 0
    for (let i = cut; i < all.length - 1; i++) {
      acc += all[i].pos.distanceTo(all[i + 1].pos)
      if (acc >= 0.076) {
        picks.push(all[i])
        acc = 0
      }
    }
    const inst = new THREE.InstancedMesh(rollerGeo, pal.boltSteel, picks.length)
    inst.castShadow = true
    inst.receiveShadow = true
    const m = new THREE.Matrix4()
    const q4 = new THREE.Quaternion()
    picks.forEach((p, i) => {
      const pos = p.pos.clone().addScaledVector(p.up, -0.006)
      q4.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.up)
      m.compose(pos, q4, new THREE.Vector3(1, 1, 1))
      inst.setMatrixAt(i, m)
    })
    inst.instanceMatrix.needsUpdate = true
    g.add(inst)
  } else {
    mergeInto(g, sweepClosedProfile(PAN_PROFILE, framesFrom(all)), pal.chute)
  }

  // 横リブ（自重でたわまないための補強）
  const ribGeo = chamferBox(0.44, 0.055, 0.022, 0.003)
  const ribCount = q.tier === 'low' ? 6 : 10
  for (let i = 1; i <= ribCount; i++) {
    const s = (i / (ribCount + 1)) * (variant === 'roller' ? ROLLER_START_S : 1)
    const idx = Math.round(s * segments)
    const smp = all[Math.min(all.length - 1, idx)]
    const rib = new THREE.Mesh(ribGeo, pal.chuteBack)
    rib.position.copy(smp.pos).addScaledVector(smp.up, -0.055)
    rib.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), smp.up)
    rib.castShadow = true
    g.add(rib)
  }

  // 上端の接続フランジ（デッキ前縁へボルト留め）
  // 接続フランジのボルトは側壁より外側に出す（上から見て見えるように）
  const flange = mergeInto(g, plateWithHoles(0.94, 0.13, 0.016, [
    { x: -0.36, z: 0, r: 0.016 },
    { x: 0.36, z: 0, r: 0.016 },
  ]), pal.galvanizedDull)
  flange.position.set(0, -0.078, 0.02)

  // 中間支持（1本柱＋ベースプレート）
  const midS = SITE.chuteMidS
  const midC = chuteCenter(midS, variant)
  const midTop = midC.y - 0.06
  const midBase = SITE.midPadTop - SITE.chuteTop.y
  const postLen = midTop - midBase
  const post = mergeInto(g, new THREE.CylinderGeometry(0.042, 0.042, postLen, q.tier === 'low' ? 8 : 14), pal.galvanized)
  post.position.set(0, midBase + postLen / 2, midC.z)
  const midPlate = mergeInto(g, plateWithHoles(0.2, 0.2, 0.012, [
    { x: -0.09, z: 0, r: 0.011 },
    { x: 0.09, z: 0, r: 0.011 },
  ]), pal.galvanizedDull)
  midPlate.position.set(0, midBase, midC.z)
  const midCollar = mergeInto(g, chamferBox(0.34, 0.02, 0.08, 0.003), pal.galvanizedDull)
  midCollar.position.set(0, midTop, midC.z)

  // 出口フット
  const endC = chuteCenter(1, variant)
  const footBase = SITE.exitPadTop - SITE.chuteTop.y
  for (const x of [-0.26, 0.26]) {
    const legLen = endC.y - 0.05 - footBase
    const leg = mergeInto(g, new THREE.CylinderGeometry(0.03, 0.03, legLen, 10), pal.galvanized)
    leg.position.set(x, footBase + legLen / 2, endC.z + 0.05)
  }
  const footPlate = mergeInto(g, plateWithHoles(0.78, 0.32, 0.014, [
    { x: -0.22, z: 0, r: 0.014 },
    { x: 0.22, z: 0, r: 0.014 },
  ]), pal.galvanizedDull)
  footPlate.position.set(0, footBase, endC.z + 0.05)

  g.userData.variant = variant
  return g
}

/** 手すり（踊り場のガード）。階段側の手すりと突き合わさり、宙に浮かない。 */
export function buildHandrail(pal: Palette, side: -1 | 1, _q: THREE.Object3D | QualitySettings): THREE.Group {
  void _q
  const g = new THREE.Group()
  const top = SITE.deckTop + 0.75
  const pts = [
    new THREE.Vector3(0, 2.26, 0.75),
    new THREE.Vector3(0, top - 0.05, 0.3),
    new THREE.Vector3(0, top, -0.1),
    new THREE.Vector3(0, top, -0.34),
    new THREE.Vector3(0, SITE.deckTop + 0.4, -0.5),
  ]
  mergeInto(g, bentTube(pts, 0.019, 10), pal.rail)
  for (const [z, y1] of [
    [0.3, top - 0.05],
    [-0.34, top],
  ] as Array<[number, number]>) {
    const h = y1 - SITE.deckTop
    const p = mergeInto(g, new THREE.CylinderGeometry(0.017, 0.017, h, 8), pal.rail)
    p.position.set(0, SITE.deckTop + h / 2, z)
    const fl = mergeInto(g, plateWithHoles(0.09, 0.09, 0.008, [
      { x: -0.028, z: 0, r: 0.006 },
      { x: 0.028, z: 0, r: 0.006 },
    ]), pal.galvanizedDull)
    fl.position.set(0, SITE.deckTop, z)
  }
  g.scale.x = side
  return g
}

export function buildTestBall(pal: Palette): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 14), pal.ball)
  m.castShadow = true
  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.116, 0.006, 6, 24), pal.rubber)
  seam.rotation.x = Math.PI / 2
  m.add(seam)
  return m
}

/** 基礎（コンクリート＋アンカーボルト）。地面へ柱が刺さって見えないようにする。 */
export function buildFoundation(
  pal: Palette,
  spec: { x: number; z: number; w: number; d: number; top: number; anchors: number; spread: number },
): THREE.Group {
  const g = new THREE.Group()
  const depth = 0.34
  const pad = mergeInto(g, chamferBox(spec.w, depth, spec.d, 0.014), pal.concrete)
  pad.position.set(spec.x, spec.top - depth / 2, spec.z)
  const positions: Array<[number, number]> =
    spec.anchors === 4
      ? [
          [-spec.spread, -spec.spread],
          [spec.spread, -spec.spread],
          [-spec.spread, spec.spread],
          [spec.spread, spec.spread],
        ]
      : [
          [-spec.spread, 0],
          [spec.spread, 0],
        ]
  for (const [dx, dz] of positions) {
    anchorBolt(g, pal, spec.x + dx, spec.z + dz, spec.top, SITE.anchorProjection, false)
  }
  g.userData.anchorPositions = positions.map(([dx, dz]) => new THREE.Vector3(spec.x + dx, spec.top, spec.z + dz))
  return g
}

export function buildPart(id: PartId, pal: Palette, q: QualitySettings, variant: ChuteVariant): THREE.Group {
  switch (id) {
    case 'columnA':
    case 'columnB':
      return buildColumn(pal, q)
    case 'platform':
      return buildPlatform(pal, q)
    case 'stair':
      return buildStair(pal, q)
    case 'chute':
      return buildChute(pal, q, variant)
    case 'handrailL':
      return buildHandrail(pal, -1, q)
    case 'handrailR':
      return buildHandrail(pal, 1, q)
  }
}

export const CHUTE_VARIANT_IDS = CHUTE_VARIANTS.map((v) => v.id)
export { DECK_UNDER }
