/**
 * 素材テクスチャは canvas で手続き的に生成する。外部アセットを持ち込まずに
 * 「亜鉛結晶」「粉体塗装の小傷」「コンクリートの骨材」といった不均一さを出すのが目的。
 * 同じ roughness を全面に使わないよう、各素材に roughnessMap を必ず与える。
 */
import * as THREE from 'three'
import { Rng } from '../core/rng'

const cache = new Map<string, THREE.Texture>()

function makeCanvas(size: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  if (!g) throw new Error('2d context unavailable')
  return { c, g }
}

function toTexture(c: HTMLCanvasElement, repeat: number, srgb: boolean, aniso: number): THREE.Texture {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.anisotropy = aniso
  t.needsUpdate = true
  return t
}

/** タイル境界が出ないよう、ラップしながら円を描く */
function wrapCircle(g: CanvasRenderingContext2D, x: number, y: number, r: number, size: number) {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      g.beginPath()
      g.arc(x + dx * size, y + dy * size, r, 0, Math.PI * 2)
      g.fill()
    }
  }
}

function wrapLine(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, size: number) {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      g.beginPath()
      g.moveTo(x0 + dx * size, y0 + dy * size)
      g.lineTo(x1 + dx * size, y1 + dy * size)
      g.stroke()
    }
  }
}

function fbmNoise(g: CanvasRenderingContext2D, size: number, rng: Rng, octaves: number, alpha: number) {
  for (let o = 0; o < octaves; o++) {
    const cell = size / (4 << o)
    const a = alpha / (o + 1)
    for (let y = 0; y < size; y += cell) {
      for (let x = 0; x < size; x += cell) {
        const v = Math.floor(rng.range(0, 255))
        g.fillStyle = `rgba(${v},${v},${v},${a})`
        g.fillRect(x, y, cell + 1, cell + 1)
      }
    }
  }
}

/** 溶融亜鉛めっき：控えめなスパングル（亜鉛結晶）と接合部の擦り傷。鏡面一様にしない。 */
export function galvanizedMaps(aniso: number) {
  const key = `galv:${aniso}`
  const rough = cache.get(key + ':r')
  if (rough) return { map: cache.get(key + ':m')!, roughnessMap: rough }

  const size = 512
  const { c: cm, g: gm } = makeCanvas(size)
  gm.fillStyle = '#9aa1a4'
  gm.fillRect(0, 0, size, size)
  const rng = new Rng(4711)
  // スパングル：不規則な多角形の集合。輪郭は淡く。
  for (let i = 0; i < 420; i++) {
    const x = rng.range(0, size)
    const y = rng.range(0, size)
    const r = rng.range(6, 34)
    const tone = rng.range(-16, 16)
    const base = 154 + tone
    gm.fillStyle = `rgba(${base},${base + 4},${base + 7},0.5)`
    gm.beginPath()
    const n = rng.int(5, 8)
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rng.range(-0.25, 0.25)
      const rr = r * rng.range(0.6, 1.15)
      const px = x + Math.cos(a) * rr
      const py = y + Math.sin(a) * rr
      if (k === 0) gm.moveTo(px, py)
      else gm.lineTo(px, py)
    }
    gm.closePath()
    gm.fill()
  }
  // 白錆・水濡れの染み
  gm.globalAlpha = 0.18
  for (let i = 0; i < 40; i++) {
    gm.fillStyle = rng.next() > 0.5 ? '#c8cdcc' : '#7d8487'
    wrapCircle(gm, rng.range(0, size), rng.range(0, size), rng.range(10, 60), size)
  }
  gm.globalAlpha = 1
  // 運搬・玉掛けによる擦り傷（左右非対称）
  gm.lineCap = 'round'
  for (let i = 0; i < 90; i++) {
    const x = rng.range(0, size)
    const y = rng.range(0, size)
    const a = rng.range(0, Math.PI * 2)
    const len = rng.range(8, 90)
    gm.strokeStyle = `rgba(${rng.int(180, 220)},${rng.int(180, 220)},${rng.int(185, 225)},${rng.range(0.1, 0.4)})`
    gm.lineWidth = rng.range(0.6, 2.2)
    wrapLine(gm, x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, size)
  }

  const { c: cr, g: gr } = makeCanvas(size)
  gr.fillStyle = '#6e6e6e'
  gr.fillRect(0, 0, size, size)
  const rng2 = new Rng(881)
  fbmNoise(gr, size, rng2, 4, 0.30)
  gr.globalAlpha = 0.5
  for (let i = 0; i < 260; i++) {
    const v = rng2.int(70, 190)
    gr.fillStyle = `rgb(${v},${v},${v})`
    wrapCircle(gr, rng2.range(0, size), rng2.range(0, size), rng2.range(5, 30), size)
  }
  gr.globalAlpha = 1
  for (let i = 0; i < 90; i++) {
    const x = rng2.range(0, size)
    const y = rng2.range(0, size)
    const a = rng2.range(0, Math.PI * 2)
    gr.strokeStyle = `rgba(40,40,40,${rng2.range(0.2, 0.5)})`
    gr.lineWidth = rng2.range(0.6, 2)
    wrapLine(gr, x, y, x + Math.cos(a) * rng2.range(10, 80), y + Math.sin(a) * rng2.range(10, 80), size)
  }

  const map = toTexture(cm, 2, true, aniso)
  const roughnessMap = toTexture(cr, 2, false, aniso)
  cache.set(key + ':m', map)
  cache.set(key + ':r', roughnessMap)
  return { map, roughnessMap }
}

