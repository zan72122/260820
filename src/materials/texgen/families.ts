/**
 * Procedural PBR texture families — the self-contained fallback for the CC0
 * scan pipeline (scripts/fetch-textures.mjs can replace them with Poly Haven
 * data). Pure byte-array synthesis: no DOM, deterministic in (seed, size),
 * unit-testable in Node.
 *
 * Design rule: every parameter is derived from the real material's physics —
 * silvered cedar is grey because UV degrades lignin, いぶし瓦 is blue-grey
 * because of the carbon smoking, granite speckles are feldspar/quartz/mica.
 * No decorative patterns without a material cause.
 */
import { deriveRng } from '../../core/rng'
import {
  addFbm,
  addValueNoise,
  cloneField,
  createField,
  greyToBytes,
  heightToNormalBytes,
  mapField,
  normalizeField,
  rampToBytes,
  transposeField,
  worley,
  type ColorStop,
} from './noise'

export interface FamilyBytes {
  size: number
  /** sRGB RGBA */
  albedo: Uint8ClampedArray
  /** linear greyscale RGBA */
  rough: Uint8ClampedArray
  /** tangent-space normal RGBA */
  normal: Uint8ClampedArray
  /** optional linear greyscale RGBA (metal families only) */
  metalness?: Uint8ClampedArray
}

export type FamilyName =
  | 'woodWeathered'
  | 'woodDark'
  | 'plaster'
  | 'kawara'
  | 'soilPacked'
  | 'soilTilled'
  | 'stone'
  | 'moss'
  | 'gravel'
  | 'grassShort'
  | 'bark'
  | 'bamboo'
  | 'paperShoji'
  | 'metalTin'

const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]

/** 縁側・腰板: 雨晒しで銀灰化した杉板。木目は繊維方向（x）に伸びる。 */
function woodWeathered(seed: number, size: number): FamilyBytes {
  const grain = createField(size, size)
  addFbm(grain, seed, 6, 4, 1, 0.55, 10)
  addValueNoise(grain, seed + 7, 90, 0.35, 24) // 細かい导管の筋
  normalizeField(grain)
  const stops: ColorStop[] = [
    { t: 0, rgb: rgb('#6e6558') },
    { t: 0.45, rgb: rgb('#8a8072') },
    { t: 0.75, rgb: rgb('#a29786') },
    { t: 1, rgb: rgb('#b0a591') },
  ]
  const albedo = rampToBytes(grain, stops)
  const roughVar = cloneField(grain)
  mapField(roughVar, (v) => 0.82 + (v - 0.5) * 0.12) // 導管溝はわずかに粗い
  const height = cloneField(grain)
  mapField(height, (v) => v * 0.6)
  return {
    size,
    albedo,
    rough: greyToBytes(roughVar),
    normal: heightToNormalBytes(height, 1.6),
  }
}

/** 板塀・柱: 粗挽きの濃色板（古い杉・松の日焼け）。 */
function woodDark(seed: number, size: number): FamilyBytes {
  const grain = createField(size, size)
  addFbm(grain, seed, 5, 4, 1, 0.5, 8)
  addValueNoise(grain, seed + 3, 70, 0.4, 18)
  // 帯鋸の跡: 繊維と直交する周期的な浅い筋（挽いた材の必然）
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const saw = Math.sin((x / size) * Math.PI * 2 * 26 + Math.sin(y * 0.15) * 0.8)
      grain.data[y * size + x] = (grain.data[y * size + x] as number) + saw * 0.05
    }
  }
  normalizeField(grain)
  const stops: ColorStop[] = [
    { t: 0, rgb: rgb('#4a3a2a') },
    { t: 0.5, rgb: rgb('#63513c') },
    { t: 1, rgb: rgb('#7d6a50') },
  ]
  const roughVar = cloneField(grain)
  mapField(roughVar, (v) => 0.88 + (v - 0.5) * 0.08)
  const height = cloneField(grain)
  mapField(height, (v) => v * 0.7)
  return {
    size,
    albedo: rampToBytes(grain, stops),
    rough: greyToBytes(roughVar),
    normal: heightToNormalBytes(height, 2.0),
  }
}

