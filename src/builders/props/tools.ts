import {
  BufferAttribute,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  TorusGeometry,
} from 'three'
import type { Rng } from '../../core/rng'
import type { MatKit } from '../../materials/matkit'
import { TOOL_RACK } from '../../scene/layout'
import { chamferBox, mergeParts, moveGeo, offsetUvs, setVertexColor, tintJitter } from '../util/geo'
import type { GroundBuilder } from '../garden/ground'

export interface ToolHandles {
  group: Group
  /** id → メッシュ（持つ/戻すで付け替える） */
  tools: Map<'wateringCan' | 'hoe' | 'broom', Group>
}

/**
 * 道具置き場: 壁際の立てかけラックと3つの道具。
 * - 如雨露6L: ブリキ、注ぎ口は蓮口、持ち手は上と背の2つ（実物の構成）
 * - 鍬: 樫の柄＋鋼の刃、刃先だけ土で磨かれて明るい
 * - 竹箒: 竹柄＋穂先
 * 全て「使い込まれた家の道具」。グリップは手擦れで暗い。
 */
export function buildTools(kit: MatKit, rng: Rng, ground: GroundBuilder): ToolHandles {
  const group = new Group()
  group.name = 'tools'
  const tools = new Map<'wateringCan' | 'hoe' | 'broom', Group>()
  const gy = ground.heightAt(TOOL_RACK.x, TOOL_RACK.z)

  // --- ラック（2本柱＋横桟） ----------------------------------------------
  const rackParts = []
  for (const ox of [-0.45, 0.45]) {
    const post = chamferBox(0.05, 1.15, 0.05, 0.003)
    setVertexColor(post, tintJitter(rng, '#5b4a37', 0.05))
    moveGeo(post, ox, 0.575, 0)
    rackParts.push(post)
  }
  const rail = chamferBox(1.0, 0.04, 0.04, 0.003)
  setVertexColor(rail, tintJitter(rng, '#5b4a37', 0.05))
  moveGeo(rail, 0, 1.05, 0)
  rackParts.push(rail)
  for (const p of rackParts) offsetUvs(p, rng(), rng())
  const rack = new Mesh(mergeParts(rackParts), kit.woodDark)
  rack.castShadow = true
  rack.receiveShadow = true
  const rackGroup = new Group()
  rackGroup.add(rack)
  rackGroup.position.set(TOOL_RACK.x, gy, TOOL_RACK.z)
  group.add(rackGroup)

  // --- 如雨露 --------------------------------------------------------------
  const can = new Group()
  can.name = 'tool:wateringCan'
  {
    const parts = []
    const body = new CylinderGeometry(0.1, 0.105, 0.24, 14)
    setVertexColor(body, tintJitter(rng, '#9aa1a4', 0.04))
    body.translate(0, 0.12, 0)
    parts.push(body)
    const spout = new CylinderGeometry(0.012, 0.018, 0.3, 8)
    setVertexColor(spout, tintJitter(rng, '#8f979a', 0.04))
    spout.rotateZ(-0.9)
    spout.translate(0.19, 0.2, 0)
    parts.push(spout)
    const rose = new CylinderGeometry(0.032, 0.026, 0.02, 10)
    setVertexColor(rose, tintJitter(rng, '#848b8e', 0.05))
    rose.rotateZ(-0.9)
    rose.translate(0.305, 0.29, 0)
    parts.push(rose)
    const topHandle = new TorusGeometry(0.07, 0.008, 8, 14, Math.PI)
    setVertexColor(topHandle, tintJitter(rng, '#8f979a', 0.04))
    topHandle.translate(0, 0.24, 0)
    parts.push(topHandle)
    const backHandle = new TorusGeometry(0.075, 0.008, 8, 14, Math.PI * 0.8)
    setVertexColor(backHandle, tintJitter(rng, '#8f979a', 0.04))
    backHandle.rotateY(Math.PI / 2)
    backHandle.rotateZ(Math.PI / 2)
    backHandle.translate(-0.1, 0.15, 0)
    parts.push(backHandle)
    for (const p of parts) offsetUvs(p, rng(), rng())
    const mesh = new Mesh(mergeParts(parts), kit.metalTin)
    mesh.castShadow = true
    can.add(mesh)
  }
  // 定位置: ラックの脇の地面（水場に近い方）
  can.position.set(TOOL_RACK.x - 0.75, ground.heightAt(TOOL_RACK.x - 0.75, TOOL_RACK.z + 0.25), TOOL_RACK.z + 0.25)
  can.rotation.y = -0.5
  tools.set('wateringCan', can)
  group.add(can)
  ground.addDepression(TOOL_RACK.x - 0.75, TOOL_RACK.z + 0.25, 0.14, 0.006)

  // --- 鍬（ラックに立てかけ） ----------------------------------------------
  const hoe = new Group()
  hoe.name = 'tool:hoe'
  {
    const parts = []
    const shaft = new CylinderGeometry(0.016, 0.019, 1.1, 8)
    // 柄: 手擦れで中程が明るく滑らか
    const posA = shaft.getAttribute('position')
    const colA = new Float32Array(posA.count * 3)
    const base = tintJitter(rng, '#7a664c', 0.04)
    const worn = base.clone().multiplyScalar(1.18)
    const tmpC = new Color()
    for (let i = 0; i < posA.count; i++) {
      const t = posA.getY(i) / 1.1 + 0.5
      const grip = Math.exp(-Math.pow((t - 0.65) / 0.2, 2))
      tmpC.copy(base).lerp(worn, grip)
      colA[i * 3] = tmpC.r
      colA[i * 3 + 1] = tmpC.g
      colA[i * 3 + 2] = tmpC.b
    }
    shaft.setAttribute('color', new BufferAttribute(colA, 3))
    parts.push(shaft)
    const bladeNeck = chamferBox(0.03, 0.12, 0.03, 0.003)
    setVertexColor(bladeNeck, tintJitter(rng, '#3d3833', 0.04))
    moveGeo(bladeNeck, 0, -0.58, 0.03)
    bladeNeck.rotateX(0.5)
    parts.push(bladeNeck)
    const blade = chamferBox(0.16, 0.22, 0.008, 0.002)
    // 刃: 使う先端ほど土に磨かれて明るい（鋼の地金）
    const posB = blade.getAttribute('position')
    const colB = new Float32Array(posB.count * 3)
    const dark = new Color('#42403c')
    const bright = new Color('#9a938a')
    for (let i = 0; i < posB.count; i++) {
      const t = -posB.getY(i) / 0.22 + 0.5
      tmpC.copy(dark).lerp(bright, Math.max(0, t - 0.35) * 1.4)
      colB[i * 3] = tmpC.r
      colB[i * 3 + 1] = tmpC.g
      colB[i * 3 + 2] = tmpC.b
    }
    blade.setAttribute('color', new BufferAttribute(colB, 3))
    blade.rotateX(0.55)
    moveGeo(blade, 0, -0.68, 0.1)
    parts.push(blade)
    for (const p of parts) offsetUvs(p, rng(), rng())
    const mesh = new Mesh(mergeParts(parts), kit.woodDark)
    mesh.castShadow = true
    mesh.position.y = 0.68
    hoe.add(mesh)
  }
  hoe.position.set(TOOL_RACK.x - 0.25, gy, TOOL_RACK.z + 0.02)
  hoe.rotation.z = 0.18
  hoe.rotation.y = 0.3
  tools.set('hoe', hoe)
  group.add(hoe)

  // --- 竹箒（ラックに立てかけ） --------------------------------------------
  const broom = new Group()
  broom.name = 'tool:broom'
  {
    const parts = []
    const shaft = new CylinderGeometry(0.014, 0.014, 1.05, 8)
    setVertexColor(shaft, tintJitter(rng, '#b0995c', 0.05))
    shaft.translate(0, 0.75, 0)
    parts.push(shaft)
    const brush = new CylinderGeometry(0.015, 0.09, 0.45, 10)
    setVertexColor(brush, tintJitter(rng, '#8a7346', 0.08))
    brush.translate(0, 0.23, 0)
    parts.push(brush)
    const band = new TorusGeometry(0.03, 0.006, 6, 10)
    setVertexColor(band, new Color('#3f3327'))
    band.rotateX(Math.PI / 2)
    band.translate(0, 0.42, 0)
    parts.push(band)
    for (const p of parts) offsetUvs(p, rng(), rng())
    const mesh = new Mesh(mergeParts(parts), kit.bamboo)
    mesh.castShadow = true
    broom.add(mesh)
  }
  broom.position.set(TOOL_RACK.x + 0.28, gy, TOOL_RACK.z + 0.03)
  broom.rotation.z = -0.15
  tools.set('broom', broom)
  group.add(broom)

  // 道具置き場の足元は乾いて踏み固められている
  ground.addWear(TOOL_RACK.x, TOOL_RACK.z + 0.4, 0.6, 0.45)

  return { group, tools }
}
