import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
} from 'three'
import { buildEngawa } from '../builders/house/engawa'
import { buildFacade } from '../builders/house/facade'
import { buildKawaraRoof } from '../builders/house/roof'
import { GroundBuilder } from '../builders/garden/ground'
import type { Flags } from '../core/flags'
import { deriveRng } from '../core/rng'
import { createGoldenHourRig } from '../lighting/GoldenHourRig'
import { createMatKit, type MatKit } from '../materials/matkit'
import { makeGroundMaterial } from '../materials/materials'
import { TextureRegistry } from '../materials/TextureRegistry'
import {
  EAVE_LINE_Z,
  ENGAWA_EAST_X,
  ENGAWA_FRONT_Z,
  ENGAWA_WEST_X,
  FENCE_WEST_X,
  HOUSE_EAST_X,
  HOUSE_WALL_Z,
  HOUSE_WEST_X,
  KEN,
  RAIN_GRAVEL_W,
} from './layout'

export interface SceneHandles {
  playerRoot: Mesh
  ground: GroundBuilder
  registry: TextureRegistry
  kit: MatKit
}

/** Assembles the whole world. Build order matters: object builders stamp
 * their footprints into the ground before its geometry bakes. */
export function buildGardenScene(scene: Scene, flags: Flags): SceneHandles {
  createGoldenHourRig(scene, flags)

  const registry = new TextureRegistry(flags.seed, flags)
  const kit = createMatKit(registry)
  const rng = deriveRng(flags.seed, 'scene')
  const ground = new GroundBuilder(flags.seed)

  // --- 家側 ---------------------------------------------------------------
  scene.add(buildEngawa(kit, deriveRng(flags.seed, 'engawa')))
  scene.add(buildFacade(kit, deriveRng(flags.seed, 'facade')))
  scene.add(buildKawaraRoof(kit, deriveRng(flags.seed, 'roof')))

  // 束石の沈み込み（縁側の支点） / 縁の下の湿った暗がり
  for (let k = 0; k <= Math.round((ENGAWA_EAST_X - ENGAWA_WEST_X) / KEN); k++) {
    ground.addDepression(ENGAWA_WEST_X + k * KEN, ENGAWA_FRONT_Z - 0.09, 0.22, 0.015)
  }
  ground.addShade((ENGAWA_WEST_X + ENGAWA_EAST_X) / 2, HOUSE_WALL_Z + 0.4, 1.9, 0.5)

  // --- 雨落ちの砂利帯（軒先の投影線直下＝雨だれの必然の位置） -------------
  const gravelStrip = buildRainGravel(kit, ground)
  scene.add(gravelStrip)

  // 軒の雨垂れは土を締める: 砂利帯に沿って浅い凹みと湿り
  for (let x = HOUSE_WEST_X + 0.4; x < HOUSE_EAST_X; x += 0.8) {
    ground.addDepression(x + (rng() - 0.5) * 0.2, EAVE_LINE_Z + (rng() - 0.5) * 0.06, 0.3, 0.008)
    ground.addShade(x + (rng() - 0.5) * 0.3, EAVE_LINE_Z, 0.34, 0.28)
  }

  // 家の北西の陰は苔がのる（太陽が届かない場所という根拠）
  ground.addMoss(HOUSE_WEST_X + 0.8, ENGAWA_FRONT_Z + 0.5, 1.1, 0.55)
  ground.addMoss(FENCE_WEST_X + 0.5, -2.4, 0.9, 0.4)
  ground.addMoss(FENCE_WEST_X + 0.9, -3.4, 0.7, 0.5)

  // --- 地面（最後に焼く: 上のスタンプを反映） -----------------------------
  const groundMesh = new Mesh(ground.buildGeometry(), makeGroundMaterial(registry))
  groundMesh.receiveShadow = true
  groundMesh.name = 'ground'
  scene.add(groundMesh)

  // --- 奥行き検証用の中景・遠景プロキシ（M5で実ジオメトリに置換） ---------
  const proxies = new Group()
  proxies.name = 'backdropProxies'
  const proxyMat = new MeshStandardMaterial({ color: '#8a8274', roughness: 0.95 })
  const mid = new Mesh(new BoxGeometry(7, 4.5, 7), proxyMat)
  mid.position.set(-16, 2.25, -26)
  const far = new Mesh(new PlaneGeometry(400, 90), proxyMat)
  far.position.set(0, 45, -420)
  proxies.add(mid, far)
  scene.add(proxies)

  // --- プレイヤーの仮置き（M6で本リグに置換） -----------------------------
  const playerRoot = new Mesh(
    new BoxGeometry(0.4, 1.3, 0.3),
    new MeshStandardMaterial({ color: '#3a4a6b', roughness: 0.9 }),
  )
  playerRoot.castShadow = true
  playerRoot.position.y = 0.65
  scene.add(playerRoot)

  return { playerRoot, ground, registry, kit }
}

/** 砂利の雨落ち帯: 起伏に沿う細長いリボン、縁は不規則。 */
function buildRainGravel(kit: MatKit, ground: GroundBuilder): Mesh {
  const from = HOUSE_WEST_X
  const to = HOUSE_EAST_X
  const seg = 64
  const geo = new PlaneGeometry(to - from, RAIN_GRAVEL_W, seg, 2)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.getAttribute('position')
  const uv = geo.getAttribute('uv')
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + (from + to) / 2
    const z = pos.getZ(i) + EAVE_LINE_Z
    // 端の行だけ幅を波打たせる（敷いた砂利は定規で切れない）
    const isEdge = Math.abs(pos.getZ(i)) > RAIN_GRAVEL_W * 0.49
    const wobble = isEdge ? Math.sin(x * 7.3) * 0.02 + Math.sin(x * 2.9) * 0.03 : 0
    const zz = z + Math.sign(pos.getZ(i)) * wobble
    pos.setXYZ(i, x, ground.heightAt(x, zz) + 0.014, zz)
    uv.setXY(i, x, zz)
  }
  geo.computeVertexNormals()
  const mesh = new Mesh(geo, kit.gravel)
  mesh.receiveShadow = true
  mesh.name = 'rainGravel'
  return mesh
}