/** 粉体塗装：膜厚のある角、運搬時の小傷、面ごとに違う荒れ方。 */
export function powderCoatMaps(hex: number, aniso: number) {
  const key = `pc:${hex.toString(16)}:${aniso}`
  const cached = cache.get(key + ':m')
  if (cached) return { map: cached, roughnessMap: cache.get(key + ':r')! }

  const size = 512
  const base = new THREE.Color(hex)
  const { c: cm, g: gm } = makeCanvas(size)
  gm.fillStyle = `#${base.getHexString()}`
  gm.fillRect(0, 0, size, size)
  const rng = new Rng(hex ^ 0x5a5a)
  // 塗膜のわずかなむら
  gm.globalAlpha = 0.05
  for (let i = 0; i < 90; i++) {
    const shade = base.clone().offsetHSL(0, rng.range(-0.03, 0.03), rng.range(-0.03, 0.03))
    gm.fillStyle = `#${shade.getHexString()}`
    wrapCircle(gm, rng.range(0, size), rng.range(0, size), rng.range(20, 90), size)
  }
  gm.globalAlpha = 1
  // 小傷（下地の鋼が覗く）
  gm.lineCap = 'round'
  for (let i = 0; i < 55; i++) {
    const x = rng.range(0, size)
    const y = rng.range(0, size)
    const a = rng.range(0, Math.PI * 2)
    gm.strokeStyle = `rgba(${rng.int(120, 165)},${rng.int(120, 165)},${rng.int(125, 170)},${rng.range(0.25, 0.7)})`
    gm.lineWidth = rng.range(0.5, 1.8)
    wrapLine(gm, x, y, x + Math.cos(a) * rng.range(6, 60), y + Math.sin(a) * rng.range(6, 60), size)
  }
  // 現場の粉じん
  gm.globalAlpha = 0.07
  gm.fillStyle = '#b8a68c'
  for (let i = 0; i < 60; i++) wrapCircle(gm, rng.range(0, size), rng.range(0, size), rng.range(30, 120), size)
  gm.globalAlpha = 1

  const { c: cr, g: gr } = makeCanvas(size)
  gr.fillStyle = '#8a8a8a'
  gr.fillRect(0, 0, size, size)
  const rng2 = new Rng(hex ^ 0x1234)
  fbmNoise(gr, size, rng2, 3, 0.22)
  gr.globalAlpha = 0.45
  for (let i = 0; i < 180; i++) {
    const v = rng2.int(100, 205)
    gr.fillStyle = `rgb(${v},${v},${v})`
    wrapCircle(gr, rng2.range(0, size), rng2.range(0, size), rng2.range(8, 46), size)
  }
  gr.globalAlpha = 1

  const map = toTexture(cm, 2, true, aniso)
  const roughnessMap = toTexture(cr, 2, false, aniso)
  cache.set(key + ':m', map)
  cache.set(key + ':r', roughnessMap)
  return { map, roughnessMap }
}

