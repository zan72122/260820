import { BufferAttribute, Color, CylinderGeometry, Group, Mesh } from 'three'
import type { Rng } from '../../core/rng'
import type { MatKit } from '../../materials/matkit'
import {
  FENCE_SOUTH_Z,
  FENCE_WEST_X,
  HOUSE_WALL_Z,
  TAKEGAKI_BAMBOO_D,
  TAKEGAKI_H,
  TAKEGAKI_X,
  TAKEGAKI_Z_FROM,
  TAKEGAKI_Z_TO,
} from '../../scene/layout'
import { chamferBox, mergeParts, moveGeo, offsetUvs, setVertexColor, tintJitter } from '../util/geo'
import type { GroundBuilder } from '../garden/ground'

/**
 * 四つ目垣: 立子（竹φ40）＠約300 ＋ 胴縁2段、交点は棕櫚縄の結び。
 * 高さ750 — 低いのは「西日を庭に通す」ための機能（夕景の必然）。
 * 西境と、菜園と園路の間仕切りに使う。
 */
export function buildTakegaki(kit: MatKit, rng: Rng, ground: GroundBuilder): Group {
  const group = new Group()
  group.name = 'takegaki'

  const bambooParts: import("three").BufferGeometry[] = []
  const ropeParts: import("three").BufferGeometry[] = []
  const rope = new Color('#3f3327')

  const culm = (x: number, z: number, h: number, tilt: number) => {
    const gy = ground.heightAt(x, z)
    const nodes = 3
    const geo = new CylinderGeometry(
      TAKEGAKI_BAMBOO_D / 2,
      TAKEGAKI_BAMBOO_D / 2 + 0.002,
      h,
      8,
      nodes * 2,
    )
    // 節: 高さ方向の一定間隔で僅かに膨らませ、色を暗くする
    const pos = geo.getAttribute('position')
    const colArr = new Float32Array(pos.count * 3)
    const base = tintJitter(rng, '#b0995c', 0.06)
    const nodeCol = base.clone().multiplyScalar(0.78)
    const tmp = new Color()
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / h + 0.5 // 0..1
      const nodePhase = Math.abs(((y * nodes) % 1) - 0.5)
      const isNode = nodePhase > 0.44
      if (isNode) {
        const r = 1.06
        pos.setX(i, pos.getX(i) * r)
        pos.setZ(i, pos.getZ(i) * r)
      }
      tmp.copy(isNode ? nodeCol : base)
      colArr[i * 3] = tmp.r
      colArr[i * 3 + 1] = tmp.g
      colArr[i * 3 + 2] = tmp.b
    }
    geo.setAttribute('color', new BufferAttribute(colArr, 3))
    geo.rotateZ(tilt)
    geo.translate(x, gy + h / 2 - 0.03, z)
    offsetUvs(geo, rng(), rng())
    return geo
  }

  const addRun = (
    from: { x: number; z: number },
    to: { x: number; z: number },
  ) => {
    const dx = to.x - from.x
    const dz = to.z - from.z
    const len = Math.hypot(dx, dz)
    const ux = dx / len
    const uz = dz / len

    // 立子
    for (let t = 0.15; t < len; t += 0.3) {
      const x = from.x + ux * t + (rng() - 0.5) * 0.02
      const z = from.z + uz * t + (rng() - 0.5) * 0.02
      bambooParts.push(culm(x, z, TAKEGAKI_H + 0.06, (rng() - 0.5) * 0.03))
    }
    // 胴縁（横竹2段）: 走行方向へ倒した細い竹
    for (const railY of [TAKEGAKI_H * 0.38, TAKEGAKI_H * 0.82]) {
      const mid = { x: from.x + ux * (len / 2), z: from.z + uz * (len / 2) }
      const gy = ground.heightAt(mid.x, mid.z)
      const rail = new CylinderGeometry(0.016, 0.016, len, 8, 1)
      setVertexColor(rail, tintJitter(rng, '#a8925a', 0.05))
      rail.rotateZ(Math.PI / 2)
      rail.rotateY(Math.atan2(-uz, ux))
      rail.translate(mid.x, gy + railY, mid.z)
      offsetUvs(rail, rng(), rng())
      bambooParts.push(rail)
      // 結び目（交点ごと）
      for (let t = 0.15; t < len; t += 0.3) {
        const x = from.x + ux * t
        const z = from.z + uz * t
        const gyk = ground.heightAt(x, z)
        const knot = chamferBox(0.055, 0.045, 0.055, 0.008)
        setVertexColor(knot, rope)
        moveGeo(knot, x, gyk + railY, z)
        offsetUvs(knot, rng(), rng())
        ropeParts.push(knot)
      }
    }
  }

  // 西境: 家の西端から南塀まで
  addRun({ x: FENCE_WEST_X, z: HOUSE_WALL_Z + 0.4 }, { x: FENCE_WEST_X, z: FENCE_SOUTH_Z })
  // 菜園の間仕切り
  addRun({ x: TAKEGAKI_X, z: TAKEGAKI_Z_FROM }, { x: TAKEGAKI_X, z: TAKEGAKI_Z_TO })
  // 南西の残り（板塀の始まりまで低垣で繋ぐ）
  addRun({ x: FENCE_WEST_X, z: FENCE_SOUTH_Z }, { x: -1.2, z: FENCE_SOUTH_Z })

  const bamboo = new Mesh(mergeParts(bambooParts), kit.bamboo)
  bamboo.castShadow = true
  bamboo.receiveShadow = true
  const knots = new Mesh(mergeParts(ropeParts), kit.woodDark)
  knots.castShadow = true
  group.add(bamboo, knots)
  return group
}
