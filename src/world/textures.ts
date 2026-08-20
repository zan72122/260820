import * as THREE from 'three'
import { clamp, fbm, hash2, lerp, smoothstep } from '../core/util'

/**
 * 外部アセットを使わず、canvas 上でその場に生成するテクスチャ群。
 * 目的は「使用感のある地面 / 塗装の褪せ / 錆 / 汚れ」を作ること。
 * どれも tileable（fbm を period でラップ）なので repeat して使える。
 */

type RGB = [number, number, number]

function ctx2d(size: number) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d', { willReadFrequently: true })!
  return { canvas: c, g, img: g.createImageData(size, size) }
}

function finish(canvas: HTMLCanvasElement, srgb: boolean, aniso: number) {
  const t = new THREE.CanvasTexture(canvas)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.anisotropy = aniso
  t.needsUpdate = true
  return t
}

/** 高さ場からノーマルマップを起こす（Sobel）。 */
function normalFromHeight(height: Float32Array, size: number, strength: number, aniso: number) {
  const { canvas, g, img } = ctx2d(size)
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx =
        at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1))
      const dy =
        at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1))
      let nx = -dx * strength
      let ny = -dy * strength
      const nz = 1
      const l = Math.hypot(nx, ny, nz)
      nx /= l
      ny /= l
      const i = (y * size + x) * 4
      img.data[i] = (nx * 0.5 + 0.5) * 255
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255
      img.data[i + 2] = (nz / l * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  return finish(canvas, false, aniso)
}

function writeRGB(img: ImageData, i: number, c: RGB) {
  img.data[i] = clamp(c[0], 0, 255)
  img.data[i + 1] = clamp(c[1], 0, 255)
  img.data[i + 2] = clamp(c[2], 0, 255)
  img.data[i + 3] = 255
}

function mixC(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

export type SurfaceMaps = {
  map: THREE.Texture
  normalMap: THREE.Texture
  roughnessMap: THREE.Texture
}

/* ------------------------------------------------------------------ *
 * 河川敷の草地（近景ディテール）。踏まれて枯れた部分・土の露出を含む。
 * ------------------------------------------------------------------ */
export function makeGrassDetail(size = 512, aniso = 8): SurfaceMaps {
  const { canvas, g, img } = ctx2d(size)
  const height = new Float32Array(size * size)
  const rough = ctx2d(size)

  const P = 16
  const green: RGB = [84, 102, 50]
  const greenDark: RGB = [52, 68, 34]
  const dry: RGB = [124, 118, 68]
  const soil: RGB = [92, 78, 58]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * P
      const v = (y / size) * P
      const blades = fbm(u * 5.5, v * 5.5, P * 5, 3, 11)
      const clump = fbm(u * 0.9, v * 0.9, P, 4, 3)
      const dryness = smoothstep(0.58, 0.92, fbm(u * 1.6, v * 1.6, P * 2, 3, 71))
      const bare = smoothstep(0.82, 0.98, fbm(u * 1.15, v * 1.15, P, 4, 131))
      const speck = hash2(x * 3.1, y * 2.7, 5)

      let c = mixC(greenDark, green, clamp(clump * 0.7 + blades * 0.55, 0, 1))
      c = mixC(c, dry, dryness * 0.85)
      c = mixC(c, soil, bare * 0.9)
      const shade = 0.78 + blades * 0.42
      c = [c[0] * shade, c[1] * shade, c[2] * shade]
      if (speck > 0.985) c = mixC(c, [150, 143, 118], 0.5) // 小石・枯枝
      writeRGB(img, (y * size + x) * 4, c)

      const h = blades * 0.72 + clump * 0.28 - bare * 0.4
      height[y * size + x] = h

      const r = clamp(0.9 - dryness * 0.06 + bare * 0.02 - blades * 0.08, 0, 1) * 255
      writeRGB(rough.img, (y * size + x) * 4, [r, r, r])
    }
  }
  g.putImageData(img, 0, 0)
  rough.g.putImageData(rough.img, 0, 0)
  return {
    map: finish(canvas, true, aniso),
    normalMap: normalFromHeight(height, size, 2.4, aniso),
    roughnessMap: finish(rough.canvas, false, aniso),
  }
}

/* ------------------------------------------------------------------ *
 * 踏み跡・土の道。轍と乾いた土。
 * ------------------------------------------------------------------ */
