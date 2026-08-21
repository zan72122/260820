import {
  BufferAttribute,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three'
import type { Rng } from '../../core/rng'
import { rngRange } from '../../core/rng'
import type { MatKit } from '../../materials/matkit'
import { CLOTHES_POLE, FIREWOOD, TARAI } from '../../scene/layout'
import { mergeParts, offsetUvs, setVertexColor, tintJitter } from '../util/geo'
import type { GroundBuilder } from '../garden/ground'

/**
 * 生活の跡: 薪積み（軒下=雨に濡れない置き場の必然）、盥、物干し。
 * どれも機能を持つ日用品で、飾りは一つもない。
 */
export function buildClutter(kit: MatKit, rng: Rng, ground: GroundBuilder): Group {
  const group = new Group()
  group.name = 'clutter'

  // --- 薪積み: 直交に組んだ井桁積み ---------------------------------------
  {
    const logs = []
    const gy = ground.heightAt(FIREWOOD.x, FIREWOOD.z)
    const logR = 0.045
    const rows = Math.floor(FIREWOOD.h / (logR * 2))
    for (let r = 0; r < rows; r++) {
      const y = gy + logR + r * logR * 1.9
      const n = Math.floor(FIREWOOD.w / (logR * 2.2))
      for (let i = 0; i < n; i++) {
        if (rng() < 0.08) continue // 抜けた薪（使った跡）
        const lx = FIREWOOD.x - FIREWOOD.w / 2 + logR + i * logR * 2.2 + (rng() - 0.5) * 0.015
        const len = FIREWOOD.d * rngRange(rng, 0.85, 1.0)
        const log = new CylinderGeometry(
          logR * rngRange(rng, 0.75, 1.0),
          logR * rngRange(rng, 0.8, 1.05),
          len,
          8,
        )
        log.rotateX(Math.PI / 2)
        log.rotateY((rng() - 0.5) * 0.06)
        log.translate(lx, y, FIREWOOD.z + (rng() - 0.5) * 0.03)
        // 木口（切断面）は明るい: 端の頂点を明るくする
        const pos = log.getAttribute('position')
        const col = new Float32Array(pos.count * 3)
        const barkC = tintJitter(rng, '#4f4438', 0.07)
        const cutC = new Color('#a89571')
        const tmp = new Color()
        for (let v = 0; v < pos.count; v++) {
          const lz = pos.getZ(v) - FIREWOOD.z
          const nearEnd = Math.abs(lz) > len * 0.46
          tmp.copy(nearEnd ? cutC : barkC)
          col[v * 3] = tmp.r
          col[v * 3 + 1] = tmp.g
          col[v * 3 + 2] = tmp.b
        }
        log.setAttribute('color', new BufferAttribute(col, 3))
        offsetUvs(log, rng(), rng())
        logs.push(log)
      }
    }
    const mesh = new Mesh(mergeParts(logs), kit.bark)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    ground.addShade(FIREWOOD.x, FIREWOOD.z, FIREWOOD.w * 0.7, 0.3)
  }

  // --- 盥（ブリキ、蹲の脇） -----------------------------------------------
  {
    const gy = ground.heightAt(TARAI.x, TARAI.z)
    const parts = []
    const wall = new CylinderGeometry(TARAI.d / 2, TARAI.d / 2 - 0.03, 0.16, 16, 1, true)
    setVertexColor(wall, tintJitter(rng, '#9aa1a4', 0.04))
    wall.translate(0, 0.08, 0)
    parts.push(wall)
    const bottom = new CylinderGeometry(TARAI.d / 2 - 0.03, TARAI.d / 2 - 0.03, 0.008, 16)
    setVertexColor(bottom, tintJitter(rng, '#8a9194', 0.04))
    bottom.translate(0, 0.012, 0)
    parts.push(bottom)
    for (const p of parts) offsetUvs(p, rng(), rng())
    const mesh = new Mesh(mergeParts(parts), kit.metalTin)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.position.set(TARAI.x, gy, TARAI.z)
    mesh.rotation.y = rng() * Math.PI
    group.add(mesh)
    ground.addDepression(TARAI.x, TARAI.z, TARAI.d * 0.6, 0.008)
    ground.addShade(TARAI.x, TARAI.z, TARAI.d * 0.7, 0.25)
  }

  // --- 物干し: X脚2基＋竹竿＋掛かった手ぬぐい -----------------------------
  {
    const poleParts = []
    const frameParts = []
    for (const fx of [CLOTHES_POLE.x1, CLOTHES_POLE.x2]) {
      const gy = ground.heightAt(fx, CLOTHES_POLE.z)
      for (const lean of [0.32, -0.32]) {
        const leg = new CylinderGeometry(0.022, 0.025, CLOTHES_POLE.h / Math.cos(lean) + 0.1, 8)
        setVertexColor(leg, tintJitter(rng, '#6a5843', 0.05))
        leg.rotateX(lean)
        leg.translate(fx, gy + CLOTHES_POLE.h / 2, CLOTHES_POLE.z)
        offsetUvs(leg, rng(), rng())
        frameParts.push(leg)
      }
      ground.addDepression(fx, CLOTHES_POLE.z + 0.25, 0.1, 0.006)
      ground.addDepression(fx, CLOTHES_POLE.z - 0.25, 0.1, 0.006)
    }
    const gyMid = ground.heightAt((CLOTHES_POLE.x1 + CLOTHES_POLE.x2) / 2, CLOTHES_POLE.z)
    const pole = new CylinderGeometry(0.015, 0.015, CLOTHES_POLE.x2 - CLOTHES_POLE.x1 + 0.5, 8, 6)
    setVertexColor(pole, tintJitter(rng, '#b0995c', 0.05))
    pole.rotateZ(Math.PI / 2)
    pole.translate((CLOTHES_POLE.x1 + CLOTHES_POLE.x2) / 2, gyMid + CLOTHES_POLE.h, CLOTHES_POLE.z)
    offsetUvs(pole, rng(), rng())
    poleParts.push(pole)

    const frames = new Mesh(mergeParts(frameParts), kit.woodDark)
    frames.castShadow = true
    const poles = new Mesh(mergeParts(poleParts), kit.bamboo)
    poles.castShadow = true
    group.add(frames, poles)

    // 手ぬぐい: 竿に掛かって垂れる（風のない夕方なので静か）
    const cloth = new PlaneGeometry(0.32, 0.7, 8, 10)
    const pos = cloth.getAttribute('position')
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      const x = pos.getX(i)
      // 竿を跨いで両側に垂れる形: 上端で折る
      const fold = Math.abs(y) < 0.02 ? 0 : 0.015
      pos.setZ(i, fold + Math.sin(x * 9) * 0.008 * (0.35 - y))
    }
    cloth.computeVertexNormals()
    const clothMesh = new Mesh(
      cloth,
      // 藍染の古い手ぬぐい: 洗い晒しで色が抜けている
      new MeshStandardMaterial({ color: '#5d6a80', roughness: 0.95, side: 2 }),
    )
    clothMesh.position.set(
      CLOTHES_POLE.x1 + 0.55,
      gyMid + CLOTHES_POLE.h - 0.33,
      CLOTHES_POLE.z + 0.001,
    )
    clothMesh.castShadow = true
    group.add(clothMesh)
  }

  return group
}
