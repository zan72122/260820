import { Group, Mesh, PlaneGeometry, PointLight } from 'three'
import type { Rng } from '../../core/rng'
import type { MatKit } from '../../materials/matkit'
import {
  EAVE_WALL_H,
  ENGAWA_EAST_X,
  ENGAWA_FLOOR_H,
  ENGAWA_WEST_X,
  HOUSE_EAST_X,
  HOUSE_WALL_Z,
  HOUSE_WEST_X,
  KEN,
  PILLAR_SQ,
  SHOJI_H,
  SHOJI_KUMIKO_PITCH,
  SHOJI_W,
  WAINSCOT_H,
} from '../../scene/layout'
import { chamferBox, mergeParts, moveGeo, offsetUvs, setVertexColor, tintJitter } from '../util/geo'

/**
 * 家の南面（庭に面するファサード）。真壁造: 柱が見え、壁はその間に
 * 引っ込む。縁側の2間は障子の開口、他は腰板＋漆喰。
 *
 * 実寸: 柱105角＠1間、腰板高800、障子 910×1757（組子ピッチ≒210）、
 * 敷居・鴨居60。障子紙の奥に夕餉の灯り＝画面で唯一の「動機のある発光」。
 */
export function buildFacade(kit: MatKit, rng: Rng): Group {
  const group = new Group()
  group.name = 'facade'
  const wallZ = HOUSE_WALL_Z
  const recess = 0.03 // 壁面は柱面から30mm引っ込む

  // --- 柱 -----------------------------------------------------------------
  // 起伏する地面（±3cm）に対して基部を 8cm 埋める: 実際は土台・布基礎に
  // 載るが、露出部が浮かないことをジオメトリで保証する。
  const bury = 0.08
  const pillarParts = []
  for (let x = HOUSE_WEST_X; x <= HOUSE_EAST_X + 0.001; x += KEN) {
    const geo = chamferBox(PILLAR_SQ, EAVE_WALL_H + bury, PILLAR_SQ, 0.003)
    offsetUvs(geo, rng() * 2, rng() * 2)
    setVertexColor(geo, tintJitter(rng, '#6f5e4b', 0.05))
    moveGeo(geo, x, (EAVE_WALL_H + bury) / 2 - bury, wallZ)
    pillarParts.push(geo)
  }
  const pillars = new Mesh(mergeParts(pillarParts), kit.woodDark)
  pillars.castShadow = true
  pillars.receiveShadow = true
  group.add(pillars)

  // --- 壁セクション（障子開口以外）: 腰板＋漆喰 ---------------------------
  const wainscotParts = []
  const plasterParts = []
  for (let x = HOUSE_WEST_X; x < HOUSE_EAST_X - 0.001; x += KEN) {
    const x0 = x
    const x1 = x + KEN
    const cx = (x0 + x1) / 2
    const w = KEN - PILLAR_SQ
    const isShojiBay = x0 >= ENGAWA_WEST_X - 0.001 && x1 <= ENGAWA_EAST_X + 0.001
    if (isShojiBay) continue
    const wainscot = chamferBox(w, WAINSCOT_H + bury, 0.02, 0.002)
    offsetUvs(wainscot, rng() * 2, rng() * 2)
    setVertexColor(wainscot, tintJitter(rng, '#5f4f3d', 0.05))
    moveGeo(wainscot, cx, (WAINSCOT_H + bury) / 2 - bury, wallZ - recess)
    wainscotParts.push(wainscot)

    const plasterH = EAVE_WALL_H - WAINSCOT_H
    const plaster = new PlaneGeometry(w, plasterH)
    // 漆喰はメートルUV（正面平面なので位置ベース）
    {
      const uv = plaster.getAttribute('uv')
      const pos = plaster.getAttribute('position')
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, pos.getX(i) + cx, pos.getY(i))
      }
    }
    setVertexColor(plaster, tintJitter(rng, '#f2ecdd', 0.02))
    moveGeo(plaster, cx, WAINSCOT_H + plasterH / 2, wallZ - recess)
    plasterParts.push(plaster)
  }
  if (wainscotParts.length > 0) {
    const wainscots = new Mesh(mergeParts(wainscotParts), kit.woodDark)
    wainscots.receiveShadow = true
    group.add(wainscots)
    const plasters = new Mesh(mergeParts(plasterParts), kit.plaster)
    plasters.receiveShadow = true
    group.add(plasters)
  }

  // --- 障子の2間（縁側の奥） ----------------------------------------------
  const railParts = []
  const shikii = chamferBox(ENGAWA_EAST_X - ENGAWA_WEST_X, 0.06, 0.09, 0.002)
  setVertexColor(shikii, tintJitter(rng, '#6f5e4b', 0.03))
  offsetUvs(shikii, rng(), rng())
  moveGeo(
    shikii,
    (ENGAWA_WEST_X + ENGAWA_EAST_X) / 2,
    ENGAWA_FLOOR_H + 0.03,
    wallZ - recess,
  )
  railParts.push(shikii)
  const kamoi = chamferBox(ENGAWA_EAST_X - ENGAWA_WEST_X, 0.06, 0.09, 0.002)
  setVertexColor(kamoi, tintJitter(rng, '#6f5e4b', 0.03))
  offsetUvs(kamoi, rng(), rng())
  moveGeo(
    kamoi,
    (ENGAWA_WEST_X + ENGAWA_EAST_X) / 2,
    ENGAWA_FLOOR_H + 0.06 + SHOJI_H + 0.03,
    wallZ - recess,
  )
  railParts.push(kamoi)
  const rails = new Mesh(mergeParts(railParts), kit.woodDark)
  rails.castShadow = true
  rails.receiveShadow = true
  group.add(rails)

  // 鴨居上の小壁（漆喰）
  const kabeH = EAVE_WALL_H - (ENGAWA_FLOOR_H + 0.06 + SHOJI_H + 0.06)
  if (kabeH > 0.01) {
    const kabe = new PlaneGeometry(ENGAWA_EAST_X - ENGAWA_WEST_X, kabeH)
    const uv = kabe.getAttribute('uv')
    const pos = kabe.getAttribute('position')
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getY(i))
    setVertexColor(kabe, tintJitter(rng, '#f2ecdd', 0.02))
    moveGeo(
      kabe,
      (ENGAWA_WEST_X + ENGAWA_EAST_X) / 2,
      EAVE_WALL_H - kabeH / 2,
      wallZ - recess,
    )
    const kabeMesh = new Mesh(kabe, kit.plaster)
    kabeMesh.receiveShadow = true
    group.add(kabeMesh)
  }

  // 障子4枚（各910幅）: 組子（庭側）＋紙（奥、内の灯りで仄かに光る）
  const shojiBottom = ENGAWA_FLOOR_H + 0.06
  const kumikoParts = []
  for (let p = 0; p < 4; p++) {
    const cx = ENGAWA_WEST_X + SHOJI_W * (p + 0.5)
    const frameT = 0.025
    const kW = 0.03 // 框の見付け
    // 外周框
    const partsOfPanel = [
      // 縦框 左右
      moveGeo(chamferBox(kW, SHOJI_H, frameT, 0.002), cx - SHOJI_W / 2 + kW / 2, shojiBottom + SHOJI_H / 2, 0),
      moveGeo(chamferBox(kW, SHOJI_H, frameT, 0.002), cx + SHOJI_W / 2 - kW / 2, shojiBottom + SHOJI_H / 2, 0),
      // 上下框
      moveGeo(chamferBox(SHOJI_W - kW * 2, kW * 1.5, frameT, 0.002), cx, shojiBottom + kW * 0.75, 0),
      moveGeo(chamferBox(SHOJI_W - kW * 2, kW * 1.5, frameT, 0.002), cx, shojiBottom + SHOJI_H - kW * 0.75, 0),
    ]
    // 組子: 縦（ピッチ≒210）と横（荒組: 3分割）
    const innerW = SHOJI_W - kW * 2
    const innerH = SHOJI_H - kW * 3
    const nV = Math.round(innerW / SHOJI_KUMIKO_PITCH) - 1
    for (let i = 1; i <= nV; i++) {
      const gx = cx - innerW / 2 + (innerW / (nV + 1)) * i
      partsOfPanel.push(
        moveGeo(chamferBox(0.012, innerH, 0.006, 0.001), gx, shojiBottom + kW * 1.5 + innerH / 2, 0.004),
      )
    }
    const nH = 3
    for (let i = 1; i <= nH; i++) {
      const gy = shojiBottom + kW * 1.5 + (innerH / (nH + 1)) * i
      partsOfPanel.push(
        moveGeo(chamferBox(innerW, 0.012, 0.006, 0.001), cx, gy, 0.004),
      )
    }
    for (const g of partsOfPanel) {
      setVertexColor(g, tintJitter(rng, '#7a6a55', 0.02))
      offsetUvs(g, rng(), rng())
      moveGeo(g, 0, 0, wallZ - recess + 0.02)
      kumikoParts.push(g)
    }
  }
  const kumiko = new Mesh(mergeParts(kumikoParts), kit.woodDark)
  kumiko.castShadow = true
  group.add(kumiko)

  // 紙: 4枚まとめて1枚の面（張り分け目地は組子が語る）
  const paper = new PlaneGeometry(SHOJI_W * 4, SHOJI_H)
  {
    const uv = paper.getAttribute('uv')
    const pos = paper.getAttribute('position')
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getY(i))
  }
  moveGeo(
    paper,
    (ENGAWA_WEST_X + ENGAWA_EAST_X) / 2,
    shojiBottom + SHOJI_H / 2,
    wallZ - recess + 0.008,
  )
  const paperMesh = new Mesh(paper, kit.paperShoji)
  group.add(paperMesh)

  // 部屋の行灯の灯り: 画面で唯一の人工光。障子紙越しに縁側の板へ
  // 暖色の溜まりを落とす（「誰かが家に居る夕暮れ」という動機）。
  const lamp = new PointLight('#ffc890', 3.2, 4.2, 2)
  lamp.position.set(
    (ENGAWA_WEST_X + ENGAWA_EAST_X) / 2,
    0.95,
    wallZ - recess + 0.2,
  )
  group.add(lamp)

  // --- 東側の格子窓（台所の窓＝生活の根拠） -------------------------------
  const winCx = ENGAWA_EAST_X + KEN / 2 + PILLAR_SQ / 2
  const winW = 0.9
  const winH = 0.75
  const winBottom = 1.15
  const dark = new PlaneGeometry(winW, winH)
  moveGeo(dark, winCx, winBottom + winH / 2, wallZ - recess - 0.05)
  const darkMesh = new Mesh(dark, kit.shadowWood)
  group.add(darkMesh)
  const barParts = []
  const nBars = Math.floor(winW / 0.09)
  for (let i = 0; i <= nBars; i++) {
    const bx = winCx - winW / 2 + (winW / nBars) * i
    const bar = chamferBox(0.03, winH, 0.03, 0.002)
    setVertexColor(bar, tintJitter(rng, '#4f4234', 0.04))
    offsetUvs(bar, rng(), rng())
    moveGeo(bar, bx, winBottom + winH / 2, wallZ - recess + 0.02)
    barParts.push(bar)
  }
  const winFrameTop = chamferBox(winW + 0.12, 0.05, 0.05, 0.002)
  setVertexColor(winFrameTop, tintJitter(rng, '#4f4234', 0.03))
  offsetUvs(winFrameTop, rng(), rng())
  moveGeo(winFrameTop, winCx, winBottom + winH + 0.025, wallZ - recess + 0.02)
  barParts.push(winFrameTop)
  const winFrameBot = chamferBox(winW + 0.12, 0.05, 0.05, 0.002)
  setVertexColor(winFrameBot, tintJitter(rng, '#4f4234', 0.03))
  offsetUvs(winFrameBot, rng(), rng())
  moveGeo(winFrameBot, winCx, winBottom - 0.025, wallZ - recess + 0.02)
  barParts.push(winFrameBot)
  const window = new Mesh(mergeParts(barParts), kit.woodDark)
  window.castShadow = true
  window.receiveShadow = true
  group.add(window)

  return group
}
