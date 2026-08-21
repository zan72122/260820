import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three'
import type { Rng } from '../../core/rng'
import type { MatKit } from '../../materials/matkit'
import { BED_H, BED_L, BED_W, BEDS, CROPS } from '../../scene/layout'
import { mergeParts, moveGeo, offsetUvs, setVertexColor, tintJitter } from '../util/geo'
import type { GroundBuilder } from './ground'

export interface VegBedHandles {
  group: Group
  /** 畝id → 土のマテリアル（uMoisture uniform で湿りを可視化） */
  bedMaterials: Map<string, MeshStandardMaterial>
  /** 作物id → そのままのグループ / 収穫後に現れる穴 */
  cropGroups: Map<string, Group>
}

/**
 * 菜園: 畝（900×1800×H180、南北方向）と作物。
 * 大根は葉のロゼットと白い肩、葱は細い束、トマトは支柱＋誘引紐。
 * 畝の土は水やりで暗く湿る（uMoisture、シェーダは makeBedSoil で注入）。
 */
export function buildVegBeds(kit: MatKit, rng: Rng, ground: GroundBuilder): VegBedHandles {
  const group = new Group()
  group.name = 'vegBeds'
  const bedMaterials = new Map<string, MeshStandardMaterial>()
  const cropGroups = new Map<string, Group>()

  for (const bed of BEDS) {
    const gy = ground.heightAt(bed.x, bed.z)
    const soil = makeBedSoil(kit)
    bedMaterials.set(bed.id, soil)
    const mesh = new Mesh(buildMound(rng), soil)
    mesh.position.set(bed.x, gy, bed.z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    // 畝は土を盛った分だけ周囲が踏まれる
    ground.addWear(bed.x - BED_W / 2 - 0.2, bed.z, 0.35, 0.4)
    ground.addWear(bed.x + BED_W / 2 + 0.2, bed.z, 0.35, 0.4)
    ground.addShade(bed.x, bed.z, BED_W * 0.8, 0.15)
  }

  for (const crop of CROPS) {
    const gy = ground.heightAt(crop.x, crop.z) + BED_H
    const g = new Group()
    g.name = `crop:${crop.id}`
    g.position.set(crop.x, gy, crop.z)
    if (crop.kind === 'daikon') buildDaikon(g, kit, rng)
    else if (crop.kind === 'negi') buildNegi(g, kit, rng)
    else buildTomato(g, kit, rng)
    cropGroups.set(crop.id, g)
    group.add(g)
  }

  return { group, bedMaterials, cropGroups }
}

/** 畝: 台形断面＋耕した端の緩み。 */
function buildMound(rng: Rng): BufferGeometry {
  const nx = 12
  const nz = 20
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (let iz = 0; iz <= nz; iz++) {
    for (let ix = 0; ix <= nx; ix++) {
      const u = ix / nx
      const v = iz / nz
      const x = (u - 0.5) * (BED_W + 0.24)
      const z = (v - 0.5) * (BED_L + 0.24)
      // 台形: 肩は丸く、裾は地面へ溶ける
      const edgeX = Math.min(1, (0.5 - Math.abs(u - 0.5)) * 4)
      const edgeZ = Math.min(1, (0.5 - Math.abs(v - 0.5)) * 4)
      const profile = Math.min(edgeX, 1) * Math.min(edgeZ, 1)
      const soft = profile * profile * (3 - 2 * profile)
      let y = BED_H * soft
      // 耕した畝の細かい起伏
      y += (rng() - 0.5) * 0.012 * soft
      positions.push(x, y, z)
      uvs.push(x, z)
    }
  }
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const a = iz * (nx + 1) + ix
      const b = a + 1
      const c = a + nx + 1
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/** 畝の土: soilTilled ＋ uMoisture（0..1）で湿りの暗色化。 */
function makeBedSoil(kit: MatKit): MeshStandardMaterial {
  const mat = kit.soilTilled.clone()
  const uniform = { value: 0 }
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uMoisture = uniform
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uMoisture;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         // 濡れた土: 暗く彩度が上がり、艶が出る。じょうろの掛かり方は
         // 不均一なので、タイル模様を流用したまだら係数を掛ける。
         float wetPatch = clamp(uMoisture * (0.75 + 0.5 * fract(sin(dot(floor(vMapUv * 9.0), vec2(12.9898, 78.233))) * 43758.5453)), 0.0, 1.0);
         diffuseColor.rgb *= 1.0 - 0.45 * wetPatch;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.6, uMoisture);`,
      )
  }
  // SceneSync から uniform に触るためのフック
  mat.userData.moistureUniform = uniform
  return mat
}

function leafMaterial(kit: MatKit): MeshStandardMaterial {
  void kit
  return new MeshStandardMaterial({
    color: '#54682f',
    roughness: 0.85,
    vertexColors: true,
  })
}

/** 葉body: 中肋で軽く折れた菱形の葉。 */
function leafGeo(rng: Rng, len: number, w: number): BufferGeometry {
  const bend = 0.25 + rng() * 0.3
  const positions = new Float32Array([
    0, 0, 0,
    w / 2, len * 0.12, len * 0.45,
    0, len * bend * 0.4, len,
    -w / 2, len * 0.12, len * 0.45,
  ])
  const indices = [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(positions, 3))
  geo.setAttribute(
    'uv',
    new BufferAttribute(new Float32Array([0.5, 0, 1, 0.5, 0.5, 1, 0, 0.5]), 2),
  )
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

function buildDaikon(g: Group, kit: MatKit, rng: Rng): void {
  const leaves = []
  const n = 7 + Math.floor(rng() * 3)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.5
    const leaf = leafGeo(rng, 0.32 + rng() * 0.1, 0.09)
    leaf.rotateX(-0.5 - rng() * 0.5)
    leaf.rotateY(a)
    setVertexColor(leaf, tintJitter(rng, '#5a7034', 0.08))
    leaves.push(leaf)
  }
  const leafMesh = new Mesh(mergeParts(leaves), leafMaterial(kit))
  leafMesh.castShadow = true
  leafMesh.name = 'leaves'
  g.add(leafMesh)
  // 熟した白い肩（土から覗く）
  const shoulder = new CylinderGeometry(0.035, 0.042, 0.07, 10)
  setVertexColor(shoulder, new Color('#e8e4d8'))
  moveGeo(shoulder, 0, 0.02, 0)
  offsetUvs(shoulder, rng(), rng())
  const shoulderMesh = new Mesh(shoulder, kit.stone)
  shoulderMesh.name = 'shoulder'
  g.add(shoulderMesh)
  // 収穫後の穴（初期は非表示）
  const hole = new CylinderGeometry(0.05, 0.035, 0.05, 10, 1, true)
  setVertexColor(hole, new Color('#241b12'))
  moveGeo(hole, 0, -0.01, 0)
  const holeMesh = new Mesh(hole, kit.stone)
  holeMesh.name = 'hole'
  holeMesh.visible = false
  g.add(holeMesh)
}

function buildNegi(g: Group, kit: MatKit, rng: Rng): void {
  const stalks = []
  const n = 8
  for (let i = 0; i < n; i++) {
    const px = (rng() - 0.5) * 0.16
    const pz = (rng() - 0.5) * 0.4
    const h = 0.32 + rng() * 0.1
    const s = new CylinderGeometry(0.006, 0.009, h, 6)
    const green = tintJitter(rng, '#5f7d3a', 0.06)
    const white = new Color('#e6e2d2')
    const pos = s.getAttribute('position')
    const col = new Float32Array(pos.count * 3)
    const tmp = new Color()
    for (let v = 0; v < pos.count; v++) {
      const t = pos.getY(v) / h + 0.5
      tmp.copy(white).lerp(green, Math.min(1, t * 2.2))
      col[v * 3] = tmp.r
      col[v * 3 + 1] = tmp.g
      col[v * 3 + 2] = tmp.b
    }
    s.setAttribute('color', new BufferAttribute(col, 3))
    s.rotateX((rng() - 0.5) * 0.15)
    s.rotateZ((rng() - 0.5) * 0.15)
    s.translate(px, h / 2 - 0.02, pz)
    offsetUvs(s, rng(), rng())
    stalks.push(s)
  }
  const mesh = new Mesh(mergeParts(stalks), leafMaterial(kit))
  mesh.castShadow = true
  mesh.name = 'leaves'
  g.add(mesh)
}

function buildTomato(g: Group, kit: MatKit, rng: Rng): void {
  // 支柱: 竹φ16×1800（250mm 埋め込み）
  const stake = new CylinderGeometry(0.008, 0.008, 1.8, 8)
  setVertexColor(stake, tintJitter(rng, '#b0995c', 0.05))
  moveGeo(stake, 0.03, 0.65, 0)
  offsetUvs(stake, rng(), rng())
  const stakeMesh = new Mesh(stake, kit.bamboo)
  stakeMesh.castShadow = true
  g.add(stakeMesh)

  // 主茎（支柱に沿って僅かに蛇行）
  const stemParts = []
  let sy = 0
  let sx = -0.02
  while (sy < 1.05) {
    const seg = new CylinderGeometry(0.007, 0.009, 0.24, 6)
    const lean = (rng() - 0.5) * 0.2
    seg.rotateZ(lean)
    seg.translate(sx, sy + 0.11, 0)
    setVertexColor(seg, tintJitter(rng, '#4f6631', 0.06))
    offsetUvs(seg, rng(), rng())
    stemParts.push(seg)
    sy += 0.22
    sx += lean * -0.05
  }
  // 誘引の麻紐（支柱と茎を束ねる小さな結び）
  for (const ty of [0.35, 0.75]) {
    const tie = new CylinderGeometry(0.016, 0.016, 0.02, 8)
    tie.rotateX(Math.PI / 2)
    setVertexColor(tie, new Color('#8a7a55'))
    tie.rotateZ(Math.PI / 2)
    tie.translate(0.008, ty, 0)
    offsetUvs(tie, rng(), rng())
    stemParts.push(tie)
  }
  const stems = new Mesh(mergeParts(stemParts), leafMaterial(kit))
  stems.castShadow = true
  stems.name = 'leaves'
  g.add(stems)

  // 葉
  const leaves = []
  for (let i = 0; i < 9; i++) {
    const leaf = leafGeo(rng, 0.16 + rng() * 0.07, 0.07)
    leaf.rotateX(-0.4 - rng() * 0.6)
    leaf.rotateY(rng() * Math.PI * 2)
    leaf.translate((rng() - 0.5) * 0.1, 0.3 + rng() * 0.7, (rng() - 0.5) * 0.1)
    setVertexColor(leaf, tintJitter(rng, '#4f6631', 0.09))
    leaves.push(leaf)
  }
  const leafMesh = new Mesh(mergeParts(leaves), leafMaterial(kit))
  leafMesh.castShadow = true
  g.add(leafMesh)

  // 実: 熟れた赤1つ＋青い実2つ
  const fruits = new Group()
  fruits.name = 'fruits'
  const mkFruit = (color: string, y: number, ox: number, oz: number, r: number) => {
    const s = new SphereGeometry(r, 10, 8)
    setVertexColor(s, new Color(color))
    s.translate(ox, y, oz)
    offsetUvs(s, rng(), rng())
    return s
  }
  const fruitGeo = mergeParts([
    mkFruit('#c8402a', 0.62, 0.06, 0.03, 0.028),
    mkFruit('#7d8f4a', 0.78, -0.05, -0.02, 0.022),
    mkFruit('#7d8f4a', 0.9, 0.04, -0.04, 0.02),
  ])
  const fruitMesh = new Mesh(
    fruitGeo,
    new MeshStandardMaterial({ roughness: 0.45, vertexColors: true }),
  )
  fruitMesh.castShadow = true
  fruitMesh.name = 'fruitBodies'
  fruits.add(fruitMesh)
  g.add(fruits)
}
