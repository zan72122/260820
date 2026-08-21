import {
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import type { Rng } from '../../core/rng'
import { rngRange } from '../../core/rng'
import type { MatKit } from '../../materials/matkit'
import { KAKI_TREE } from '../../scene/layout'
import { mergeParts, offsetUvs, setVertexColor, tintJitter } from '../util/geo'
import type { GroundBuilder } from './ground'

export interface TreeHandles {
  group: Group
  /** 手の届く低枝の実（M7で収穫対象になる） */
  lowFruits: Map<string, Mesh>
}

/**
 * 柿の木: 幹φ180・樹高3.5m。秋の夕方 — 葉は残り少なく、実が透ける。
 * 幹は僅かに傾いて湾曲（真っ直ぐな果樹は存在しない）。西側に立ち、
 * 長い影を庭に落とす。
 */
export function buildKakiTree(kit: MatKit, rng: Rng, ground: GroundBuilder): TreeHandles {
  const group = new Group()
  group.name = 'kakiTree'
  const gy = ground.heightAt(KAKI_TREE.x, KAKI_TREE.z)
  group.position.set(KAKI_TREE.x, gy, KAKI_TREE.z)

  const trunkParts = []
  const leafParts = []
  const fruitParts = []
  const lowFruits = new Map<string, Mesh>()

  // --- 幹: 湾曲するセグメント列 ------------------------------------------
  const segments = 4
  let base = new Vector3(0, -0.05, 0)
  let dir = new Vector3(0.06, 1, 0.03).normalize()
  let radius = KAKI_TREE.trunkD / 2
  const trunkTop: Vector3[] = []
  for (let s = 0; s < segments; s++) {
    const len = (KAKI_TREE.height * 0.55) / segments
    const nextR = radius * 0.82
    const seg = new CylinderGeometry(nextR, radius, len, 10, 1)
    seg.translate(0, len / 2, 0)
    seg.applyMatrix4(alignYTo(dir))
    seg.translate(base.x, base.y, base.z)
    setVertexColor(seg, tintJitter(rng, '#584c40', 0.05))
    offsetUvs(seg, rng() * 2, rng() * 2)
    trunkParts.push(seg)
    base = base.clone().addScaledVector(dir, len)
    dir = dir
      .clone()
      .add(new Vector3((rng() - 0.5) * 0.25, 0, (rng() - 0.5) * 0.25))
      .normalize()
    radius = nextR
  }
  trunkTop.push(base.clone())

  // --- 主枝: 3〜4本が上外へ ---------------------------------------------
  const branchEnds: Vector3[] = []
  const nBranch = 3 + Math.floor(rng() * 2)
  for (let b = 0; b < nBranch; b++) {
    const a = (b / nBranch) * Math.PI * 2 + rng() * 0.8
    let bDir = new Vector3(Math.sin(a) * 0.8, 0.85 + rng() * 0.3, Math.cos(a) * 0.8).normalize()
    let bBase = base.clone()
    let bR = radius * 0.75
    for (let s = 0; s < 3; s++) {
      const len = rngRange(rng, 0.5, 0.75) * (1 - s * 0.18)
      const nextR = bR * 0.7
      const seg = new CylinderGeometry(nextR, bR, len, 7, 1)
      seg.translate(0, len / 2, 0)
      seg.applyMatrix4(alignYTo(bDir))
      seg.translate(bBase.x, bBase.y, bBase.z)
      setVertexColor(seg, tintJitter(rng, '#5d5145', 0.06))
      offsetUvs(seg, rng() * 2, rng() * 2)
      trunkParts.push(seg)
      bBase = bBase.clone().addScaledVector(bDir, len)
      bDir = bDir
        .clone()
        .add(new Vector3((rng() - 0.5) * 0.5, 0.1 + rng() * 0.15, (rng() - 0.5) * 0.5))
        .normalize()
      bR = nextR
    }
    branchEnds.push(bBase)
  }
  // 低枝: 収穫の手が届く高さへ一本下ろす
  {
    let bDir = new Vector3(0.9, 0.12, 0.35).normalize()
    let bBase = new Vector3(0.05, 1.35, 0.02)
    let bR = radius * 0.68
    for (let s = 0; s < 2; s++) {
      const len = 0.65
      const nextR = bR * 0.65
      const seg = new CylinderGeometry(nextR, bR, len, 7, 1)
      seg.translate(0, len / 2, 0)
      seg.applyMatrix4(alignYTo(bDir))
      seg.translate(bBase.x, bBase.y, bBase.z)
      setVertexColor(seg, tintJitter(rng, '#5d5145', 0.06))
      offsetUvs(seg, rng(), rng())
      trunkParts.push(seg)
      bBase = bBase.clone().addScaledVector(bDir, len)
      bDir = bDir.clone().add(new Vector3(0.15, -0.1, 0.1)).normalize()
      bR = nextR
    }
    branchEnds.push(bBase)
  }

  const trunk = new Mesh(mergeParts(trunkParts), kit.bark)
  trunk.castShadow = true
  trunk.receiveShadow = true
  group.add(trunk)

  // --- 葉: 秋の名残の葉群（枝先のクラスタ、橙〜緑のばらつき） -------------
  const leafColors = ['#7d6a2f', '#96622c', '#a54f26', '#6b7034']
  for (const end of branchEnds) {
    const n = 26 + Math.floor(rng() * 10)
    for (let i = 0; i < n; i++) {
      const leaf = kakiLeaf(rng)
      // 枝先の房にまとまる（葉は梢に残るという秋の実際）
      const off = new Vector3(
        (rng() - 0.5) * 0.55,
        (rng() - 0.35) * 0.35,
        (rng() - 0.5) * 0.55,
      )
      leaf.rotateX(rng() * Math.PI - Math.PI / 2)
      leaf.rotateY(rng() * Math.PI * 2)
      leaf.translate(end.x + off.x, end.y + off.y, end.z + off.z)
      const c = leafColors[Math.floor(rng() * leafColors.length)] as string
      setVertexColor(leaf, tintJitter(rng, c, 0.08))
      leafParts.push(leaf)
    }
  }
  const leaves = new Mesh(
    mergeParts(leafParts),
    new MeshStandardMaterial({ roughness: 0.8, vertexColors: true, side: 2 }),
  )
  leaves.castShadow = true
  group.add(leaves)

  // --- 実: 高い実＋低枝の実（収穫対象） -----------------------------------
  const fruitMat = new MeshStandardMaterial({ roughness: 0.4, vertexColors: true })
  for (const end of branchEnds.slice(0, branchEnds.length - 1)) {
    const n = 2 + Math.floor(rng() * 3)
    for (let i = 0; i < n; i++) {
      const f = new SphereGeometry(0.035, 10, 8)
      f.scale(1, 0.85, 1)
      setVertexColor(f, tintJitter(rng, '#d2691e', 0.07))
      f.translate(
        end.x + (rng() - 0.5) * 0.35,
        end.y - 0.08 - rng() * 0.18,
        end.z + (rng() - 0.5) * 0.35,
      )
      offsetUvs(f, rng(), rng())
      fruitParts.push(f)
    }
  }
  const fruits = new Mesh(mergeParts(fruitParts), fruitMat)
  fruits.castShadow = true
  group.add(fruits)

  // 低枝の実は個別メッシュ（収穫で消える）
  const lowEnd = branchEnds[branchEnds.length - 1] as Vector3
  for (const [id, off] of [
    ['kaki1', new Vector3(-0.12, -0.18, 0.06)],
    ['kaki2', new Vector3(0.1, -0.22, -0.08)],
  ] as const) {
    const f = new SphereGeometry(0.038, 10, 8)
    f.scale(1, 0.85, 1)
    setVertexColor(f, tintJitter(rng, '#d2691e', 0.05))
    offsetUvs(f, rng(), rng())
    const m = new Mesh(f, fruitMat)
    m.position.copy(lowEnd).add(off)
    m.castShadow = true
    m.name = `crop:${id}`
    lowFruits.set(id, m)
    group.add(m)
  }

  // 根元: 根張りの盛り上がりは設置痕の逆（僅かな盛土）で表現し、
  // 落ち葉の腐植で根元は暗い
  ground.addDepression(KAKI_TREE.x, KAKI_TREE.z, 0.5, -0.03)
  ground.addShade(KAKI_TREE.x, KAKI_TREE.z, 0.7, 0.3)
  ground.addMoss(KAKI_TREE.x - 0.3, KAKI_TREE.z - 0.3, 0.5, 0.35)

  return { group, lowFruits }
}

/** 柿の葉: 丸みのある大きめの葉（2面）。 */
function kakiLeaf(rng: Rng) {
  const len = 0.13 + rng() * 0.05
  const w = len * 0.62
  const geo = new SphereGeometry(0.5, 6, 4)
  geo.scale(w, 0.02, len)
  return geo
}

/** y軸単位ベクトルを任意方向へ向ける回転行列。 */
function alignYTo(dir: Vector3): Matrix4 {
  const up = new Vector3(0, 1, 0)
  const d = dir.clone().normalize()
  const axis = new Vector3().crossVectors(up, d)
  const angle = Math.acos(Math.max(-1, Math.min(1, up.dot(d))))
  if (axis.lengthSq() < 1e-10) {
    return new Matrix4()
  }
  return new Matrix4().makeRotationAxis(axis.normalize(), angle)
}
