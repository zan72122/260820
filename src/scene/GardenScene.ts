import { Mesh, PlaneGeometry, Scene } from 'three'
import { buildPlayerRig, type RigJoints } from '../character/PlayerRig'
import { buildEngawa } from '../builders/house/engawa'
import { buildFacade } from '../builders/house/facade'
import { buildKawaraRoof } from '../builders/house/roof'
import { buildItabei } from '../builders/fence/itabei'
import { buildTakegaki } from '../builders/fence/takegaki'
import { GroundBuilder } from '../builders/garden/ground'
import { buildLantern } from '../builders/garden/lantern'
import { buildTobiishi } from '../builders/garden/tobiishi'
import { buildKakiTree, type TreeHandles } from '../builders/garden/tree'
import { buildTsukubai } from '../builders/garden/tsukubai'
import { buildVegBeds, type VegBedHandles } from '../builders/garden/vegBed'
import { buildClutter } from '../builders/props/clutter'
import { buildTools, type ToolHandles } from '../builders/props/tools'
import { buildMidLayer } from '../builders/backdrop/midLayer'
import { buildSatoyama } from '../builders/backdrop/satoyama'
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
  FENCE_SOUTH_Z,
  FENCE_WEST_X,
  GATE_CENTER_X,
  HOUSE_EAST_X,
  HOUSE_WALL_Z,
  HOUSE_WEST_X,
  KEN,
  RAIN_GRAVEL_W,
  TOBIISHI_PATH,
} from './layout'

export interface SceneHandles {
  player: RigJoints
  ground: GroundBuilder
  registry: TextureRegistry
  kit: MatKit
  vegBeds: VegBedHandles
  tree: TreeHandles
  tools: ToolHandles
}

/** Assembles the whole world. Build order matters: object builders stamp
 * their footprints into the ground before its geometry bakes.
 * `deps` lets Node unit tests inject DOM-free materials (stub kit) and hash
 * the whole scene for seed determinism. */
export function buildGardenScene(
  scene: Scene,
  flags: Flags,
  deps: {
    kit?: MatKit
    groundMaterial?: import('three').MeshStandardMaterial
  } = {},
): SceneHandles {
  createGoldenHourRig(scene, flags)

  const registry = new TextureRegistry(flags.seed, flags)
  const kit = deps.kit ?? createMatKit(registry)
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

  // --- 庭の近景 -----------------------------------------------------------
  scene.add(buildTobiishi(kit, deriveRng(flags.seed, 'tobiishi'), ground))
  scene.add(buildItabei(kit, deriveRng(flags.seed, 'itabei'), ground))
  scene.add(buildTakegaki(kit, deriveRng(flags.seed, 'takegaki'), ground))
  const vegBeds = buildVegBeds(kit, deriveRng(flags.seed, 'vegbeds'), ground)
  scene.add(vegBeds.group)
  scene.add(buildTsukubai(kit, deriveRng(flags.seed, 'tsukubai'), ground))
  scene.add(buildLantern(kit, deriveRng(flags.seed, 'lantern'), ground))
  const tree = buildKakiTree(kit, deriveRng(flags.seed, 'tree'), ground)
  scene.add(tree.group)
  const tools = buildTools(kit, deriveRng(flags.seed, 'tools'), ground)
  scene.add(tools.group)
  scene.add(buildClutter(kit, deriveRng(flags.seed, 'clutter'), ground))

  // 木戸から縁側への動線: 毎日歩く道は草が禿げて土が締まる
  for (const p of TOBIISHI_PATH) ground.addWear(p.x, p.z, 0.55, 0.22)
  ground.addWear(GATE_CENTER_X, FENCE_SOUTH_Z - 0.5, 0.6, 0.4)
  // 塀の際は人が歩かず、雨だれで湿る
  for (let z = -3.5; z < FENCE_SOUTH_Z - 0.4; z += 1.1) {
    ground.addMoss(FENCE_WEST_X + 0.28 + (rng() - 0.5) * 0.15, z + rng() * 0.4, 0.4, 0.3)
  }

  // --- 地面（最後に焼く: 上のスタンプを反映） -----------------------------
  const groundMesh = new Mesh(
    ground.buildGeometry(),
    deps.groundMaterial ?? makeGroundMaterial(registry),
  )
  groundMesh.receiveShadow = true
  groundMesh.name = 'ground'
  scene.add(groundMesh)

  // --- 中景・遠景 ---------------------------------------------------------
  scene.add(buildMidLayer(kit, deriveRng(flags.seed, 'midlayer')))
  scene.add(buildSatoyama(flags.seed))

  // --- プレイヤー ---------------------------------------------------------
  const player = buildPlayerRig(kit, deriveRng(flags.seed, 'player'))
  scene.add(player.root)

  return { player, ground, registry, kit, vegBeds, tree, tools }
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
