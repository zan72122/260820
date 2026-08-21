import { Color, Group, Mesh } from 'three'
import type { Rng } from '../../core/rng'
import type { MatKit } from '../../materials/matkit'
import {
  FENCE_BOARD_T,
  FENCE_BOARD_W,
  FENCE_EAST_X,
  FENCE_H,
  FENCE_KASAGI_T,
  FENCE_KASAGI_W,
  FENCE_POST_PITCH,
  FENCE_POST_SQ,
  FENCE_SOUTH_Z,
  GATE_CENTER_X,
  GATE_W,
  HOUSE_WALL_Z,
} from '../../scene/layout'
import { chamferBox, mergeParts, moveGeo, offsetUvs, setVertexColor, tintJitter } from '../util/geo'
import type { GroundBuilder } from '../garden/ground'

/**
 * 板塀: 柱90角＠1間・貫2段・縦板180×12・笠木45×120。南辺（木戸つき）と
 * 東辺（隣家との境）。笠木は雨仕舞のための機能部材。
 *
 * 汚れの規則: 下端200mmは雨の泥はね（板ごとに濃さが違う）、笠木直下は
 * 雨垂れの筋。すべてシード差で非対称。
 */
export function buildItabei(kit: MatKit, rng: Rng, ground: GroundBuilder): Group {
  const group = new Group()
  group.name = 'itabei'

  const postParts: import("three").BufferGeometry[] = []
  const boardParts: import("three").BufferGeometry[] = []
  const railParts: import("three").BufferGeometry[] = []
  const kasagiParts: import("three").BufferGeometry[] = []

  const mud = new Color('#4d3d2c')

  const addRun = (
    from: { x: number; z: number },
    to: { x: number; z: number },
    gate: { center: number; width: number } | null,
  ) => {
    const dx = to.x - from.x
    const dz = to.z - from.z
    const len = Math.hypot(dx, dz)
    const ux = dx / len
    const uz = dz / len
    const angle = Math.atan2(-uz, ux) // 走行方向→Y回転

    const posAt = (t: number) => ({ x: from.x + ux * t, z: from.z + uz * t })

    // 柱
    for (let t = 0; t <= len + 0.001; t += FENCE_POST_PITCH) {
      const p = posAt(Math.min(t, len))
      const gy = ground.heightAt(p.x, p.z)
      const post = chamferBox(FENCE_POST_SQ, FENCE_H + 0.05, FENCE_POST_SQ, 0.004)
      setVertexColor(post, tintJitter(rng, '#5b4a37', 0.05))
      offsetUvs(post, rng() * 2, rng() * 2)
      post.rotateY(angle)
      moveGeo(post, p.x, gy + (FENCE_H + 0.05) / 2 - 0.05, p.z)
      postParts.push(post)
      ground.addDepression(p.x, p.z, 0.14, 0.008)
    }

    // 貫（2段）
    for (const railY of [0.35, 1.25]) {
      const segments: Array<[number, number]> = gate
        ? [
            [0, gate.center - gate.width / 2],
            [gate.center + gate.width / 2, len],
          ]
        : [[0, len]]
      for (const [a, b] of segments) {
        if (b - a < 0.05) continue
        const mid = posAt((a + b) / 2)
        const gy = ground.heightAt(mid.x, mid.z)
        const rail = chamferBox(b - a, 0.045, 0.09, 0.003)
        setVertexColor(rail, tintJitter(rng, '#5b4a37', 0.04))
        offsetUvs(rail, rng() * 2, rng() * 2)
        rail.rotateY(angle)
        moveGeo(rail, mid.x, gy + railY, mid.z)
        railParts.push(rail)
      }
    }

    // 縦板
    const boardPitch = FENCE_BOARD_W + 0.004
    for (let t = boardPitch / 2; t < len; t += boardPitch) {
      if (gate && Math.abs(t - gate.center) < gate.width / 2) continue
      const p = posAt(t)
      const gy = ground.heightAt(p.x, p.z)
      const h = FENCE_H - 0.08 + (rng() - 0.5) * 0.015
      const board = chamferBox(FENCE_BOARD_W - 0.004, h, FENCE_BOARD_T, 0.0015)
      // 板ごとの日焼けムラ＋下端の泥はね（濃さは板ごとに違う）
      const baseTint = tintJitter(rng, '#63513c', 0.07)
      setVertexColor(board, baseTint)
      {
        const pos = board.getAttribute('position')
        const col = board.getAttribute('color')
        const splashH = 0.14 + rng() * 0.12
        const splashAmt = 0.35 + rng() * 0.4
        const tmp = new Color()
        for (let i = 0; i < pos.count; i++) {
          const yy = pos.getY(i) + h / 2 // 0..h
          if (yy < splashH) {
            tmp.setRGB(col.getX(i), col.getY(i), col.getZ(i))
            tmp.lerp(mud, splashAmt * (1 - yy / splashH))
            col.setXYZ(i, tmp.r, tmp.g, tmp.b)
          }
          // 笠木直下の雨染みの弱い帯
          if (yy > h - 0.1) {
            tmp.setRGB(col.getX(i), col.getY(i), col.getZ(i))
            tmp.multiplyScalar(0.94)
            col.setXYZ(i, tmp.r, tmp.g, tmp.b)
          }
        }
      }
      offsetUvs(board, rng() * 2, rng() * 2)
      board.rotateY(angle)
      moveGeo(board, p.x, gy + h / 2 + 0.06, p.z)
      boardParts.push(board)
    }

    // 笠木
    {
      const segsK: Array<[number, number]> = gate
        ? [
            [0, gate.center - gate.width / 2 - 0.05],
            [gate.center + gate.width / 2 + 0.05, len],
          ]
        : [[0, len]]
      for (const [a, b] of segsK) {
        if (b - a < 0.05) continue
        const mid = posAt((a + b) / 2)
        const gy = ground.heightAt(mid.x, mid.z)
        const kasagi = chamferBox(b - a + 0.08, FENCE_KASAGI_T, FENCE_KASAGI_W, 0.005)
        setVertexColor(kasagi, tintJitter(rng, '#4f4131', 0.05))
        offsetUvs(kasagi, rng() * 2, rng() * 2)
        kasagi.rotateY(angle)
        moveGeo(kasagi, mid.x, gy + FENCE_H + 0.02, mid.z)
        kasagiParts.push(kasagi)
      }
    }

    // 木戸（框組みの開き戸、僅かに開けておく=生活の気配）
    if (gate) {
      const gp = posAt(gate.center)
      const gy = ground.heightAt(gp.x, gp.z)
      const door = new Group()
      const doorParts = []
      const dH = FENCE_H - 0.25
      const frameW = 0.06
      for (const fx of [-gate.width / 2 + frameW / 2 + 0.02, gate.width / 2 - frameW / 2 - 0.02]) {
        doorParts.push(moveGeo(chamferBox(frameW, dH, 0.03, 0.003), fx, dH / 2, 0))
      }
      for (const fy of [0.08, dH / 2, dH - 0.06]) {
        doorParts.push(moveGeo(chamferBox(gate.width - 0.16, frameW, 0.03, 0.003), 0, fy, 0))
      }
      const nB = Math.floor((gate.width - 0.1) / 0.15)
      for (let i = 0; i < nB; i++) {
        const bx = -(gate.width - 0.16) / 2 + 0.15 * (i + 0.5)
        doorParts.push(moveGeo(chamferBox(0.14, dH - 0.1, 0.012, 0.0015), bx, dH / 2, -0.02))
      }
      for (const g of doorParts) {
        setVertexColor(g, tintJitter(rng, '#6a5843', 0.05))
        offsetUvs(g, rng(), rng())
      }
      const doorMesh = new Mesh(mergeParts(doorParts), kit.woodDark)
      doorMesh.castShadow = true
      doorMesh.receiveShadow = true
      // 板はヒンジ原点から先へ張り出す
      doorMesh.position.x = gate.width / 2
      door.add(doorMesh)
      // ヒンジ側の柱に吊り、15°だけ内へ開けておく（生活の気配）
      door.position.set(
        gp.x - (gate.width / 2) * ux,
        gy + 0.05,
        gp.z - (gate.width / 2) * uz,
      )
      door.rotation.y = angle + 0.26
      group.add(door)
    }
  }

  // 南辺（木戸つき）: 西端は四つ目垣に任せ、x=-1.2 から東へ
  addRun(
    { x: -1.2, z: FENCE_SOUTH_Z },
    { x: FENCE_EAST_X, z: FENCE_SOUTH_Z },
    { center: GATE_CENTER_X - -1.2, width: GATE_W },
  )
  // 東辺（隣家との境）: 南端から家まで
  addRun(
    { x: FENCE_EAST_X, z: FENCE_SOUTH_Z },
    { x: FENCE_EAST_X, z: HOUSE_WALL_Z + 0.3 },
    null,
  )

  const posts = new Mesh(mergeParts(postParts), kit.woodDark)
  posts.castShadow = true
  posts.receiveShadow = true
  const boards = new Mesh(mergeParts(boardParts), kit.woodDark)
  boards.castShadow = true
  boards.receiveShadow = true
  const rails = new Mesh(mergeParts(railParts), kit.woodDark)
  rails.castShadow = true
  rails.receiveShadow = true
  const kasagi = new Mesh(mergeParts(kasagiParts), kit.woodDark)
  kasagi.castShadow = true
  kasagi.receiveShadow = true
  group.add(posts, boards, rails, kasagi)
  return group
}