/** 漆喰壁: 石灰の微細な肌＋鏝ムラ＋ごく僅かなヘアクラック。 */
function plaster(seed: number, size: number): FamilyBytes {
  const f = createField(size, size)
  addFbm(f, seed, 3, 2, 0.5) // 鏝ムラ（広い凹凸）
  addValueNoise(f, seed + 11, 160, 0.25) // 石灰の微細な粒
  normalizeField(f)
  // ヘアクラック: セル境界のごく細い線を稀に
  const cracks = createField(size, size)
  worley(cracks, seed + 23, 8, 'edge')
  mapField(cracks, (v) => (v < 0.015 ? 1 : 0))
  for (let i = 0; i < f.data.length; i++) {
    f.data[i] = (f.data[i] as number) - (cracks.data[i] as number) * 0.09
  }
  const stops: ColorStop[] = [
    { t: 0, rgb: rgb('#cfc7b4') },
    { t: 0.5, rgb: rgb('#e3dcca') },
    { t: 1, rgb: rgb('#efe8d8') },
  ]
  const roughVar = cloneField(f)
  mapField(roughVar, (v) => 0.9 - (v - 0.5) * 0.06)
  const height = cloneField(f)
  mapField(height, (v) => v * 0.35)
  return {
    size,
    albedo: rampToBytes(f, stops),
    rough: greyToBytes(roughVar),
    normal: heightToNormalBytes(height, 0.8),
  }
}

/** いぶし瓦: 燻化した銀鼠のセラミック。焼成ムラのみ、艶は半消し。 */
function kawara(seed: number, size: number): FamilyBytes {
  const f = createField(size, size)
  addFbm(f, seed, 3, 3, 1, 0.5)
  addValueNoise(f, seed + 5, 60, 0.2)
  normalizeField(f)
  const stops: ColorStop[] = [
    { t: 0, rgb: rgb('#3d4148') },
    { t: 0.55, rgb: rgb('#4d525a') },
    { t: 1, rgb: rgb('#5d626b') },
  ]
  const roughVar = cloneField(f)
  mapField(roughVar, (v) => 0.5 + (v - 0.5) * 0.16)
  const height = cloneField(f)
  mapField(height, (v) => v * 0.15)
  return {
    size,
    albedo: rampToBytes(f, stops),
    rough: greyToBytes(roughVar),
    normal: heightToNormalBytes(height, 0.5),
  }
}

/** 庭の踏み固められた土: 塊状の凹凸＋僅かな小石。 */
function soilPacked(seed: number, size: number): FamilyBytes {
  const clods = createField(size, size)
  worley(clods, seed, 90, 'f1')
  normalizeField(clods)
  const f = cloneField(clods)
  addFbm(f, seed + 9, 5, 4, 0.7, 0.5)
  normalizeField(f)
  // 小石: ごく浅い worley の芯を明るく
  const pebbles = createField(size, size)
  worley(pebbles, seed + 31, 26, 'f1')
  mapField(pebbles, (v) => (v < 0.1 ? (0.1 - v) / 0.1 : 0))
  for (let i = 0; i < f.data.length; i++) {
    f.data[i] = (f.data[i] as number) + (pebbles.data[i] as number) * 0.5
  }
  const stops: ColorStop[] = [
    { t: 0, rgb: rgb('#5f4d38') },
    { t: 0.5, rgb: rgb('#7c6749') },
    { t: 0.85, rgb: rgb('#8d795a') },
    { t: 1, rgb: rgb('#a5977d') },
  ]
  const roughVar = cloneField(f)
  mapField(roughVar, () => 0.96)
  const height = cloneField(f)
  mapField(height, (v) => v * 0.5)
  return {
    size,
    albedo: rampToBytes(f, stops),
    rough: greyToBytes(roughVar),
    normal: heightToNormalBytes(height, 1.4),
  }
}

/** 畝の耕した土: 黒くて粗い団粒構造。 */
function soilTilled(seed: number, size: number): FamilyBytes {
  const clods = createField(size, size)
  worley(clods, seed, 140, 'f1')
  normalizeField(clods)
  const f = cloneField(clods)
  addFbm(f, seed + 4, 6, 3, 0.5)
  normalizeField(f)
  const stops: ColorStop[] = [
    { t: 0, rgb: rgb('#2e241a') },
    { t: 0.55, rgb: rgb('#4a3a29') },
    { t: 1, rgb: rgb('#63523c') },
  ]
  const roughVar = cloneField(f)
  mapField(roughVar, () => 0.98)
  const height = cloneField(f)
  return {
    size,
    albedo: rampToBytes(f, stops),
    rough: greyToBytes(roughVar),
    normal: heightToNormalBytes(height, 2.2),
  }
}