export function makeDirtDetail(size = 512, aniso = 8): SurfaceMaps {
  const { canvas, g, img } = ctx2d(size)
  const height = new Float32Array(size * size)
  const rough = ctx2d(size)
  const P = 12
  const soilA: RGB = [118, 100, 78]
  const soilB: RGB = [88, 73, 57]
  const pale: RGB = [148, 134, 112]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * P
      const v = (y / size) * P
      const grain = fbm(u * 6, v * 6, P * 6, 3, 23)
      const patch = fbm(u * 1.3, v * 1.3, P, 4, 47)
      const dust = smoothstep(0.45, 0.9, fbm(u * 2.4, v * 2.4, P * 2, 3, 89))
      let c = mixC(soilB, soilA, patch)
      c = mixC(c, pale, dust * 0.55)
      const shade = 0.82 + grain * 0.36
      c = [c[0] * shade, c[1] * shade, c[2] * shade]
      const pebble = hash2(x * 1.7, y * 1.3, 19)
      if (pebble > 0.9935) c = mixC(c, [172, 166, 154], 0.75)
      writeRGB(img, (y * size + x) * 4, c)
      height[y * size + x] = grain * 0.6 + patch * 0.4 + (pebble > 0.9935 ? 0.5 : 0)
      const r = clamp(0.94 - dust * 0.08, 0, 1) * 255
      writeRGB(rough.img, (y * size + x) * 4, [r, r, r])
    }
  }
  g.putImageData(img, 0, 0)
  rough.g.putImageData(rough.img, 0, 0)
  return {
    map: finish(canvas, true, aniso),
    normalMap: normalFromHeight(height, size, 3.0, aniso),
    roughnessMap: finish(rough.canvas, false, aniso),
  }
}

/* ------------------------------------------------------------------ *
 * コンクリート（橋脚・護岸）。水垢と打ち継ぎの汚れ。
 * ------------------------------------------------------------------ */
export function makeConcrete(size = 512, aniso = 8): SurfaceMaps {
  const { canvas, g, img } = ctx2d(size)
  const height = new Float32Array(size * size)
  const rough = ctx2d(size)
  const P = 8
  const base: RGB = [150, 148, 142]
  const dark: RGB = [104, 103, 100]
  const stain: RGB = [86, 84, 76]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * P
      const v = (y / size) * P
      const grain = fbm(u * 7, v * 7, P * 7, 3, 5)
      const blotch = fbm(u * 1.1, v * 1.1, P, 4, 61)
      // 縦に伸びる雨だれ汚れ
      const streak = smoothstep(0.55, 0.95, fbm(u * 3.5, v * 0.35, P * 3, 3, 151))
      let c = mixC(dark, base, blotch * 0.8 + grain * 0.3)
      c = mixC(c, stain, streak * 0.5)
      const shade = 0.88 + grain * 0.24
      c = [c[0] * shade, c[1] * shade, c[2] * shade]
      writeRGB(img, (y * size + x) * 4, c)
      height[y * size + x] = grain * 0.8 + blotch * 0.2
      const r = clamp(0.86 + streak * 0.08 - grain * 0.06, 0, 1) * 255
      writeRGB(rough.img, (y * size + x) * 4, [r, r, r])
    }
  }
  g.putImageData(img, 0, 0)
  rough.g.putImageData(rough.img, 0, 0)
  return {
    map: finish(canvas, true, aniso),
    normalMap: normalFromHeight(height, size, 1.6, aniso),
    roughnessMap: finish(rough.canvas, false, aniso),
  }
}

/* ------------------------------------------------------------------ *
 * 塗装鋼（橋のトラス）。褪せた塗膜と錆の滲み。
 * ------------------------------------------------------------------ */
