import { Color, Group, Mesh } from 'three'
import type { Rng } from '../../core/rng'
import type { MatKit } from '../../materials/matkit'
import {
  ENGAWA_BOARD_GAP,
  ENGAWA_BOARD_T,
  ENGAWA_BOARD_W,
  ENGAWA_DEPTH,
  ENGAWA_EAST_X,
  ENGAWA_FLOOR_H,
  ENGAWA_FRONT_Z,
  ENGAWA_KAMACHI_SQ,
  ENGAWA_LENGTH,
  ENGAWA_WEST_X,
  FOUNDATION_STONE_H,
  FOUNDATION_STONE_SQ,
  HOUSE_WALL_Z,
  KEN,
} from '../../scene/layout'
import { chamferBox, mergeParts, moveGeo, offsetUvs, setVertexColor, tintJitter } from '../util/geo'

/**
 * 縁側: 縁甲板（長手張り・目透かし）＋縁框＋床束・束石。
 *
 * 実寸: 床高450、奥行910、板 幅135×厚30・目地3、框105角、束石は
 * 天端GL+60。板は外縁ほど雨晒しで銀灰化し、座る中央は使用で明るい —
 * 摩耗は原因（雨・使用）から傾斜させ、決して一様にしない。
 */
export function buildEngawa(kit: MatKit, rng: Rng): Group {
  const group = new Group()
  group.name = 'engawa'

  const centerX = (ENGAWA_WEST_X + ENGAWA_EAST_X) / 2

  // --- 縁甲板 -------------------------------------------------------------
  const boardCount = Math.floor(ENGAWA_DEPTH / (ENGAWA_BOARD_W + ENGAWA_BOARD_GAP))
  const boardParts = []
  for (let i = 0; i < boardCount; i++) {
    const zCenter =
      HOUSE_WALL_Z + (i + 0.5) * (ENGAWA_BOARD_W + ENGAWA_BOARD_GAP)
    const geo = chamferBox(ENGAWA_LENGTH, ENGAWA_BOARD_T, ENGAWA_BOARD_W, 0.0025)
    offsetUvs(geo, rng() * 3, rng() * 3)
    // 外縁（南）ほど銀灰化: 雨掛かりの必然の勾配＋個体差
    const weather = i / (boardCount - 1)
    const base = new Color('#a89c88').lerp(new Color('#8f867a'), 1 - weather)
    const tinted = tintJitter(rng, `#${base.getHexString()}`, 0.05)
    setVertexColor(geo, tinted)
    moveGeo(geo, centerX, ENGAWA_FLOOR_H - ENGAWA_BOARD_T / 2, zCenter)
    boardParts.push(geo)
  }
  const boards = new Mesh(mergeParts(boardParts), kit.woodWeathered)
  boards.castShadow = true
  boards.receiveShadow = true
  group.add(boards)

  // --- 縁框（前端の化粧梁） -----------------------------------------------
  const kamachiGeo = chamferBox(ENGAWA_LENGTH, ENGAWA_KAMACHI_SQ, ENGAWA_KAMACHI_SQ, 0.003)
  offsetUvs(kamachiGeo, rng() * 2, rng() * 2)
  setVertexColor(kamachiGeo, tintJitter(rng, '#93887a', 0.04))
  // 天端は縁甲板と面一、前面が縁側の外殻になる
  moveGeo(
    kamachiGeo,
    centerX,
    ENGAWA_FLOOR_H - ENGAWA_KAMACHI_SQ / 2,
    ENGAWA_FRONT_Z - ENGAWA_KAMACHI_SQ / 2,
  )
  const kamachi = new Mesh(kamachiGeo, kit.woodWeathered)
  kamachi.castShadow = true
  kamachi.receiveShadow = true
  group.add(kamachi)

  // --- 床束＋束石 ---------------------------------------------------------
  const postParts = []
  const stoneParts = []
  const kamachiBottom = ENGAWA_FLOOR_H - ENGAWA_KAMACHI_SQ
  for (let k = 0; k <= Math.round(ENGAWA_LENGTH / KEN); k++) {
    const x = ENGAWA_WEST_X + k * KEN
    const stone = chamferBox(
      FOUNDATION_STONE_SQ,
      FOUNDATION_STONE_H * 2,
      FOUNDATION_STONE_SQ,
      0.008,
    )
    setVertexColor(stone, tintJitter(rng, '#8f8a80', 0.06))
    offsetUvs(stone, rng(), rng())
    // 半分土に埋める（据えた石は沈むという接地の根拠）。框の直下に納める。
    const stoneZ = ENGAWA_FRONT_Z - FOUNDATION_STONE_SQ / 2 - 0.005
    moveGeo(stone, x, FOUNDATION_STONE_H, stoneZ)
    stoneParts.push(stone)

    const postH = kamachiBottom - FOUNDATION_STONE_H * 2
    const post = chamferBox(0.09, postH, 0.09, 0.002)
    setVertexColor(post, tintJitter(rng, '#6b5c4a', 0.05))
    offsetUvs(post, rng(), rng())
    moveGeo(post, x, FOUNDATION_STONE_H * 2 + postH / 2, stoneZ)
    postParts.push(post)
  }
  const stones = new Mesh(mergeParts(stoneParts), kit.stone)
  stones.castShadow = true
  stones.receiveShadow = true
  group.add(stones)
  const posts = new Mesh(mergeParts(postParts), kit.woodDark)
  posts.castShadow = true
  posts.receiveShadow = true
  group.add(posts)

  // --- 縁の下の暗部（奥を閉じる無彩色の板） -------------------------------
  const backGeo = chamferBox(ENGAWA_LENGTH, ENGAWA_FLOOR_H, 0.02, 0.002)
  moveGeo(backGeo, centerX, ENGAWA_FLOOR_H / 2 - 0.02, HOUSE_WALL_Z + 0.05)
  const back = new Mesh(backGeo, kit.shadowWood)
  back.receiveShadow = true
  group.add(back)

  return group
}
