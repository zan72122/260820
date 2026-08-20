import {
  CanvasTexture,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  UnsignedByteType,
} from 'three'
import { clamp01, makeRng, mix, smoothstep, tileFbm, tileNoise } from './noise'

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function toTexture(data: Uint8Array, w: number, h: number, srgb: boolean): DataTexture {
  const t = new DataTexture(data, w, h, RGBAFormat, UnsignedByteType)
  t.wrapS = RepeatWrapping
  t.wrapT = RepeatWrapping
  t.magFilter = LinearFilter
  t.minFilter = LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.anisotropy = 8
  if (srgb) t.colorSpace = SRGBColorSpace
  t.needsUpdate = true
  return t
}

/** Sobel a wrapping height field into a tangent-space normal map. */
function normalFromHeight(height: Float32Array, w: number, h: number, strength: number): Uint8Array {
  const out = new Uint8Array(w * h * 4)
  const at = (x: number, y: number) => height[(((y % h) + h) % h) * w + (((x % w) + w) % w)]
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = at(x - 1, y)
      const r = at(x + 1, y)
      const d = at(x, y - 1)
      const u = at(x, y + 1)
      let nx = (l - r) * strength
      let ny = (d - u) * strength
      const nz = 1
      const inv = 1 / Math.hypot(nx, ny, nz)
      nx *= inv
      ny *= inv
      const i = (y * w + x) * 4
      out[i] = Math.round((nx * 0.5 + 0.5) * 255)
      out[i + 1] = Math.round((ny * 0.5 + 0.5) * 255)
      out[i + 2] = Math.round((nz * inv * 0.5 + 0.5) * 255)
      out[i + 3] = 255
    }
  }
  return out
}

export interface SurfaceMaps {
  map: DataTexture
  roughnessMap: DataTexture
  normalMap: DataTexture
}

/* ------------------------------------------------------------------ *
 * Bamboo
 *
 * One tile spans exactly two culm nodes along U so the painted node
 * rings land on the geometry's node bulges. V wraps the half section:
 * v = 0 and v = 1 are the two cut rims, v = 0.5 is the trough bottom.
 * ------------------------------------------------------------------ */

const BAMBOO_W = 1024
const BAMBOO_H = 320

/** Sharp, slightly irregular ring profile centred on `c` in U space. */
function nodeProfile(u: number, c: number, v: number, seed: number): { ridge: number; below: number; above: number } {
  const jitter = (tileNoise(v * 26, seed * 7.1, 26, 8, seed) - 0.5) * 0.004
  const d = u - c - jitter
  // The ridge itself: fast rise, slow fall on the culm's upper side.
  const ridge = Math.exp(-((d / 0.0105) ** 2))
  const below = smoothstep(-0.030, -0.010, d) * (1 - smoothstep(-0.010, 0.0, d))
  const above = smoothstep(0.004, 0.012, d) * (1 - smoothstep(0.012, 0.062, d))
  return { ridge, below, above }
}

