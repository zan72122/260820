import {
  CanvasTexture,
  ClampToEdgeWrapping,
  DataTexture,
  EquirectangularReflectionMapping,
  FloatType,
  LinearFilter,
  UnsignedByteType,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  type Texture,
  type WebGLRenderer,
} from 'three'
import { PMREMGenerator } from 'three'
import { Noise3 } from './noise'
import { Rng } from '../core/rng'
import { clamp01, smoothstep } from '../core/math'
import type { QualitySettings } from '../core/quality'

/**
 * Everything the game looks like is generated here, in code, at boot: fruit
 * skin, bark, leaves, cord fibre, the fine netting, the concrete floor and the
 * greenhouse environment probe. No external art, so nothing to license and
 * nothing to download.
 */

type PixelFn = (x: number, y: number, w: number, h: number, out: Float32Array) => void

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/**
 * Fill a raw RGBA byte buffer from a per-pixel function.
 *
 * Data maps must never go through a 2D canvas: canvases store premultiplied
 * alpha, so any channel packed into A silently destroys R, G and B. Raw bytes
 * uploaded as a DataTexture keep all four channels intact.
 *
 * Rows are written bottom-up so a DataTexture (flipY off) samples the same way
 * a CanvasTexture (flipY on) does.
 */
function paintData(w: number, h: number, fn: PixelFn): Uint8Array {
  const bytes = new Uint8Array(w * h * 4)
  const out = new Float32Array(4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 1
      fn(x, y, w, h, out)
      const o = ((h - 1 - y) * w + x) * 4
      bytes[o] = Math.round(clamp01(out[0]) * 255)
      bytes[o + 1] = Math.round(clamp01(out[1]) * 255)
      bytes[o + 2] = Math.round(clamp01(out[2]) * 255)
      bytes[o + 3] = Math.round(clamp01(out[3]) * 255)
    }
  }
  return bytes
}