export function makePaintedSteel(color: RGB, size = 512, aniso = 8): SurfaceMaps {
  const { canvas, g, img } = ctx2d(size)
  const height = new Float32Array(size * size)
  const rough = ctx2d(size)
  const P = 8
  const rust: RGB = [112, 62, 34]
  const rustPale: RGB = [146, 96, 60]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * P
      const v = (y / size) * P
      const grain = fbm(u * 8, v * 8, P * 8, 3, 13)
      const wear = fbm(u * 1.6, v * 1.6, P, 4, 211)
      const rustMask = smoothstep(0.66, 0.93, fbm(u * 2.2, v * 0.6, P * 2, 4, 307))
      const chalk = smoothstep(0.4, 0.9, wear)
      let c = mixC(color, [color[0] * 1.22 + 26, color[1] * 1.22 + 26, color[2] * 1.2 + 24], chalk * 0.5)
      c = mixC(c, rustPale, rustMask * 0.55)
      c = mixC(c, rust, rustMask * rustMask * 0.5)
      const shade = 0.9 + grain * 0.2
      c = [c[0] * shade, c[1] * shade, c[2] * shade]
      writeRGB(img, (y * size + x) * 4, c)
      height[y * size + x] = grain * 0.5 + rustMask * 0.5
      const r = clamp(0.42 + chalk * 0.24 + rustMask * 0.34, 0, 1) * 255
      writeRGB(rough.img, (y * size + x) * 4, [r, r, r])
    }
  }
  g.putImageData(img, 0, 0)
  rough.g.putImageData(rough.img, 0, 0)
  return {
    map: finish(canvas, true, aniso),
    normalMap: normalFromHeight(height, size, 1.4, aniso),
    roughnessMap: finish(rough.canvas, false, aniso),
  }
}

/* ------------------------------------------------------------------ *
 * アスファルト（橋面・堤防天端の道）。ひび・補修跡・白線の擦れ。
 * ------------------------------------------------------------------ */
export function makeAsphalt(size = 512, aniso = 8): SurfaceMaps {
  const { canvas, g, img } = ctx2d(size)
  const height = new Float32Array(size * size)
  const rough = ctx2d(size)
  const P = 10
  const base: RGB = [78, 76, 76]
  const pale: RGB = [122, 120, 118]
  const patch: RGB = [58, 57, 58]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * P
      const v = (y / size) * P
      const grit = fbm(u * 12, v * 12, P * 12, 3, 29)
      const wear = fbm(u * 1.2, v * 1.2, P, 4, 97)
      const repair = smoothstep(0.80, 0.93, fbm(u * 1.7, v * 1.7, P * 2, 3, 401))
      let c = mixC(base, pale, grit * 0.26 + wear * 0.3)
      c = mixC(c, patch, repair * 0.38)
      const chip = hash2(x * 2.3, y * 1.9, 37)
      if (chip > 0.996) c = mixC(c, [128, 126, 122], 0.45)
      writeRGB(img, (y * size + x) * 4, c)
      height[y * size + x] = grit * 0.5 + (chip > 0.996 ? 0.25 : 0)
      const r = clamp(0.82 - wear * 0.1, 0, 1) * 255
      writeRGB(rough.img, (y * size + x) * 4, [r, r, r])
    }
  }
  g.putImageData(img, 0, 0)
  rough.g.putImageData(rough.img, 0, 0)
  return {
    map: finish(canvas, true, aniso),
    normalMap: normalFromHeight(height, size, 1.2, aniso),
    roughnessMap: finish(rough.canvas, false, aniso),
  }
}

/* ------------------------------------------------------------------ *
 * 草の房（インスタンス草のアルファ）。
 * ------------------------------------------------------------------ */
export function makeGrassBlade(size = 128) {
  const { canvas, g } = ctx2d(size)
  g.clearRect(0, 0, size, size)
  const blades = 26
  for (let i = 0; i < blades; i++) {
    const r = hash2(i * 7.3, 3.1, 91)
    const r2 = hash2(i * 2.9, 11.7, 55)
    const r3 = hash2(i * 5.1, 6.3, 23)
    const baseX = size * (0.14 + 0.72 * r)
    const h = size * (0.5 + 0.48 * r2)
    const bend = size * (r3 - 0.5) * 0.5
    const w = size * (0.026 + 0.03 * r3)
    const tone = 118 + r2 * 82
    const green = `rgb(${Math.round(tone * 0.6)}, ${Math.round(tone)}, ${Math.round(tone * 0.42)})`
    g.beginPath()
    g.moveTo(baseX - w, size)
    g.quadraticCurveTo(baseX - w * 0.6 + bend * 0.5, size - h * 0.55, baseX + bend, size - h)
    g.quadraticCurveTo(baseX + w * 0.6 + bend * 0.5, size - h * 0.55, baseX + w, size)
    g.closePath()
    g.fillStyle = green
    g.fill()
  }
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

/* ------------------------------------------------------------------ *
 * 水面のさざなみノーマル（スクロールさせて使う）。
 * ------------------------------------------------------------------ */
export function makeWaterNormal(size = 256) {
  const height = new Float32Array(size * size)
  const P = 8
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * P
      const v = (y / size) * P
      height[y * size + x] =
        fbm(u * 2.2, v * 2.2, P * 2, 4, 7) * 0.65 + fbm(u * 6.5, v * 6.5, P * 6, 3, 131) * 0.35
    }
  }
  const t = normalFromHeight(height, size, 1.15, 4)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/* ------------------------------------------------------------------ *
 * 夜の街の窓明かり（遠景ビル用のエミッシブ）。
 * ------------------------------------------------------------------ */