export function bakeBambooOuter(): SurfaceMaps {
  const w = BAMBOO_W
  const h = BAMBOO_H
  const col = new Uint8Array(w * h * 4)
  const rgh = new Uint8Array(w * h * 4)
  const hgt = new Float32Array(w * h)
  const rng = makeRng(20260820)

  // Longitudinal scratches: a scratch is a u-aligned streak at a fixed v.
  const scratches: { v: number; u0: number; u1: number; depth: number; width: number }[] = []
  for (let i = 0; i < 220; i++) {
    const u0 = rng()
    scratches.push({
      v: rng(),
      u0,
      u1: u0 + 0.03 + rng() * 0.42,
      depth: (rng() - 0.35) * 1.6,
      width: 0.0012 + rng() * 0.0034,
    })
  }

  for (let y = 0; y < h; y++) {
    const v = y / h
    for (let x = 0; x < w; x++) {
      const u = x / w
      const i = (y * w + x) * 4

      // --- base colour: sun bleached madake, greener near the rims -----
      const blotch = tileFbm(u * 5, v * 3, 5, 3, 3, 11)
      const patina = tileFbm(u * 13, v * 2.2, 13, 2, 3, 29)
      const greenish = smoothstep(0.62, 0.02, Math.abs(v - 0.5) * 2) * 0.45 + 0.25
      let r = mix(196, 150, greenish) + (blotch - 0.5) * 46 + (patina - 0.5) * 16
      let g = mix(190, 166, greenish * 0.4) + (blotch - 0.5) * 34 + (patina - 0.5) * 12
      let b = mix(140, 88, greenish) + (blotch - 0.5) * 30 - patina * 10

      // --- fibres: fine longitudinal grain --------------------------------
      const fibreA = tileNoise(u * 22, v * 340, 22, 340, 3)
      const fibreB = tileNoise(u * 90, v * 150, 90, 150, 5)
      const fibre = (fibreA - 0.5) * 0.72 + (fibreB - 0.5) * 0.28
      r += fibre * 24
      g += fibre * 23
      b += fibre * 17
      let height = fibre * 0.32

      // --- flecks and mildew ----------------------------------------------
      const fleck = tileFbm(u * 60, v * 34, 60, 34, 2, 41)
      const dark = smoothstep(0.74, 0.9, fleck)
      r -= dark * 62
      g -= dark * 54
      b -= dark * 34

      let rough = 0.60 + (1 - blotch) * 0.1 + dark * 0.12

      // --- the two culm nodes ---------------------------------------------
      for (const c of [0.25, 0.75]) {
        const n = nodeProfile(u, c, v, c * 10)
        if (n.ridge + n.below + n.above < 0.002) continue
        height += n.ridge * 3.4 - n.below * 0.7
        // dark collar under the ring, waxy pale band above it
        r += -n.below * 46 + n.above * 30 + n.ridge * 18
        g += -n.below * 44 + n.above * 30 + n.ridge * 18
        b += -n.below * 26 + n.above * 34 + n.ridge * 20
        rough += n.above * 0.16 + n.ridge * 0.06 - n.below * 0.04
        // hairline cracks radiating from the ring
        const crack = smoothstep(0.86, 1.0, tileNoise(v * 90, c * 33, 90, 8, 77))
        height -= crack * n.ridge * 1.6
        r -= crack * n.ridge * 40
        g -= crack * n.ridge * 38
        b -= crack * n.ridge * 26
      }

      // --- scratches --------------------------------------------------------
      for (let s = 0; s < scratches.length; s++) {
        const sc = scratches[s]
        let du = u - sc.u0
        if (du < -0.5) du += 1
        if (du > 0.5) du -= 1
        const len = sc.u1 - sc.u0
        if (du < 0 || du > len) continue
        let dv = Math.abs(v - sc.v)
        dv = Math.min(dv, 1 - dv)
        const f = Math.exp(-((dv / sc.width) ** 2)) * Math.sin((du / len) * Math.PI)
        if (f < 0.01) continue
        height -= f * sc.depth * 0.9
        const bright = f * sc.depth * 12
        r += bright
        g += bright
        b += bright * 0.7
        rough += f * 0.18
      }

      col[i] = clamp01(r / 255) * 255
      col[i + 1] = clamp01(g / 255) * 255
      col[i + 2] = clamp01(b / 255) * 255
      col[i + 3] = 255
      const rr = clamp01(rough) * 255
      rgh[i] = 255
      rgh[i + 1] = rr
      rgh[i + 2] = 30
      rgh[i + 3] = 255
      hgt[y * w + x] = height
    }
  }

  return {
    map: toTexture(col, w, h, true),
    roughnessMap: toTexture(rgh, w, h, false),
    normalMap: toTexture(normalFromHeight(hgt, w, h, 1.5), w, h, false),
  }
}

/**
 * The concave inside of the split culm. V is the angle around the trough,
 * so the waterline is a constant V band — that is where the roughness
 * drops to a wet mirror.
 */