/** Fill a canvas from a per-pixel function writing linear RGBA in 0..1. */
function paint(w: number, h: number, fn: PixelFn): HTMLCanvasElement {
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d', { willReadFrequently: false })!
  const img = ctx.createImageData(w, h)
  const px = img.data
  const out = new Float32Array(4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 1
      fn(x, y, w, h, out)
      const o = (y * w + x) * 4
      px[o] = Math.round(clamp01(out[0]) * 255)
      px[o + 1] = Math.round(clamp01(out[1]) * 255)
      px[o + 2] = Math.round(clamp01(out[2]) * 255)
      px[o + 3] = Math.round(clamp01(out[3]) * 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

/** Convert a height field into a tangent-space normal map canvas. */
function heightToNormal(
  w: number,
  h: number,
  height: Float32Array,
  strength: number,
  wrapX = true,
  wrapY = true,
): HTMLCanvasElement {
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(w, h)
  const px = img.data
  const at = (x: number, y: number): number => {
    let sx = x
    let sy = y
    if (wrapX) sx = (x + w) % w
    else sx = x < 0 ? 0 : x >= w ? w - 1 : x
    if (wrapY) sy = (y + h) % h
    else sy = y < 0 ? 0 : y >= h ? h - 1 : y
    return height[sy * w + sx]
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      let nx = -dx
      let ny = -dy
      let nz = 1
      const len = Math.hypot(nx, ny, nz)
      nx /= len; ny /= len; nz /= len
      const o = (y * w + x) * 4
      px[o] = Math.round((nx * 0.5 + 0.5) * 255)
      px[o + 1] = Math.round((ny * 0.5 + 0.5) * 255)
      px[o + 2] = Math.round((nz * 0.5 + 0.5) * 255)
      px[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

function tex(canvas: HTMLCanvasElement, srgb: boolean, aniso: number, repeat = true): Texture {
  const t = new CanvasTexture(canvas)
  if (srgb) t.colorSpace = SRGBColorSpace
  t.wrapS = repeat ? RepeatWrapping : ClampToEdgeWrapping
  t.wrapT = repeat ? RepeatWrapping : ClampToEdgeWrapping
  t.anisotropy = aniso
  t.minFilter = LinearMipmapLinearFilter
  t.magFilter = LinearFilter
  t.generateMipmaps = true
  t.needsUpdate = true
  return t
}

/** Direction on the unit sphere for an equirectangular UV, matching three's SphereGeometry. */
function dirFromUV(u: number, v: number, out: Float32Array): void {
  const theta = u * Math.PI * 2
  const phi = v * Math.PI
  const s = Math.sin(phi)
  out[0] = -s * Math.cos(theta)
  out[1] = Math.cos(phi)
  out[2] = s * Math.sin(theta)
}

// ------------------------------------------------------------------- mango

/** Ripening order is stored compressed into 0..1; the shader expands it. */
export const ORDER_SCALE = 1.6

/**
 * The fruit's data map. Nothing here is colour: it is the *order* in which the
 * skin ripens, plus the blemishes. Colour is resolved in the shader from a
 * single ripeness uniform, so green, yellow, orange and red can all be on the
 * fruit at once and the change spreads instead of switching.
 *
 *   R  broad mottle (green tone variation)
 *   G  ripening order, 0 ripens first (sun cheek) .. 1 last (stem shoulder)
 *   B  lenticels (the tiny pale pores)
 *   A  dark speckle that only shows on an over-ripe skin
 */
function mangoData(size: number, seed: number, speckleAmount: number): {
  data: Uint8Array
  width: number
  height: number
  normal: HTMLCanvasElement
} {
  const n = new Noise3(seed)
  const nb = new Noise3(seed ^ 0x51ab)
  const nl = new Noise3(seed ^ 0x9d3f)
  const dir = new Float32Array(3)
  const w = size
  const h = Math.max(64, Math.round(size * 0.5))
  const height = new Float32Array(w * h)

  const data = paintData(w, h, (x, y, ww, hh, out) => {
    const u = (x + 0.5) / ww
    const v = (y + 0.5) / hh
    dirFromUV(u, v, dir)
    const dx = dir[0], dy = dir[1], dz = dir[2]

    // Blush starts on the flank that faced the light and creeps around, so
    // the far side is still turning while the sun cheek is already red.
    const sun = dx * 0.80 + dy * 0.20 + dz * 0.30
    const grain = nb.fbm(dx * 2.6, dy * 2.6, dz * 2.6, 4) * 0.34
    const fine = nb.fbm(dx * 9.0, dy * 9.0, dz * 9.0, 3) * 0.1
    // The shoulder in the shade of its own stem is the last thing to turn.
    const stemEnd = smoothstep(0.0, 0.95, dy) * 0.62
    const order = clamp01(0.44 - sun * 0.5 + grain + fine + stemEnd)

    // Broad blotching plus a finer grain, so no part of the skin is ever flat.
    const mottle = clamp01(
      0.5 + n.fbm(dx * 4.2, dy * 4.2, dz * 4.2, 4) * 0.42 +
        n.fbm(dx * 17, dy * 17, dz * 17, 3) * 0.2,
    )

    // Lenticels: the small pale pores every mango skin is covered in.
    const cell = nl.fbm(dx * 34, dy * 34, dz * 34, 2)
    const pore = smoothstep(0.36, 0.56, cell) * (0.55 + 0.45 * clamp01(dy + 0.5))
    // Sparse dark speckle for the over-ripe skin: small marks, not patches.
    const blot = nl.fbm(dx * 62 + 11, dy * 62 - 7, dz * 62 + 3, 2)
    const speck = smoothstep(0.40, 0.55, blot) * speckleAmount

    out[0] = mottle
    out[1] = order
    out[2] = pore
    out[3] = speck

    // Height: pores dimple in, plus a broad orange-peel undulation.
    const broad = n.fbm(dx * 7.5, dy * 7.5, dz * 7.5, 3) * 0.5
    const orange = n.fbm(dx * 44, dy * 44, dz * 44, 2) * 0.13
    height[y * ww + x] = broad + orange - pore * 0.7 - speck * 0.35
  })

  return { data, width: w, height: h, normal: heightToNormal(w, h, height, 1.5) }
}

// -------------------------------------------------------------------- bark

function barkMaps(size: number, seed: number): {
  color: HTMLCanvasElement
  normal: HTMLCanvasElement
} {
  const n = new Noise3(seed)
  const w = size
  const h = Math.max(64, Math.round(size * 0.5))
  const height = new Float32Array(w * h)
  const color = paint(w, h, (x, y, ww, hh, out) => {
    const u = (x + 0.5) / ww
    const v = (y + 0.5) / hh
    // Seamless around the tube: sample noise on a cylinder.
    const a = u * Math.PI * 2
    const cx = Math.cos(a), cz = Math.sin(a)
    const ridge = n.ridged(cx * 3.1, v * 26, cz * 3.1, 4)
    const grain = n.fbm(cx * 9, v * 60, cz * 9, 3)
    const lentic = smoothstep(0.62, 0.78, n.fbm(cx * 18 + 5, v * 22, cz * 18, 2))
    const t = clamp01(ridge * 0.8 + grain * 0.24 + 0.16)
    // Grey-brown bark warming towards younger wood.
    const r = 0.20 + t * 0.30 + lentic * 0.16
    const g = 0.165 + t * 0.245 + lentic * 0.13
    const b = 0.13 + t * 0.17 + lentic * 0.09
    const moss = clamp01(n.fbm(cx * 5 - 3, v * 12, cz * 5, 3)) * 0.5
    out[0] = r * (1 - moss * 0.22)
    out[1] = g * (1 + moss * 0.26)
    out[2] = b * (1 - moss * 0.1)
    out[3] = 1
    height[y * ww + x] = ridge * 1.0 + grain * 0.3 + lentic * 0.35
  })
  return { color, normal: heightToNormal(w, h, height, 3.2) }
}

// -------------------------------------------------------------------- leaf

/**
 * Leaf maps in leaf space: u across the blade, v from petiole (0) to tip (1).
 * The silhouette itself is real geometry; alpha only carries margin damage.
 */
function leafMaps(size: number, seed: number): {
  color: HTMLCanvasElement
  normal: HTMLCanvasElement
} {
  const n = new Noise3(seed)
  const rng = new Rng(seed ^ 0x2f19)
  const nicks = Array.from({ length: 7 }, () => ({
    v: rng.range(0.1, 0.95),
    side: rng.bool() ? 1 : -1,
    r: rng.range(0.02, 0.075),
    depth: rng.range(0.25, 0.8),
  }))
  const w = size
  const h = size
  const height = new Float32Array(w * h)

  const color = paint(w, h, (x, y, ww, hh, out) => {
    const u = (x + 0.5) / ww
    const v = (y + 0.5) / hh
    const cu = u * 2 - 1 // -1..1 across the blade

    // Midrib and the secondary veins that fan off it.
    const mid = Math.exp(-Math.abs(cu) * 46) * (1 - smoothstep(0.9, 1.0, v))
    const veinFreq = 15
    const skew = cu * 2.6
    const veinPhase = (v * veinFreq + skew * Math.sign(cu) * 1.05)
    const vein = Math.pow(Math.abs(Math.sin(veinPhase * Math.PI)), 26) * smoothstep(0.03, 0.16, Math.abs(cu))
    const micro = n.fbm(u * 22, v * 30, 3.1, 3) * 0.5 + 0.5

    // Base colour: cooler and deeper towards the midrib, warmer at the margin.
    const deep = 1 - Math.abs(cu) * 0.35
    let r = 0.055 + 0.075 * (1 - deep) + micro * 0.03
    let g = 0.155 + 0.135 * deep + micro * 0.045
    let b = 0.045 + 0.04 * deep + micro * 0.02

    // Older leaves brown at the very margin and where they were nibbled.
    const margin = smoothstep(0.86, 1.0, Math.abs(cu))
    const age = clamp01(n.fbm(u * 5, v * 5 + 9, 1.7, 3) * 0.5 + 0.5)
    const brown = margin * age * 0.85
    r = r * (1 - brown) + 0.16 * brown
    g = g * (1 - brown) + 0.105 * brown
    b = b * (1 - brown) + 0.035 * brown

    // Veins read as slightly paler, the midrib paler still.
    const veinLight = vein * 0.4 + mid * 0.55
    r += veinLight * 0.09
    g += veinLight * 0.115
    b += veinLight * 0.035

    // Nibbled, dried patches around the margin. Kept as colour rather than
    // cut-outs: the blade's silhouette is real geometry, so nothing here
    // needs an alpha channel that a canvas would premultiply away.
    let bite = 0
    for (const nk of nicks) {
      const d = Math.hypot((v - nk.v) * 1.0, (Math.abs(cu) - 1) * 0.55)
      if (nk.side * cu > 0 && d < nk.r) {
        bite = Math.max(bite, (1 - smoothstep(nk.r * 0.5, nk.r, d)) * nk.depth)
      }
    }
    r = r * (1 - bite) + 0.135 * bite
    g = g * (1 - bite) + 0.088 * bite
    b = b * (1 - bite) + 0.032 * bite

    out[0] = r
    out[1] = g
    out[2] = b
    out[3] = 1

    height[y * ww + x] = mid * 1.2 + vein * 0.55 - micro * 0.18
  })
  return { color, normal: heightToNormal(w, h, height, 2.6, false, false) }
}

// -------------------------------------------------------------------- cord

/** Twisted three-ply cord fibre, tiled around and along every rope tube. */
function cordNormal(seed: number): HTMLCanvasElement {
  const w = 128
  const h = 128
  const n = new Noise3(seed)
  const height = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w // around the tube
      const v = (y + 0.5) / h // along the tube
      const ply = Math.sin((u * 3 + v * 3) * Math.PI * 2)
      const fibre = n.fbm(u * 26, v * 26, 4.4, 2) * 0.35
      const fuzz = n.fbm(u * 60, v * 60, 9.1, 2) * 0.18
      height[y * w + x] = ply * 0.75 + fibre + fuzz
    }
  }
  return heightToNormal(w, h, height, 1.9)
}

// ------------------------------------------------------- fine netting sheet

/**
 * The fine mesh between the structural cords: drawn with real strokes so the
 * knots stay crisp, then reused as both alpha and normal.
 */
function fineNetMaps(seed: number): {
  alpha: HTMLCanvasElement
  normal: HTMLCanvasElement
} {
  const size = 256
  const canvas = makeCanvas(size, size)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, size, size)
  const rng = new Rng(seed)
  const cells = 6
  const step = size / cells
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#fff'
  // Two diagonal families make the square knotted mesh of a fruit net.
  for (let d = -cells; d <= cells * 2; d++) {
    for (const sign of [1, -1]) {
      ctx.beginPath()
      ctx.lineWidth = step * (0.10 + rng.range(0, 0.035))
      const off = d * step
      for (let i = 0; i <= cells * 2; i++) {
        const t = i / (cells * 2)
        const x = t * size * 1.4 - size * 0.2
        const y = off + sign * x + rng.jitter(step * 0.05)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }
  // Knots where the families cross.
  ctx.fillStyle = '#fff'
  for (let i = -1; i <= cells + 1; i++) {
    for (let j = -1; j <= cells + 1; j++) {
      const x = (i + 0.5) * step + rng.jitter(step * 0.06)
      const y = (j + 0.5) * step + rng.jitter(step * 0.06)
      ctx.beginPath()
      ctx.ellipse(x, y, step * 0.105, step * 0.082, rng.range(0, Math.PI), 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const img = ctx.getImageData(0, 0, size, size)
  const height = new Float32Array(size * size)
  const alphaCanvas = makeCanvas(size, size)
  const actx = alphaCanvas.getContext('2d')!
  const aimg = actx.createImageData(size, size)
  for (let i = 0; i < size * size; i++) {
    const v = img.data[i * 4]
    height[i] = v / 255
    // three reads the green channel of an alphaMap, so keep it opaque.
    aimg.data[i * 4] = v
    aimg.data[i * 4 + 1] = v
    aimg.data[i * 4 + 2] = v
    aimg.data[i * 4 + 3] = 255
  }
  actx.putImageData(aimg, 0, 0)
  return { alpha: alphaCanvas, normal: heightToNormal(size, size, height, 2.4) }
}

// ------------------------------------------------------------------- floor

function floorMaps(size: number, seed: number): {
  color: HTMLCanvasElement
  normal: HTMLCanvasElement
} {
  const n = new Noise3(seed)
  const w = size
  const h = size
  const height = new Float32Array(w * h)
  const color = paint(w, h, (x, y, ww, hh, out) => {
    const u = (x + 0.5) / ww
    const v = (y + 0.5) / hh
    const a = u * Math.PI * 2
    const b = v * Math.PI * 2
    const grit = n.fbm(Math.cos(a) * 12, Math.sin(a) * 12, Math.cos(b) * 12 + Math.sin(b) * 12, 4)
    const damp = n.fbm(Math.cos(a) * 3, Math.sin(a) * 3, Math.cos(b) * 3, 3)
    const base = 0.27 + grit * 0.06
    const wet = smoothstep(0.15, 0.6, damp) * 0.4
    out[0] = base * (1 - wet * 0.4) + 0.035
    out[1] = base * (1 - wet * 0.38) + 0.032
    out[2] = base * (1 - wet * 0.32) + 0.026
    out[3] = 1
    height[y * ww + x] = grit
  })
  return { color, normal: heightToNormal(w, h, height, 0.85) }
}

// ------------------------------------------------------------- environment

/**
 * A tiny procedural greenhouse probe: bright diffused sky through glass,
 * a warm sun patch, green foliage bounce and a dim concrete floor. It is what
 * gives the fruit's wax and the leaves their believable sheen.
 */
function environmentTexture(size: number, sunAzimuth: number): DataTexture {
  const w = size * 2
  const h = size
  const data = new Float32Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h
    const phi = v * Math.PI
    const upness = Math.cos(phi)
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w
      const theta = u * Math.PI * 2
      let r: number, g: number, b: number
      if (upness > 0) {
        // Diffuse glass roof; slightly cool, with warm structural members.
        const k = Math.pow(upness, 0.6)
        r = 1.05 * k + 0.16
        g = 1.12 * k + 0.18
        b = 1.06 * k + 0.2
        const bars = Math.pow(Math.abs(Math.sin(theta * 6)), 22) * k
        r -= bars * 0.7; g -= bars * 0.72; b -= bars * 0.7
      } else {
        // Floor and benches: dim, slightly warm, with a green bounce band.
        const k = Math.pow(-upness, 0.8)
        r = 0.10 * (1 - k) + 0.05
        g = 0.115 * (1 - k) + 0.058
        b = 0.095 * (1 - k) + 0.045
        const band = Math.exp(-Math.pow(upness + 0.12, 2) * 90)
        r += band * 0.05; g += band * 0.11; b += band * 0.04
      }
      // The sun blob behind the glass.
      const dTheta = Math.atan2(Math.sin(theta - sunAzimuth), Math.cos(theta - sunAzimuth))
      const sun = Math.exp(-(dTheta * dTheta) / 0.055 - Math.pow(upness - 0.62, 2) / 0.03)
      r += sun * 5.2; g += sun * 4.7; b += sun * 3.6
      const o = (y * w + x) * 4
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 1
    }
  }
  const t = new DataTexture(data, w, h, RGBAFormat, FloatType)
  t.mapping = EquirectangularReflectionMapping
  t.needsUpdate = true
  return t
}

// -------------------------------------------------------------------- API

export interface TextureBundle {
  mangoData: Texture
  mangoNormal: Texture
  barkColor: Texture
  barkNormal: Texture
  leafColor: Texture
  leafNormal: Texture
  cordNormal: Texture
  fineAlpha: Texture
  fineNormal: Texture
  floorColor: Texture
  floorNormal: Texture
  env: Texture
  dispose(): void
}

const yieldToBrowser = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve())
    else setTimeout(resolve, 0)
  })

export async function buildTextures(
  renderer: WebGLRenderer,
  q: QualitySettings,
  seed: number,
  onProgress?: (fraction: number) => void,
): Promise<TextureBundle> {
  const aniso = Math.min(q.anisotropy, renderer.capabilities.getMaxAnisotropy())
  const steps = 7
  let done = 0
  const tick = async (): Promise<void> => {
    done++
    onProgress?.(done / steps)
    await yieldToBrowser()
  }

  const mango = mangoData(q.mangoTex, seed ^ 0x51ff, 0.6)
  await tick()
  const bark = barkMaps(q.barkTex, seed ^ 0x1234)
  await tick()
  const leaf = leafMaps(q.leafTex, seed ^ 0xabcd)
  await tick()
  const cord = cordNormal(seed ^ 0x77aa)
  await tick()
  const fine = fineNetMaps(seed ^ 0x33cc)
  await tick()
  const floor = floorMaps(q.floorTex, seed ^ 0x9911)
  await tick()

  const equirect = environmentTexture(q.envSize, Math.PI * 0.62)
  const pmrem = new PMREMGenerator(renderer)
  const env = pmrem.fromEquirectangular(equirect).texture
  pmrem.dispose()
  equirect.dispose()
  await tick()

  const mangoTexture = new DataTexture(
    mango.data,
    mango.width,
    mango.height,
    RGBAFormat,
    UnsignedByteType,
  )
  mangoTexture.wrapS = RepeatWrapping
  mangoTexture.wrapT = ClampToEdgeWrapping
  mangoTexture.minFilter = LinearMipmapLinearFilter
  mangoTexture.magFilter = LinearFilter
  mangoTexture.generateMipmaps = true
  mangoTexture.anisotropy = aniso
  mangoTexture.needsUpdate = true

  const bundle: TextureBundle = {
    mangoData: mangoTexture,
    mangoNormal: tex(mango.normal, false, aniso),
    barkColor: tex(bark.color, true, aniso),
    barkNormal: tex(bark.normal, false, aniso),
    leafColor: tex(leaf.color, true, aniso, false),
    leafNormal: tex(leaf.normal, false, aniso, false),
    cordNormal: tex(cord, false, aniso),
    fineAlpha: tex(fine.alpha, false, aniso),
    fineNormal: tex(fine.normal, false, aniso),
    floorColor: tex(floor.color, true, aniso),
    floorNormal: tex(floor.normal, false, aniso),
    env,
    dispose(): void {
      for (const key of Object.keys(bundle) as (keyof TextureBundle)[]) {
          const value = bundle[key]
        if (value && typeof value === 'object' && 'dispose' in value) {
          ;(value as Texture).dispose()
        }
      }
    },
  }
  return bundle
}
