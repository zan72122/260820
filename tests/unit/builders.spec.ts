import { Box3, Mesh, type Object3D } from 'three'
import { describe, expect, it } from 'vitest'
import { buildEngawa } from '../../src/builders/house/engawa'
import { buildFacade } from '../../src/builders/house/facade'
import { buildKawaraRoof, EAVE_EDGE_Y, RIDGE_Y, RIDGE_Z } from '../../src/builders/house/roof'
import { GroundBuilder } from '../../src/builders/garden/ground'
import { deriveRng } from '../../src/core/rng'
import { createStubMatKit } from '../../src/materials/matkit'
import {
  EAVE_LINE_Z,
  EAVE_WALL_H,
  ENGAWA_BOARD_T,
  ENGAWA_FLOOR_H,
  ENGAWA_FRONT_Z,
  EAVE_OVERHANG,
  HOUSE_WALL_Z,
  PILLAR_SQ,
  ROOF_PITCH,
} from '../../src/scene/layout'

const kit = createStubMatKit()

function findMesh(root: Object3D, name?: string): Mesh[] {
  const out: Mesh[] = []
  root.traverse((o) => {
    if ((o as Mesh).isMesh && (!name || o.name === name)) out.push(o as Mesh)
  })
  return out
}

function positionsHash(root: Object3D): number {
  let h = 0x811c9dc5
  root.updateMatrixWorld(true)
  for (const mesh of findMesh(root)) {
    // シードは配置ではなく個体差（頂点色・UVオフセット）にも表れるので
    // 位置と色の両方をハッシュに含める。
    for (const key of ['position', 'color'] as const) {
      const attr = mesh.geometry.getAttribute(key)
      if (!attr) continue
      for (let i = 0; i < attr.count; i++) {
        const v =
          Math.round(attr.getX(i) * 1e5) ^
          Math.round(attr.getY(i) * 1e5) ^
          Math.round(attr.getZ(i) * 1e5)
        h = Math.imul(h ^ v, 0x01000193)
      }
    }
  }
  return h >>> 0
}

describe('縁側 (engawa)', () => {
  const engawa = buildEngawa(kit, deriveRng(42, 'engawa'))
  const bounds = new Box3().setFromObject(engawa)

  it('床は GL+450mm（腰掛けられる実用寸法）', () => {
    expect(bounds.max.y).toBeCloseTo(ENGAWA_FLOOR_H, 3)
  })

  it('縁側は壁から前端まで奥行 910mm 以内に収まる', () => {
    expect(bounds.min.z).toBeGreaterThanOrEqual(HOUSE_WALL_Z - 0.1)
    expect(bounds.max.z).toBeLessThanOrEqual(ENGAWA_FRONT_Z + 0.001)
  })

  it('縁甲板は厚30mm', () => {
    expect(ENGAWA_BOARD_T).toBeCloseTo(0.03, 6)
  })

  it('同一シードなら同一ジオメトリ、別シードなら異なる', () => {
    const again = buildEngawa(kit, deriveRng(42, 'engawa'))
    expect(positionsHash(again)).toBe(positionsHash(engawa))
    const other = buildEngawa(kit, deriveRng(43, 'engawa'))
    expect(positionsHash(other)).not.toBe(positionsHash(engawa))
  })
})

describe('ファサード (facade)', () => {
  const facade = buildFacade(kit, deriveRng(42, 'facade'))

  it('柱は105mm角・軒高2600mmで立つ', () => {
    const bounds = new Box3().setFromObject(facade)
    expect(bounds.max.y).toBeCloseTo(EAVE_WALL_H, 2)
    expect(PILLAR_SQ).toBeCloseTo(0.105, 6)
  })

  it('壁面は柱面から引っ込む（真壁の凹凸がある）', () => {
    const bounds = new Box3().setFromObject(facade)
    // 柱の前面が最も南（大きいz）に出る
    expect(bounds.max.z).toBeCloseTo(HOUSE_WALL_Z + PILLAR_SQ / 2, 3)
  })
})

describe('瓦屋根 (roof)', () => {
  const roof = buildKawaraRoof(kit, deriveRng(42, 'roof'))

  it('4寸勾配（21.8°）で棟へ上がる', () => {
    expect(Math.tan(ROOF_PITCH)).toBeCloseTo(0.4, 6)
    const rise = RIDGE_Y - EAVE_EDGE_Y
    const run = EAVE_LINE_Z - RIDGE_Z
    expect(rise / run).toBeCloseTo(Math.tan(ROOF_PITCH), 2)
  })

  it('軒の出は壁から750mm、軒先は壁上端より低い', () => {
    expect(EAVE_LINE_Z - HOUSE_WALL_Z).toBeCloseTo(EAVE_OVERHANG, 6)
    expect(EAVE_EDGE_Y).toBeLessThan(EAVE_WALL_H)
    const bounds = new Box3().setFromObject(roof)
    // 軒先（南端）が軒線を僅かに越える程度に収まる
    expect(bounds.max.z).toBeGreaterThan(EAVE_LINE_Z - 0.05)
    expect(bounds.max.z).toBeLessThan(EAVE_LINE_Z + 0.15)
  })

  it('総三角形数は予算内（SwiftShaderでも軽い）', () => {
    let tris = 0
    roof.traverse((o) => {
      const mesh = o as Mesh
      if (mesh.isMesh) {
        const index = mesh.geometry.getIndex()
        tris += (index ? index.count : mesh.geometry.getAttribute('position').count) / 3
      }
    })
    expect(tris).toBeLessThan(40_000)
  })
})

describe('地面 (ground)', () => {
  it('起伏は±3cm、設置痕は指定深さだけ沈む', () => {
    const g = new GroundBuilder(42)
    let min = Infinity
    let max = -Infinity
    for (let x = -6; x <= 6; x += 0.37) {
      for (let z = -4; z <= 5; z += 0.37) {
        const y = g.heightAt(x, z)
        min = Math.min(min, y)
        max = Math.max(max, y)
      }
    }
    expect(min).toBeGreaterThanOrEqual(-0.031)
    expect(max).toBeLessThanOrEqual(0.031)

    const before = g.heightAt(1, 1)
    g.addDepression(1, 1, 0.3, 0.02)
    expect(g.heightAt(1, 1)).toBeCloseTo(before - 0.02, 4)
  })

  it('ゾーン属性（苔・踏み分け・汚れ）がジオメトリに乗る', () => {
    const g = new GroundBuilder(42)
    g.addMoss(0, 0, 1, 1)
    g.addWear(2, 2, 1, 0.8)
    const geo = g.buildGeometry(40)
    expect(geo.getAttribute('aMoss')).toBeDefined()
    expect(geo.getAttribute('aWear')).toBeDefined()
    expect(geo.getAttribute('aShade')).toBeDefined()
    let mossMax = 0
    const aMoss = geo.getAttribute('aMoss')
    for (let i = 0; i < aMoss.count; i++) mossMax = Math.max(mossMax, aMoss.getX(i))
    expect(mossMax).toBeGreaterThan(0.8)
  })
})