export function bakeBambooInner(wetV0: number, wetV1: number): SurfaceMaps {
  const w = BAMBOO_W
  const h = BAMBOO_H
  const col = new Uint8Array(w * h * 4)
  const rgh = new Uint8Array(w * h * 4)
  const hgt = new Float32Array(w * h)

  for (let y = 0; y < h; y++) {
    const v = y / h
    // 1 fully submerged, 0 bone dry, with a damp band above the waterline.
    const wet =
      smoothstep(wetV0 - 0.012, wetV0 + 0.02, v) * (1 - smoothstep(wetV1 - 0.02, wetV1 + 0.012, v))
    const damp =
      smoothstep(wetV0 - 0.085, wetV0, v) * (1 - smoothstep(wetV1, wetV1 + 0.085, v))
    for (let x = 0; x < w; x++) {
      const u = x / w
      const i = (y * w + x) * 4

      // --- pale ivory split face, greener towards the cut rims ------------
      const blotch = tileFbm(u * 6, v * 3, 6, 3, 3, 91)
      const rimGreen = smoothstep(0.55, 1.0, Math.abs(v - 0.5) * 2)
      let r = mix(228, 205, rimGreen) + (blotch - 0.5) * 26
      let g = mix(219, 207, rimGreen) + (blotch - 0.5) * 22
      let b = mix(191, 158, rimGreen) + (blotch - 0.5) * 20

      // --- fibres ---------------------------------------------------------
      const fibreA = tileNoise(u * 18, v * 420, 18, 420, 13)
      const fibreB = tileNoise(u * 120, v * 190, 120, 190, 17)
      const fibre = (fibreA - 0.5) * 0.78 + (fibreB - 0.5) * 0.22
      r += fibre * 26
      g += fibre * 25
      b += fibre * 22
      let height = fibre * 0.26

      // --- node scars: the chiselled-out diaphragm leaves a rough ridge ---
      for (const c of [0.25, 0.75]) {
        const wob = (tileNoise(v * 40, c * 21, 40, 9, 61) - 0.5) * 0.006
        const d = u - c - wob
        const ridge = Math.exp(-((d / 0.0135) ** 2))
        if (ridge < 0.004) continue
        const chip = tileFbm(v * 55, c * 12, 55, 6, 2, 33)
        height += ridge * (1.9 + chip * 1.5)
        const tone = ridge * (16 + chip * 26)
        r += tone * 0.5 - ridge * 22
        g += tone * 0.45 - ridge * 24
        b += tone * 0.2 - ridge * 30
      }

      // --- water tone: submerged bamboo darkens and goes amber -------------
      const stain = tileFbm(u * 9, v * 5, 9, 5, 3, 7)
      const wetTone = wet * (0.80 + stain * 0.06)
      r = mix(r, r * (0.82 - stain * 0.05), wetTone)
      g = mix(g, g * (0.80 - stain * 0.05), wetTone)
      b = mix(b, b * (0.70 - stain * 0.04), wetTone)

      // dried mineral tide-line just above the water
      const tide = Math.exp(-(((v - wetV1) / 0.012) ** 2)) + Math.exp(-(((v - wetV0) / 0.012) ** 2))
      r += tide * 16
      g += tide * 16
      b += tide * 13

      const rough = mix(mix(0.56 + (1 - blotch) * 0.08, 0.30, damp), 0.075, wet)

      col[i] = clamp01(r / 255) * 255
      col[i + 1] = clamp01(g / 255) * 255
      col[i + 2] = clamp01(b / 255) * 255
      col[i + 3] = 255
      rgh[i] = 255
      rgh[i + 1] = clamp01(rough) * 255
      rgh[i + 2] = 30
      rgh[i + 3] = 255
      hgt[y * w + x] = height * (1 - wet * 0.45)
    }
  }

  return {
    map: toTexture(col, w, h, true),
    roughnessMap: toTexture(rgh, w, h, false),
    normalMap: toTexture(normalFromHeight(hgt, w, h, 1.15), w, h, false),
  }
}

/* ------------------------------------------------------------------ *
 * Ground, foliage, wood, ceramic
 * ------------------------------------------------------------------ */

export function bakeGround(): { map: DataTexture; roughnessMap: DataTexture; normalMap: DataTexture } {
  const w = 512
  const h = 512
  const col = new Uint8Array(w * h * 4)
  const rgh = new Uint8Array(w * h * 4)
  const hgt = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w
      const v = y / h
      const i = (y * w + x) * 4
      const macro = tileFbm(u * 4, v * 4, 4, 4, 4, 3)
      const blade = tileNoise(u * 190, v * 44, 190, 44, 23)
      const blade2 = tileNoise(u * 46, v * 200, 46, 200, 27)
      const moss = smoothstep(0.42, 0.72, macro)
      const dirt = smoothstep(0.36, 0.12, macro)
      let r = mix(96, 58, moss) + dirt * 62 + (blade - 0.5) * 30 + (blade2 - 0.5) * 26
      let g = mix(112, 96, moss) + dirt * 34 + (blade - 0.5) * 34 + (blade2 - 0.5) * 28
      let b = mix(56, 44, moss) + dirt * 22 + (blade - 0.5) * 18 + (blade2 - 0.5) * 16
      col[i] = clamp01(r / 255) * 255
      col[i + 1] = clamp01(g / 255) * 255
      col[i + 2] = clamp01(b / 255) * 255
      col[i + 3] = 255
      rgh[i] = 255
      rgh[i + 1] = clamp01(0.86 - moss * 0.08) * 255
      rgh[i + 2] = 30
      rgh[i + 3] = 255
      hgt[y * w + x] = (blade - 0.5) * 0.8 + (blade2 - 0.5) * 0.7 + (macro - 0.5) * 2.2
    }
  }
  return {
    map: toTexture(col, w, h, true),
    roughnessMap: toTexture(rgh, w, h, false),
    normalMap: toTexture(normalFromHeight(hgt, w, h, 2.4), w, h, false),
  }
}