export function makeWindowLights(size = 256) {
  const { canvas, g } = ctx2d(size)
  g.fillStyle = '#000000'
  g.fillRect(0, 0, size, size)
  const cols = 16
  const rows = 22
  const cw = size / cols
  const rh = size / rows
  const warm = ['#ffd9a0', '#ffe7c4', '#ffcf86', '#e9ecff', '#fff2d6']
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const h = hash2(c * 3.7, r * 5.3, 17)
      if (h < 0.46) continue
      const tone = warm[Math.floor(hash2(c, r, 71) * warm.length) % warm.length]
      g.fillStyle = tone
      g.globalAlpha = 0.45 + hash2(c * 1.1, r * 2.2, 5) * 0.55
      g.fillRect(c * cw + cw * 0.24, r * rh + rh * 0.26, cw * 0.5, rh * 0.42)
    }
  }
  g.globalAlpha = 1
  const t = new THREE.CanvasTexture(canvas)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

/* ------------------------------------------------------------------ *
 * ブルーシート（会場の生活感）。しわと擦れ。
 * ------------------------------------------------------------------ */
export function makeTarp(size = 256, aniso = 4): SurfaceMaps {
  const { canvas, g, img } = ctx2d(size)
  const height = new Float32Array(size * size)
  const rough = ctx2d(size)
  const P = 6
  const blue: RGB = [44, 86, 148]
  const bluePale: RGB = [96, 140, 190]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * P
      const v = (y / size) * P
      const weave = ((x % 4 < 2 ? 1 : 0) ^ (y % 4 < 2 ? 1 : 0)) * 0.12
      const wrinkle = fbm(u * 2.0, v * 2.0, P * 2, 4, 313)
      const scuff = smoothstep(0.6, 0.95, fbm(u * 3.0, v * 3.0, P * 3, 3, 419))
      let c = mixC(blue, bluePale, wrinkle * 0.5 + weave + scuff * 0.35)
      c = mixC(c, [126, 130, 128], scuff * 0.28)
      writeRGB(img, (y * size + x) * 4, c)
      height[y * size + x] = wrinkle * 0.9 + weave
      const r = clamp(0.55 + scuff * 0.3, 0, 1) * 255
      writeRGB(rough.img, (y * size + x) * 4, [r, r, r])
    }
  }
  g.putImageData(img, 0, 0)
  rough.g.putImageData(rough.img, 0, 0)
  return {
    map: finish(canvas, true, aniso),
    normalMap: normalFromHeight(height, size, 1.8, aniso),
    roughnessMap: finish(rough.canvas, false, aniso),
  }
}

/** 光のにじみ（ハロー / 地面の光だまり）。加算合成で使う。 */
export function makeGlow(size = 128, power = 2.2) {
  const { canvas, g, img } = ctx2d(size)
  const c = size / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c + 0.5, y - c + 0.5) / c
      const a = Math.pow(clamp(1 - d, 0, 1), power)
      const i = (y * size + x) * 4
      img.data[i] = 255
      img.data[i + 1] = 255
      img.data[i + 2] = 255
      img.data[i + 3] = a * 255
    }
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

/** 木の葉のかたまり（樹冠のアルファ）。 */
export function makeLeafCluster(size = 128) {
  const { canvas, g } = ctx2d(size)
  g.clearRect(0, 0, size, size)
  for (let i = 0; i < 190; i++) {
    const a = hash2(i * 1.7, 2.3, 61) * Math.PI * 2
    const r = Math.pow(hash2(i * 3.3, 5.9, 13), 0.62) * size * 0.46
    const x = size / 2 + Math.cos(a) * r
    const y = size / 2 + Math.sin(a) * r * 0.86
    const s = size * (0.035 + hash2(i * 2.1, 7.7, 29) * 0.05)
    const tone = 46 + hash2(i * 4.4, 1.2, 43) * 74
    g.fillStyle = `rgba(${Math.round(tone * 0.62)}, ${Math.round(tone)}, ${Math.round(tone * 0.44)}, 0.95)`
    g.beginPath()
    g.ellipse(x, y, s, s * 0.62, a, 0, Math.PI * 2)
    g.fill()
  }
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}