/** 成形滑走面：均一な玩具光沢を避け、使用痕の筋と成形むらを入れる。 */
export function moldedMaps(hex: number, aniso: number) {
  const key = `mold:${hex.toString(16)}`
  const cached = cache.get(key + ':m')
  if (cached) return { map: cached, roughnessMap: cache.get(key + ':r')! }
  const size = 512
  const base = new THREE.Color(hex)
  const { c: cm, g: gm } = makeCanvas(size)
  gm.fillStyle = `#${base.getHexString()}`
  gm.fillRect(0, 0, size, size)
  const rng = new Rng(0x9e11)
  gm.globalAlpha = 0.12
  for (let i = 0; i < 90; i++) {
    const shade = base.clone().offsetHSL(rng.range(-0.01, 0.01), rng.range(-0.06, 0.03), rng.range(-0.06, 0.06))
    gm.fillStyle = `#${shade.getHexString()}`
    wrapCircle(gm, rng.range(0, size), rng.range(0, size), rng.range(25, 110), size)
  }
  gm.globalAlpha = 1
  // 成形時の流れ筋（縦方向）
  for (let i = 0; i < 70; i++) {
    const x = rng.range(0, size)
    gm.strokeStyle = `rgba(255,255,255,${rng.range(0.02, 0.07)})`
    gm.lineWidth = rng.range(1, 5)
    wrapLine(gm, x, 0, x + rng.range(-10, 10), size, size)
  }

  const { c: cr, g: gr } = makeCanvas(size)
  gr.fillStyle = '#7d7d7d'
  gr.fillRect(0, 0, size, size)
  const rng2 = new Rng(0x33aa)
  fbmNoise(gr, size, rng2, 3, 0.18)
  // 滑走で磨かれた帯（中央）は少し滑らか、縁は荒い
  const grad = gr.createLinearGradient(0, 0, size, 0)
  grad.addColorStop(0, 'rgba(190,190,190,0.55)')
  grad.addColorStop(0.5, 'rgba(70,70,70,0.55)')
  grad.addColorStop(1, 'rgba(190,190,190,0.55)')
  gr.fillStyle = grad
  gr.fillRect(0, 0, size, size)

  const map = toTexture(cm, 1, true, aniso)
  const roughnessMap = toTexture(cr, 1, false, aniso)
  map.repeat.set(1, 3)
  roughnessMap.repeat.set(1, 3)
  cache.set(key + ':m', map)
  cache.set(key + ':r', roughnessMap)
  return { map, roughnessMap }
}

/** 鉄筋コンクリート基礎：骨材、型枠跡、端部の欠け、湿りむら。 */
export function concreteMaps(aniso: number) {
  const cached = cache.get('conc:m')
  if (cached) return { map: cached, roughnessMap: cache.get('conc:r')! }
  const size = 512
  const { c: cm, g: gm } = makeCanvas(size)
  gm.fillStyle = '#a9a49b'
  gm.fillRect(0, 0, size, size)
  const rng = new Rng(31337)
  fbmNoise(gm, size, rng, 3, 0.10)
  for (let i = 0; i < 900; i++) {
    const v = rng.int(120, 190)
    gm.fillStyle = `rgba(${v},${v - 4},${v - 12},${rng.range(0.15, 0.5)})`
    wrapCircle(gm, rng.range(0, size), rng.range(0, size), rng.range(1, 5), size)
  }
  // 湿りむら
  gm.globalAlpha = 0.16
  gm.fillStyle = '#5c5750'
  for (let i = 0; i < 26; i++) wrapCircle(gm, rng.range(0, size), rng.range(0, size), rng.range(30, 110), size)
  gm.globalAlpha = 1

  const { c: cr, g: gr } = makeCanvas(size)
  gr.fillStyle = '#d2d2d2'
  gr.fillRect(0, 0, size, size)
  const rng2 = new Rng(777)
  fbmNoise(gr, size, rng2, 4, 0.28)
  gr.globalAlpha = 0.4
  for (let i = 0; i < 30; i++) {
    gr.fillStyle = '#8c8c8c'
    wrapCircle(gr, rng2.range(0, size), rng2.range(0, size), rng2.range(30, 110), size)
  }
  gr.globalAlpha = 1

  const map = toTexture(cm, 3, true, aniso)
  const roughnessMap = toTexture(cr, 3, false, aniso)
  cache.set('conc:m', map)
  cache.set('conc:r', roughnessMap)
  return { map, roughnessMap }
}