/** 花崗岩: 長石・石英・雲母の斑（みかげ石の実際の組成）。 */
function stone(seed: number, size: number): FamilyBytes {
  const speckle = createField(size, size)
  addValueNoise(speckle, seed, 190, 1)
  const broad = createField(size, size)
  addFbm(broad, seed + 8, 4, 3, 1, 0.5)
  normalizeField(speckle)
  normalizeField(broad)
  const f = createField(size, size)
  for (let i = 0; i < f.data.length; i++) {
    // 斑を主、広い風化ムラを従に合成
    f.data[i] = (speckle.data[i] as number) * 0.55 + (broad.data[i] as number) * 0.45
  }
  const stops: ColorStop[] = [
    { t: 0, rgb: rgb('#4f4c46') },
    { t: 0.35, rgb: rgb('#767068') },
    { t: 0.7, rgb: rgb('#8f8a80') },
    { t: 1, rgb: rgb('#b3aca0') },
  ]
  const roughVar = cloneField(broad)
  mapField(roughVar, (v) => 0.78 + (v - 0.5) * 0.1)
  const height = cloneField(broad)
  mapField(height, (v) => v * 0.6)
  // 風化の小さな穴
  const pits = createField(size, size)
  worley(pits, seed + 17, 30, 'f1')
  for (let i = 0; i < height.data.length; i++) {
    const p = pits.data[i] as number
    if (p < 0.08) height.data[i] = (height.data[i] as number) - (0.08 - p) * 3
  }
  return {
    size,
    albedo: rampToBytes(f, stops),
    rough: greyToBytes(roughVar),
    normal: heightToNormalBytes(height, 1.6),
  }
}

/** 苔: 湿った北面に付く塊状の緑。 */
function moss(seed: number, size: number): FamilyBytes {
  const clumps = createField(size, size)
  worley(clumps, seed, 110, 'f1')
  normalizeField(clumps)
  mapField(clumps, (v) => 1 - v)
  const f = cloneField(clumps)
  addFbm(f, seed + 6, 8, 3, 0.5)
  normalizeField(f)
  const stops: ColorStop[] = [
    { t: 0, rgb: rgb('#3a4526') },
    { t: 0.5, rgb: rgb('#556334') },
    { t: 1, rgb: rgb('#7d8850') },
  ]
  const roughVar = createField(size, size, 1)
  const height = cloneField(f)
  mapField(height, (v) => v * 0.8)
  return {
    size,
    albedo: rampToBytes(f, stops),
    rough: greyToBytes(roughVar),
    normal: heightToNormalBytes(height, 1.8),
  }
}

/** 雨落ちの砂利: 小石の充填。 */
function gravel(seed: number, size: number): FamilyBytes {
  const cells = createField(size, size)
  worley(cells, seed, 220, 'f1')
  normalizeField(cells)
  const shade = cloneField(cells)
  mapField(shade, (v) => 1 - v) // 石の中心が明るく縁が暗い
  const tint = createField(size, size)
  addValueNoise(tint, seed + 12, 20, 1)
  normalizeField(tint)
  const f = createField(size, size)
  for (let i = 0; i < f.data.length; i++) {
    f.data[i] = (shade.data[i] as number) * 0.7 + (tint.data[i] as number) * 0.3
  }
  const stops: ColorStop[] = [
    { t: 0, rgb: rgb('#55504a') },
    { t: 0.5, rgb: rgb('#7b756c') },
    { t: 1, rgb: rgb('#a29a8d') },
  ]
  const roughVar = createField(size, size, 0.85)
  const height = cloneField(shade)
  return {
    size,
    albedo: rampToBytes(f, stops),
    rough: greyToBytes(roughVar),
    normal: heightToNormalBytes(height, 2.4),
  }
}

/** 中景の草地・畦: 遠目に見る短草。 */
function grassShort(seed: number, size: number): FamilyBytes {
  const f = createField(size, size)
  addFbm(f, seed, 6, 4, 1, 0.55, 3)
  normalizeField(f)
  const stops: ColorStop[] = [
    { t: 0, rgb: rgb('#4c5528') },
    { t: 0.45, rgb: rgb('#66702f') },
    { t: 0.8, rgb: rgb('#8b8a45') },
    { t: 1, rgb: rgb('#a89a58') }, // 枯れ始めの株（夕方の秋）
  ]
  const roughVar = createField(size, size, 1)
  const height = cloneField(f)
  mapField(height, (v) => v * 0.4)
  return {
    size,
    albedo: rampToBytes(f, stops),
    rough: greyToBytes(roughVar),
    normal: heightToNormalBytes(height, 0.9),
  }
}

/** 柿の樹皮: 縦に深く割れる網目状の樹皮。 */
function bark(seed: number, size: number): FamilyBytes {
  let ridges = createField(size, size)
  addFbm(ridges, seed, 5, 4, 1, 0.5, 6)
  ridges = transposeField(ridges) // 縦方向の割れ目
  const blocks = createField(size, size)
  worley(blocks, seed + 21, 70, 'edge')
  normalizeField(blocks)
  const f = createField(size, size)
  for (let i = 0; i < f.data.length; i++) {
    f.data[i] = (ridges.data[i] as number) * 0.5 + (blocks.data[i] as number) * 0.5
  }
  normalizeField(f)
  const stops: ColorStop[] = [
    { t: 0, rgb: rgb('#2f2822') },
    { t: 0.5, rgb: rgb('#4c4238') },
    { t: 1, rgb: rgb('#6b5f50') },
  ]
  const roughVar = createField(size, size, 0.95)
  const height = cloneField(f)
  return {
    size,
    albedo: rampToBytes(f, stops),
    rough: greyToBytes(roughVar),
    normal: heightToNormalBytes(height, 2.6),
  }
}

