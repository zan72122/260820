import {
  CanvasTexture,
  Color,
  MeshStandardMaterial,
  SRGBColorSpace,
} from 'three'
import { makeMat } from './materials'
import type { TextureRegistry } from './TextureRegistry'

/**
 * The material kit builders draw from. Builders never touch the DOM or the
 * registry directly, so unit tests can hand them `createStubMatKit()` and
 * assert pure geometry in Node.
 *
 * Texture world sizes (how many metres one tile covers) keep UVs — which
 * builders write in metres — at real physical scale.
 */
export interface MatKit {
  woodWeathered: MeshStandardMaterial
  woodDark: MeshStandardMaterial
  plaster: MeshStandardMaterial
  kawara: MeshStandardMaterial
  stone: MeshStandardMaterial
  soilTilled: MeshStandardMaterial
  gravel: MeshStandardMaterial
  moss: MeshStandardMaterial
  bark: MeshStandardMaterial
  bamboo: MeshStandardMaterial
  paperShoji: MeshStandardMaterial
  metalTin: MeshStandardMaterial
  grassShort: MeshStandardMaterial
  /** 縁の下・軒裏などの無彩色の暗部 */
  shadowWood: MeshStandardMaterial
}

/** metres covered by one texture repeat, per family */
export const TEX_WORLD_SIZE = {
  woodWeathered: 1.1,
  woodDark: 1.0,
  plaster: 1.8,
  kawara: 0.9,
  soilPacked: 1.7,
  soilTilled: 1.1,
  stone: 0.85,
  moss: 0.7,
  gravel: 0.5,
  grassShort: 3.0,
  bark: 0.8,
  bamboo: 0.6,
  paperShoji: 0.9,
  metalTin: 0.5,
} as const

function rep(family: keyof typeof TEX_WORLD_SIZE): [number, number] {
  const s = TEX_WORLD_SIZE[family]
  return [1 / s, 1 / s]
}

export function createMatKit(reg: TextureRegistry): MatKit {
  // 障子の内側の灯り: 下方ほど明るい暖色（部屋の行灯の高さが低いという根拠）。
  const glowCanvas = document.createElement('canvas')
  glowCanvas.width = 4
  glowCanvas.height = 64
  const ctx = glowCanvas.getContext('2d')
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 64)
    g.addColorStop(0, '#241a10')
    g.addColorStop(0.55, '#5c422a')
    g.addColorStop(1, '#8a613a')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 4, 64)
  }
  const glowTex = new CanvasTexture(glowCanvas)
  glowTex.colorSpace = SRGBColorSpace

  const paperShoji = makeMat(reg, 'paperShoji', { repeat: rep('paperShoji') })
  paperShoji.emissive = new Color('#ffffff')
  paperShoji.emissiveMap = glowTex
  paperShoji.emissiveIntensity = 1.0

  return {
    woodWeathered: makeMat(reg, 'woodWeathered', {
      repeat: rep('woodWeathered'),
      vertexColors: true,
    }),
    woodDark: makeMat(reg, 'woodDark', {
      repeat: rep('woodDark'),
      vertexColors: true,
    }),
    plaster: makeMat(reg, 'plaster', { repeat: rep('plaster') }),
    kawara: makeMat(reg, 'kawara', { repeat: rep('kawara'), vertexColors: true }),
    stone: makeMat(reg, 'stone', { repeat: rep('stone'), vertexColors: true }),
    soilTilled: makeMat(reg, 'soilTilled', { repeat: rep('soilTilled') }),
    gravel: makeMat(reg, 'gravel', { repeat: rep('gravel') }),
    moss: makeMat(reg, 'moss', { repeat: rep('moss') }),
    bark: makeMat(reg, 'bark', { repeat: rep('bark') }),
    bamboo: makeMat(reg, 'bamboo', { repeat: rep('bamboo'), vertexColors: true }),
    paperShoji,
    metalTin: makeMat(reg, 'metalTin', {
      repeat: rep('metalTin'),
      metalness: 1,
      roughness: 1,
    }),
    grassShort: makeMat(reg, 'grassShort', { repeat: rep('grassShort') }),
    shadowWood: new MeshStandardMaterial({ color: '#16130f', roughness: 0.95 }),
  }
}

/** Node-safe kit for geometry unit tests: colours only, no DOM, no textures. */
export function createStubMatKit(): MatKit {
  const m = (color: string, extra: Partial<MeshStandardMaterial> = {}) => {
    const mat = new MeshStandardMaterial({ color, roughness: 0.9 })
    Object.assign(mat, extra)
    return mat
  }
  return {
    woodWeathered: m('#9a8f7d', { vertexColors: true }),
    woodDark: m('#63513c', { vertexColors: true }),
    plaster: m('#e3dcca'),
    kawara: m('#4d525a', { vertexColors: true }),
    stone: m('#8f8a80', { vertexColors: true }),
    soilTilled: m('#4a3a29'),
    gravel: m('#7b756c'),
    moss: m('#556334'),
    bark: m('#4c4238'),
    bamboo: m('#b5a05d', { vertexColors: true }),
    paperShoji: m('#f6f0e1'),
    metalTin: m('#9aa1a4'),
    grassShort: m('#66702f'),
    shadowWood: m('#16130f'),
  }
}
