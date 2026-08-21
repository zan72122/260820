import {
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
} from 'three'
import type { Rng } from '../../core/rng'
import type { MatKit } from '../../materials/matkit'
import { TSUKUBAI } from '../../scene/layout'
import { mergeParts, offsetUvs, setVertexColor, tintJitter } from '../util/geo'
import { makeStone } from '../util/stone'
import type { GroundBuilder } from './ground'

/**
 * 蹲踞: 手水鉢（φ450×H300）＋柄杓＋前石。鉢の水は張ってあり、
 * 縁と足元の石は常に濡れて暗い — 水場の必然の汚れ。
 */
export function buildTsukubai(kit: MatKit, rng: Rng, ground: GroundBuilder): Group {
  const group = new Group()
  group.name = 'tsukubai'
  const gy = ground.heightAt(TSUKUBAI.x, TSUKUBAI.z)

  // --- 鉢: 上面を大きく削った石 ------------------------------------------
  const basin = makeStone(rng, {
    radius: TSUKUBAI.d / 2,
    height: TSUKUBAI.h + 0.05,
    irregularity: 0.15,
    topFlatten: 0.92,
    mossiness: 0.6,
    soilRingH: 0.05,
    baseColor: '#767068',
  })
  basin.translate(TSUKUBAI.x, gy - 0.05, TSUKUBAI.z)
  const basinMesh = new Mesh(basin, kit.stone)
  basinMesh.castShadow = true
  basinMesh.receiveShadow = true
  group.add(basinMesh)

  // 水穴の縁（濡れ色の暗いリング）と水面
  const rimGeo = new TorusGeometry(0.13, 0.022, 8, 20)
  rimGeo.rotateX(Math.PI / 2)
  setVertexColor(rimGeo, new Color('#3f3c37'))
  rimGeo.translate(TSUKUBAI.x, gy + TSUKUBAI.h - 0.015, TSUKUBAI.z)
  offsetUvs(rimGeo, rng(), rng())
  const rim = new Mesh(rimGeo, kit.stone)
  group.add(rim)

  const waterGeo = new CylinderGeometry(0.125, 0.125, 0.005, 20)
  waterGeo.translate(TSUKUBAI.x, gy + TSUKUBAI.h - 0.025, TSUKUBAI.z)
  const water = new Mesh(
    waterGeo,
    new MeshStandardMaterial({
      color: '#1d221f',
      roughness: 0.06,
      metalness: 0,
    }),
  )
  water.name = 'water'
  group.add(water)

  // --- 柄杓: 鉢に渡して置く ----------------------------------------------
  const ladleParts = []
  const cup = new CylinderGeometry(0.045, 0.04, 0.06, 10, 1, true)
  setVertexColor(cup, tintJitter(rng, '#c4b184', 0.05))
  cup.translate(0.1, 0.03, 0)
  ladleParts.push(cup)
  const cupBottom = new CylinderGeometry(0.04, 0.04, 0.008, 10)
  setVertexColor(cupBottom, tintJitter(rng, '#b3a173', 0.05))
  cupBottom.translate(0.1, 0.004, 0)
  ladleParts.push(cupBottom)
  const handle = new CylinderGeometry(0.008, 0.008, 0.36, 8)
  setVertexColor(handle, tintJitter(rng, '#c4b184', 0.05))
  handle.rotateZ(Math.PI / 2)
  handle.translate(-0.1, 0.035, 0)
  ladleParts.push(handle)
  for (const p of ladleParts) offsetUvs(p, rng(), rng())
  const ladle = new Mesh(mergeParts(ladleParts), kit.bamboo)
  ladle.castShadow = true
  ladle.position.set(TSUKUBAI.x, gy + TSUKUBAI.h, TSUKUBAI.z)
  ladle.rotation.y = 0.6
  group.add(ladle)

  // --- 前石（手前に立つ足場の平石） ---------------------------------------
  const mae = makeStone(rng, {
    radius: 0.19,
    height: 0.09,
    irregularity: 0.2,
    topFlatten: 0.85,
    mossiness: 0.3,
  })
  const maeX = TSUKUBAI.x - 0.12
  const maeZ = TSUKUBAI.z + 0.42
  mae.translate(maeX, ground.heightAt(maeX, maeZ) - 0.045, maeZ)
  const maeMesh = new Mesh(mae, kit.stone)
  maeMesh.castShadow = true
  maeMesh.receiveShadow = true
  group.add(maeMesh)

  // 水場の足元: 湿った暗がり＋苔、常に踏まれる
  ground.addDepression(TSUKUBAI.x, TSUKUBAI.z, TSUKUBAI.d * 0.8, 0.018)
  ground.addShade(TSUKUBAI.x, TSUKUBAI.z + 0.15, 0.5, 0.5)
  ground.addMoss(TSUKUBAI.x - 0.25, TSUKUBAI.z - 0.2, 0.35, 0.6)
  ground.addWear(maeX, maeZ + 0.1, 0.4, 0.5)

  return group
}
