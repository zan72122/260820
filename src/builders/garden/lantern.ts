import { Color, ConeGeometry, Group, Mesh, SphereGeometry } from 'three'
import type { Rng } from '../../core/rng'
import type { MatKit } from '../../materials/matkit'
import { LANTERN, sunDirection } from '../../scene/layout'
import { chamferBox, mergeParts, moveGeo, offsetUvs, setVertexColor, tintJitter } from '../util/geo'
import type { GroundBuilder } from './ground'

/**
 * 織部灯籠: 竿を直接土に埋める形式。蹲踞を照らすという役割で
 * 蹲の傍らに立つ（用途のある点景）。竿120角・全高1200。
 * 北面には苔、足元は土に沈む。
 */
export function buildLantern(kit: MatKit, rng: Rng, ground: GroundBuilder): Group {
  const group = new Group()
  group.name = 'lantern'
  const gy = ground.heightAt(LANTERN.x, LANTERN.z)
  const parts = []

  const stoneTint = () => tintJitter(rng, '#807b72', 0.05)

  // 竿（埋め込み分を含む）
  const shaftH = LANTERN.h * 0.55
  const shaft = chamferBox(LANTERN.shaftSq, shaftH + 0.1, LANTERN.shaftSq, 0.006)
  setVertexColor(shaft, stoneTint())
  moveGeo(shaft, 0, shaftH / 2 - 0.05, 0)
  parts.push(shaft)

  // 中台（火袋の受け）
  const chudai = chamferBox(LANTERN.shaftSq * 1.7, 0.06, LANTERN.shaftSq * 1.7, 0.01)
  setVertexColor(chudai, stoneTint())
  moveGeo(chudai, 0, shaftH + 0.03, 0)
  parts.push(chudai)

  // 火袋（四面に火口の暗い開口）
  const hibukuroH = 0.2
  const hibukuro = chamferBox(LANTERN.shaftSq * 1.35, hibukuroH, LANTERN.shaftSq * 1.35, 0.008)
  setVertexColor(hibukuro, stoneTint())
  moveGeo(hibukuro, 0, shaftH + 0.06 + hibukuroH / 2, 0)
  parts.push(hibukuro)

  // 笠（四角錘、軒の反りは僅かに）
  const kasa = new ConeGeometry(LANTERN.shaftSq * 1.6, 0.14, 4)
  kasa.rotateY(Math.PI / 4)
  setVertexColor(kasa, stoneTint())
  kasa.translate(0, shaftH + 0.06 + hibukuroH + 0.07, 0)
  parts.push(kasa)

  // 宝珠
  const hoju = new SphereGeometry(0.045, 10, 8)
  setVertexColor(hoju, stoneTint())
  hoju.translate(0, shaftH + 0.06 + hibukuroH + 0.16, 0)
  parts.push(hoju)

  // 火口の暗い開口（四面）
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2
    const win = chamferBox(0.07, 0.09, 0.012, 0.002)
    setVertexColor(win, new Color('#151310'))
    win.rotateY(a)
    win.translate(
      Math.sin(a) * (LANTERN.shaftSq * 0.68),
      shaftH + 0.06 + hibukuroH / 2,
      Math.cos(a) * (LANTERN.shaftSq * 0.68),
    )
    parts.push(win)
  }

  for (const p of parts) offsetUvs(p, rng(), rng())

  // 北面の苔: 太陽の当たらない側の下半分を緑に寄せる
  const sun = sunDirection()
  const mossC = new Color('#5d6b3c')
  const tmp = new Color()
  for (const p of parts) {
    const pos = p.getAttribute('position')
    const nor = p.getAttribute('normal')
    const col = p.getAttribute('color')
    for (let i = 0; i < pos.count; i++) {
      const facing = -(nor.getX(i) * sun.x + nor.getZ(i) * sun.z)
      const low = Math.max(0, 1 - pos.getY(i) / (LANTERN.h * 0.6))
      const amt = Math.max(0, facing) * low * 0.5
      if (amt > 0.02) {
        tmp.setRGB(col.getX(i), col.getY(i), col.getZ(i))
        tmp.lerp(mossC, Math.min(0.7, amt))
        col.setXYZ(i, tmp.r, tmp.g, tmp.b)
      }
    }
  }

  const mesh = new Mesh(mergeParts(parts), kit.stone)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.position.set(LANTERN.x, gy, LANTERN.z)
  group.add(mesh)

  ground.addDepression(LANTERN.x, LANTERN.z, 0.16, 0.012)
  ground.addMoss(LANTERN.x - 0.12, LANTERN.z - 0.14, 0.22, 0.5)
  return group
}
