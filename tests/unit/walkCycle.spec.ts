import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { buildPlayerRig } from '../../src/character/PlayerRig'
import { applyIdlePose, applyWalkPose, CYCLE_LEN, STRIDE } from '../../src/character/walkCycle'
import { deriveRng } from '../../src/core/rng'
import { createStubMatKit } from '../../src/materials/matkit'

const kit = createStubMatKit()

describe('walkCycle', () => {
  const rig = buildPlayerRig(kit, deriveRng(42, 'player'))
  const footWorld = (foot: 'footL' | 'footR') => {
    rig.root.updateMatrixWorld(true)
    const v = new Vector3()
    rig[foot].getWorldPosition(v)
    return v
  }

  it('接地脚の足裏が地面を割らず、大きく浮きもしない', () => {
    for (let i = 0; i <= 64; i++) {
      const phase = (i / 64) * Math.PI * 2
      applyWalkPose(rig, phase, 1.4)
      const l = footWorld('footL').y - 0.05 // 足首の50mm下が足裏
      const r = footWorld('footR').y - 0.05
      const lowest = Math.min(l, r)
      // 離地時のつま先の掠り＝柔らかい土に僅かに触れる程度（3cm）まで許容
      expect(lowest, `phase=${phase.toFixed(2)}`).toBeGreaterThan(-0.03)
      expect(lowest, `phase=${phase.toFixed(2)}`).toBeLessThan(0.035)
    }
  })

  it('左右対称: 半周期ずらすと脚の役割が入れ替わる', () => {
    applyWalkPose(rig, 0.7, 1.4)
    const thighL1 = rig.thighL.rotation.x
    const kneeL1 = rig.kneeL.rotation.x
    applyWalkPose(rig, 0.7 + Math.PI, 1.4)
    expect(rig.thighR.rotation.x).toBeCloseTo(thighL1, 6)
    expect(rig.kneeR.rotation.x).toBeCloseTo(kneeL1, 6)
  })

  it('連続性: 位相の巻き戻しで跳ばない', () => {
    applyWalkPose(rig, Math.PI * 2 - 0.001, 1.4)
    const a = rig.thighL.rotation.x
    applyWalkPose(rig, 0.001, 1.4)
    const b = rig.thighL.rotation.x
    expect(Math.abs(a - b)).toBeLessThan(0.01)
  })

  it('極端な速度でも NaN を出さない', () => {
    for (const speed of [0, 0.01, 1.4, 100]) {
      applyWalkPose(rig, 1.2345, speed)
      rig.root.updateMatrixWorld(true)
      expect(Number.isNaN(footWorld('footL').y)).toBe(false)
    }
  })

  it('ケイデンスは歩幅から導出される（足滑り防止の前提）', () => {
    expect(CYCLE_LEN).toBeCloseTo(STRIDE * 2, 9)
  })

  it('静止ポーズは水平を保つ', () => {
    applyIdlePose(rig, 3.21)
    rig.root.updateMatrixWorld(true)
    const l = footWorld('footL').y - 0.05
    expect(l).toBeCloseTo(0, 2)
  })
})

describe('rig proportions', () => {
  it('全高は約1.3m（3.5頭身の低頭身デザイン）', () => {
    const rig = buildPlayerRig(kit, deriveRng(42, 'player'))
    applyIdlePose(rig, 0)
    rig.root.updateMatrixWorld(true)
    // 帽子の天辺を含めた最高点
    let maxY = 0
    rig.root.traverse((o) => {
      const mesh = o as import('three').Mesh
      if (mesh.isMesh) {
        mesh.geometry.computeBoundingBox()
        const bb = mesh.geometry.boundingBox!
        const v = new Vector3()
        for (const y of [bb.min.y, bb.max.y]) {
          v.set(0, y, 0).applyMatrix4(mesh.matrixWorld)
          maxY = Math.max(maxY, v.y)
        }
      }
    })
    expect(maxY).toBeGreaterThan(1.2)
    expect(maxY).toBeLessThan(1.45)
  })
})