/** 竹: 稈の縦繊維。節はジオメトリ側。 */
function bamboo(seed: number, size: number): FamilyBytes {
  let f = createField(size, size)
  addFbm(f, seed, 8, 3, 1, 0.5, 12)
  f = transposeField(f) // 繊維は長手（v）方向
  addValueNoise(f, seed + 2, 6, 0.3)
  normalizeField(f)
  const stops: ColorStop[] = [
    { t: 0, rgb: rgb('#96813f') },
    { t: 0.5, rgb: rgb('#b5a05d') },
    { t: 1, rgb: rgb('#cbb97a') },
  ]
  const roughVar = cloneField(f)
  mapField(roughVar, (v) => 0.55 + (v - 0.5) * 0.1)
  const height = cloneField(f)
  mapField(height, (v) => v * 0.25)
  return {
    size,
    albedo: rampToBytes(f, stops),
    rough: greyToBytes(roughVar),
    normal: heightToNormalBytes(height, 0.6),
  }
}

/** 障子紙: 楮繊維の漉きムラ。 */
function paperShoji(seed: number, size: number): FamilyBytes {
  const f = createField(size, size)
  addValueNoise(f, seed, 120, 0.5, 2)
  addFbm(f, seed + 3, 5, 2, 0.5)
  normalizeField(f)
  const stops: ColorStop[] = [
    { t: 0, rgb: rgb('#e7e0cf') },
    { t: 1, rgb: rgb('#f6f0e1') },
  ]
  const roughVar = createField(size, size, 0.92)
  const height = cloneField(f)
  mapField(height, (v) => v * 0.15)
  return {
    size,
    albedo: rampToBytes(f, stops),
    rough: greyToBytes(roughVar),
    normal: heightToNormalBytes(height, 0.3),
  }
}

/** ブリキ（亜鉛めっき鋼板）: 使い込まれた如雨露・盥の肌。 */
function metalTin(seed: number, size: number): FamilyBytes {
  const f = createField(size, size)
  addFbm(f, seed, 4, 3, 0.6)
  addValueNoise(f, seed + 5, 100, 0.3, 14) // 磨き傷（円周方向の筋を想定）
  normalizeField(f)
  // 亜鉛の spangle（花状結晶）: 広めの worley
  const spangle = createField(size, size)
  worley(spangle, seed + 40, 40, 'f1')
  normalizeField(spangle)
  for (let i = 0; i < f.data.length; i++) {
    f.data[i] = (f.data[i] as number) * 0.7 + (spangle.data[i] as number) * 0.3
  }
  const stops: ColorStop[] = [
    { t: 0, rgb: rgb('#787f83') },
    { t: 0.5, rgb: rgb('#9aa1a4') },
    { t: 1, rgb: rgb('#b8bcbd') },
  ]
  const roughVar = cloneField(f)
  mapField(roughVar, (v) => 0.42 + (v - 0.5) * 0.25)
  // 白錆・汚れで金属性が落ちる斑
  const metal = cloneField(spangle)
  mapField(metal, (v) => (v < 0.15 ? 0.55 : 0.95))
  const height = cloneField(f)
  mapField(height, (v) => v * 0.12)
  return {
    size,
    albedo: rampToBytes(f, stops),
    rough: greyToBytes(roughVar),
    normal: heightToNormalBytes(height, 0.35),
    metalness: greyToBytes(metal),
  }
}

const GENERATORS: Record<FamilyName, (seed: number, size: number) => FamilyBytes> = {
  woodWeathered,
  woodDark,
  plaster,
  kawara,
  soilPacked,
  soilTilled,
  stone,
  moss,
  gravel,
  grassShort,
  bark,
  bamboo,
  paperShoji,
  metalTin,
}

export const FAMILY_NAMES = Object.keys(GENERATORS) as FamilyName[]

export function generateFamily(
  family: FamilyName,
  worldSeed: number,
  size: number,
): FamilyBytes {
  // 独立ストリーム: ファミリー追加が他ファミリーの見た目を変えない
  const seed = Math.floor(deriveRng(worldSeed, `tex:${family}`)() * 2 ** 31)
  return GENERATORS[family](seed, size)
}