/** 現場の地面：踏み固めた土、砕石、施工跡、乾湿の差。 */
export function groundMaps(aniso: number) {
  const cached = cache.get('grnd:m')
  if (cached) return { map: cached, roughnessMap: cache.get('grnd:r')! }
  const size = 1024
  const { c: cm, g: gm } = makeCanvas(size)
  gm.fillStyle = '#8b7a63'
  gm.fillRect(0, 0, size, size)
  const rng = new Rng(2024)
  fbmNoise(gm, size, rng, 4, 0.14)
  // 砕石
  for (let i = 0; i < 5200; i++) {
    const v = rng.int(120, 205)
    gm.fillStyle = `rgba(${v},${v - 8},${v - 22},${rng.range(0.25, 0.85)})`
    wrapCircle(gm, rng.range(0, size), rng.range(0, size), rng.range(1, 4.2), size)
  }
  // 重機のわだち・施工跡（タイルの繰り返しが目立たないよう控えめに）
  gm.strokeStyle = 'rgba(90,76,58,0.2)'
  for (let i = 0; i < 8; i++) {
    gm.lineWidth = rng.range(5, 14)
    const y = rng.range(0, size)
    wrapLine(gm, 0, y, size, y + rng.range(-40, 40), size)
  }
  gm.globalAlpha = 0.1
  gm.fillStyle = '#5b4c39'
  for (let i = 0; i < 26; i++) wrapCircle(gm, rng.range(0, size), rng.range(0, size), rng.range(20, 70), size)
  gm.globalAlpha = 1

  const { c: cr, g: gr } = makeCanvas(size)
  gr.fillStyle = '#e0e0e0'
  gr.fillRect(0, 0, size, size)
  const rng2 = new Rng(99)
  fbmNoise(gr, size, rng2, 5, 0.24)
  // 濡れている所は roughness を下げる
  gr.globalAlpha = 0.28
  gr.fillStyle = '#6a6a6a'
  for (let i = 0; i < 26; i++) wrapCircle(gr, rng2.range(0, size), rng2.range(0, size), rng2.range(25, 85), size)
  gr.globalAlpha = 1

  const map = toTexture(cm, 62, true, aniso)
  const roughnessMap = toTexture(cr, 62, false, aniso)
  cache.set('grnd:m', map)
  cache.set('grnd:r', roughnessMap)
  return { map, roughnessMap }
}

/** 繊維スリング／タグライン用の織り目 */
export function webbingMap(hex: number, aniso: number) {
  const key = `web:${hex.toString(16)}`
  const cached = cache.get(key)
  if (cached) return cached
  const size = 128
  const { c, g } = makeCanvas(size)
  const base = new THREE.Color(hex)
  g.fillStyle = `#${base.getHexString()}`
  g.fillRect(0, 0, size, size)
  const rng = new Rng(hex)
  for (let y = 0; y < size; y += 4) {
    g.fillStyle = `rgba(0,0,0,${rng.range(0.05, 0.14)})`
    g.fillRect(0, y, size, 2)
  }
  for (let x = 0; x < size; x += 6) {
    g.fillStyle = `rgba(255,255,255,${rng.range(0.03, 0.09)})`
    g.fillRect(x, 0, 2, size)
  }
  g.globalAlpha = 0.25
  g.fillStyle = '#6a5c48'
  for (let i = 0; i < 20; i++) wrapCircle(g, rng.range(0, size), rng.range(0, size), rng.range(4, 16), size)
  g.globalAlpha = 1
  const t = toTexture(c, 1, true, aniso)
  t.repeat.set(1, 8)
  cache.set(key, t)
  return t
}

export function disposeTextureCache() {
  cache.forEach((t) => t.dispose())
  cache.clear()
}