export function bakeWood(): { map: DataTexture; roughnessMap: DataTexture; normalMap: DataTexture } {
  const w = 512
  const h = 512
  const col = new Uint8Array(w * h * 4)
  const rgh = new Uint8Array(w * h * 4)
  const hgt = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w
      const v = y / h
      const i = (y * w + x) * 4
      // Plank seams every 1/4 of the tile, running along U.
      const plank = Math.floor(v * 4)
      const seam = Math.exp(-(((v * 4 - plank) / 0.035) ** 2)) + Math.exp(-(((v * 4 - plank - 1) / 0.035) ** 2))
      const grainPhase = tileFbm(u * 3, (v + plank * 3.7) * 26, 3, 26, 3, plank * 17 + 5)
      const rings = Math.abs(Math.sin((v * 46 + grainPhase * 9 + plank * 2.3) * Math.PI))
      const grain = Math.pow(rings, 2.4)
      let r = 138 - grain * 46 - seam * 70 + (grainPhase - 0.5) * 24
      let g = 108 - grain * 40 - seam * 58 + (grainPhase - 0.5) * 18
      let b = 76 - grain * 30 - seam * 44 + (grainPhase - 0.5) * 12
      col[i] = clamp01(r / 255) * 255
      col[i + 1] = clamp01(g / 255) * 255
      col[i + 2] = clamp01(b / 255) * 255
      col[i + 3] = 255
      rgh[i] = 255
      rgh[i + 1] = clamp01(0.52 + grain * 0.2 + seam * 0.2) * 255
      rgh[i + 2] = 30
      rgh[i + 3] = 255
      hgt[y * w + x] = -grain * 0.6 - seam * 3.0
    }
  }
  return {
    map: toTexture(col, w, h, true),
    roughnessMap: toTexture(rgh, w, h, false),
    normalMap: toTexture(normalFromHeight(hgt, w, h, 1.6), w, h, false),
  }
}

/** A cluster of leaves on transparent background, for foliage cards. */
export function bakeLeafCard(seed: number, tint: [number, number, number]): CanvasTexture {
  const size = 512
  const c = makeCanvas(size, size)
  const g = c.getContext('2d')!
  g.clearRect(0, 0, size, size)
  const rng = makeRng(seed)
  const leaves = 130
  for (let i = 0; i < leaves; i++) {
    // Cluster towards the centre, thin out at the silhouette edge.
    const a = rng() * Math.PI * 2
    const rad = Math.pow(rng(), 0.62) * size * 0.47
    const cx = size / 2 + Math.cos(a) * rad
    const cy = size / 2 + Math.sin(a) * rad * 0.86
    const len = size * (0.055 + rng() * 0.075) * (1 - rad / size)
    const wid = len * (0.28 + rng() * 0.2)
    const rot = rng() * Math.PI * 2
    const shade = 0.55 + rng() * 0.6 - (rad / size) * 0.25
    g.save()
    g.translate(cx, cy)
    g.rotate(rot)
    g.beginPath()
    g.moveTo(0, -len)
    g.quadraticCurveTo(wid, -len * 0.15, 0, len)
    g.quadraticCurveTo(-wid, -len * 0.15, 0, -len)
    g.closePath()
    const r = Math.round(clamp01((tint[0] * shade) / 255) * 255)
    const gg = Math.round(clamp01((tint[1] * shade) / 255) * 255)
    const b = Math.round(clamp01((tint[2] * shade) / 255) * 255)
    g.fillStyle = `rgb(${r},${gg},${b})`
    g.globalAlpha = 0.88 + rng() * 0.12
    g.fill()
    g.restore()
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  t.needsUpdate = true
  return t
}

/** Soft radial falloff used for glints, splashes and the sun flare. */
export function bakeGlow(inner = 0.0, power = 2.2): CanvasTexture {
  const size = 128
  const c = makeCanvas(size, size)
  const g = c.getContext('2d')!
  const img = g.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5
      const dy = (y + 0.5) / size - 0.5
      const d = Math.hypot(dx, dy) * 2
      const a = Math.pow(clamp01(1 - Math.max(0, d - inner) / (1 - inner)), power)
      const i = (y * size + x) * 4
      img.data[i] = 255
      img.data[i + 1] = 255
      img.data[i + 2] = 255
      img.data[i + 3] = Math.round(a * 255)
    }
  }
  g.putImageData(img, 0, 0)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.needsUpdate = true
  return t
}

export function disposeAll(list: (Texture | null | undefined)[]): void {
  for (const t of list) t?.dispose()
}
