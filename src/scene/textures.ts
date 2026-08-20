/**
 * Every texture in the game is generated here from noise. Nothing is
 * downloaded, so there are no third-party asset terms to record, and each
 * fruit / bag / sheet can be re-seeded for the next round.
 */
import * as THREE from 'three'
import { fbm2, fbmWrapU, hash2, makeRng, ridged, valueNoise2 } from '../sim/noise'

type Rgba = [number, number, number, number]

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0 || 1e-9))
  return t * t * (3 - 2 * t)
}

function makeTexture(
  size: number,
  fill: (u: number, v: number, out: Rgba) => void,
  srgb: boolean,
  wrapU: THREE.Wrapping = THREE.RepeatWrapping,
  wrapV: THREE.Wrapping = THREE.RepeatWrapping,
): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4)
  const out: Rgba = [0, 0, 0, 1]
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size
      out[0] = out[1] = out[2] = 0
      out[3] = 1
      fill(u, v, out)
      const i = (y * size + x) * 4
      data[i] = clamp01(out[0]) * 255
      data[i + 1] = clamp01(out[1]) * 255
      data[i + 2] = clamp01(out[2]) * 255
      data[i + 3] = clamp01(out[3]) * 255
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.wrapS = wrapU
  tex.wrapT = wrapV
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

/** Central-difference normal map from a height sampler. */
function normalFromHeight(
  size: number,
  height: (u: number, v: number) => number,
  strength: number,
  wrapU: THREE.Wrapping = THREE.RepeatWrapping,
): THREE.DataTexture {
  const e = 1 / size
  return makeTexture(
    size,
    (u, v, out) => {
      const hl = height(u - e, v)
      const hr = height(u + e, v)
      const hd = height(u, v - e)
      const hu = height(u, v + e)
      const nx = (hl - hr) * strength
      const ny = (hd - hu) * strength
      const nz = 1
      const l = Math.hypot(nx, ny, nz)
      out[0] = (nx / l) * 0.5 + 0.5
      out[1] = (ny / l) * 0.5 + 0.5
      out[2] = (nz / l) * 0.5 + 0.5
      out[3] = 1
    },
    false,
    wrapU,
  )
}

// ---------------------------------------------------------------- peach skin

export interface PeachTextures {
  map: THREE.DataTexture
  normalMap: THREE.DataTexture
  roughnessMap: THREE.DataTexture
  /** r = down density, g = down length jitter. */
  fuzzMap: THREE.DataTexture
  dispose(): void
}

export function makePeachTextures(seed: number, sutureU = 0, size = 512): PeachTextures {
  // Distance in u to the suture, wrapped.
  const sutureDist = (u: number) => {
    const d = Math.abs(((u - sutureU) % 1 + 1.5) % 1 - 0.5)
    return d
  }
  // Fine pores plus a few dozen shallow lenticel specks - never a clean sphere.
  const pores = (u: number, v: number) => fbmWrapU(u, v, 46, 4, seed) * 0.6 + fbmWrapU(u, v, 130, 2, seed + 7) * 0.4
  const speck = (u: number, v: number) => {
    const n = fbmWrapU(u, v, 22, 3, seed + 31)
    return smoothstep(0.71, 0.82, n)
  }

  const map = makeTexture(
    size,
    (u, v, out) => {
      // Base is the unripe flesh tone: pale straw-white with a green cast low
      // down. The pink is not painted here - the blush mask adds it later.
      const green = smoothstep(0.75, 1.0, v) * 0.5
      const warm = fbmWrapU(u, v, 6, 3, seed + 3)
      let r = mix(0.78, 0.6, green) + (warm - 0.5) * 0.07
      let g = mix(0.78, 0.74, green) + (warm - 0.5) * 0.06
      let b = mix(0.5, 0.38, green) + (warm - 0.5) * 0.06
      const sp = speck(u, v)
      r = mix(r, 0.93, sp * 0.5)
      g = mix(g, 0.9, sp * 0.5)
      b = mix(b, 0.72, sp * 0.5)
      const p = pores(u, v)
      const shade = 1 - (p - 0.5) * 0.09
      // The suture holds shadow and a little more colour than the cheeks.
      const su = (1 - smoothstep(0.006, 0.05, sutureDist(u))) * Math.pow(Math.sin(v * Math.PI), 0.5)
      // Neutral shading in the crease: tinting it unevenly turns the suture
      // into a lavender stripe, which no peach has.
      const groove = 1 - su * 0.26
      out[0] = r * shade * groove
      out[1] = g * shade * groove
      out[2] = b * shade * groove
      out[3] = 1
    },
    true,
  )

  const normalMap = normalFromHeight(
    size,
    (u, v) => pores(u, v) * 0.7 + speck(u, v) * 0.5 - (1 - smoothstep(0.004, 0.045, sutureDist(u))) * 1.6,
    1.5,
  )

  const roughnessMap = makeTexture(
    size,
    (u, v, out) => {
      // Downy but not chalky: 0.55-0.78, drifting with the pore field.
      const r = 0.6 + (fbmWrapU(u, v, 14, 3, seed + 51) - 0.5) * 0.24 + speck(u, v) * 0.06
      out[0] = out[1] = out[2] = clamp01(r)
      out[3] = 1
    },
    false,
  )

  const fuzzMap = makeTexture(
    size,
    (u, v, out) => {
      const d = fbmWrapU(u, v, 90, 3, seed + 91)
      const clump = fbmWrapU(u, v, 17, 2, seed + 111)
      out[0] = clamp01(0.42 + d * 0.58) * mix(0.75, 1, clump)
      out[1] = clamp01(fbmWrapU(u, v, 200, 2, seed + 133))
      out[2] = 0
      out[3] = 1
    },
    false,
  )

  return {
    map,
    normalMap,
    roughnessMap,
    fuzzMap,
    dispose() {
      map.dispose()
      normalMap.dispose()
      roughnessMap.dispose()
      fuzzMap.dispose()
    },
  }
}

/** Sparse down tips for the fuzz shells - mostly empty, that is the point. */
export function makeFuzzShellAlpha(seed: number, size = 256): THREE.DataTexture {
  return makeTexture(
    size,
    (u, v, out) => {
      // Cells must stay several texels wide, or every hair tip is lost to the
      // mip chain and the down silently disappears.
      const cell = 26
      const cx = Math.floor(u * cell)
      const cy = Math.floor(v * cell)
      let a = 0
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const gx = cx + ox
          const gy = cy + oy
          if (hash2(gx, gy, seed + 2) < 0.28) continue
          const jx = 0.2 + hash2(gx, gy, seed) * 0.6
          const jy = 0.2 + hash2(gx, gy, seed + 1) * 0.6
          const px = u * cell - gx - jx
          const py = v * cell - gy - jy
          const d = Math.hypot(px, py * 0.55)
          a = Math.max(a, (1 - smoothstep(0.08, 0.34, d)) * (0.55 + hash2(gx, gy, seed + 5) * 0.45))
        }
      }
      out[0] = out[1] = out[2] = 1
      out[3] = a
    },
    false,
  )
}

// ----------------------------------------------------------------- paper bag

export interface SurfaceTextures {
  map: THREE.DataTexture
  normalMap: THREE.DataTexture
  roughnessMap: THREE.DataTexture
  dispose(): void
}

function bundle(map: THREE.DataTexture, normalMap: THREE.DataTexture, roughnessMap: THREE.DataTexture): SurfaceTextures {
  return {
    map,
    normalMap,
    roughnessMap,
    dispose() {
      map.dispose()
      normalMap.dispose()
      roughnessMap.dispose()
    },
  }
}

export function makePaperTextures(seed: number, size = 512): SurfaceTextures {
  const rng = makeRng(seed | 0)
  // A handful of long creases, the way a folded fruit bag actually breaks.
  const creases = Array.from({ length: 7 }, () => ({
    a: rng() * Math.PI,
    o: rng(),
    w: 0.004 + rng() * 0.01,
  }))
  const creaseField = (u: number, v: number) => {
    let acc = 0
    for (const c of creases) {
      const d = Math.abs(u * Math.cos(c.a) + v * Math.sin(c.a) - c.o)
      acc += (1 - smoothstep(0, c.w, d)) * 0.6
    }
    return Math.min(1, acc)
  }
  const fibre = (u: number, v: number) => fbm2(u * 210, v * 26, 3, seed + 5) * 0.55 + fbm2(u * 30, v * 190, 3, seed + 9) * 0.45
  const height = (u: number, v: number) => fibre(u, v) * 0.35 + creaseField(u, v) * 0.9 + fbm2(u * 9, v * 9, 3, seed) * 0.3

  const map = makeTexture(
    size,
    (u, v, out) => {
      const f = fibre(u, v)
      const stain = smoothstep(0.62, 0.9, fbm2(u * 4.5, v * 4.5, 3, seed + 13))
      const cr = creaseField(u, v)
      let r = 0.86 + (f - 0.5) * 0.12
      let g = 0.8 + (f - 0.5) * 0.12
      let b = 0.64 + (f - 0.5) * 0.14
      r = mix(r, 0.72, stain * 0.5)
      g = mix(g, 0.66, stain * 0.5)
      b = mix(b, 0.52, stain * 0.5)
      const w = cr * 0.12
      out[0] = r + w
      out[1] = g + w
      out[2] = b + w
      out[3] = 1
    },
    true,
  )
  const normalMap = normalFromHeight(size, height, 2.4)
  const roughnessMap = makeTexture(
    size,
    (u, v, out) => {
      const r = 0.86 - creaseField(u, v) * 0.14 + (fibre(u, v) - 0.5) * 0.08
      out[0] = out[1] = out[2] = clamp01(r)
      out[3] = 1
    },
    false,
  )
  return bundle(map, normalMap, roughnessMap)
}

// ----------------------------------------------------------- reflective sheet

export function makeSheetTextures(seed: number, size = 512): SurfaceTextures {
  const rng = makeRng((seed * 7919) | 0)
  // Machine folds run across the roll; crumple runs everywhere.
  const folds = Array.from({ length: 5 }, (_, i) => 0.09 + i * 0.2 + (rng() - 0.5) * 0.05)
  const foldField = (v: number) => {
    let acc = 0
    for (const f of folds) acc += 1 - smoothstep(0, 0.012, Math.abs(v - f))
    return Math.min(1, acc)
  }
  const crumple = (u: number, v: number) =>
    ridged(u * 26, v * 22, 4, seed + 17) * 0.6 + fbm2(u * 90, v * 84, 3, seed + 23) * 0.4
  const dirt = (u: number, v: number) => smoothstep(0.68, 0.93, fbm2(u * 6, v * 5, 4, seed + 41))
  const height = (u: number, v: number) => crumple(u, v) * 0.5 + foldField(v) * 0.7

  const map = makeTexture(
    size,
    (u, v, out) => {
      // Bright, but a fabric white - never a mirror, never pure 1.0.
      const c = crumple(u, v)
      const d = dirt(u, v)
      let r = 0.83 + (c - 0.5) * 0.1
      let g = 0.82 + (c - 0.5) * 0.1
      let b = 0.78 + (c - 0.5) * 0.1
      r = mix(r, 0.55, d * 0.55)
      g = mix(g, 0.5, d * 0.55)
      b = mix(b, 0.42, d * 0.55)
      const f = foldField(v)
      r = mix(r, 0.82, f * 0.35)
      g = mix(g, 0.82, f * 0.35)
      b = mix(b, 0.8, f * 0.35)
      out[0] = r
      out[1] = g
      out[2] = b
      out[3] = 1
    },
    true,
  )
  const normalMap = normalFromHeight(size, height, 2.0)
  const roughnessMap = makeTexture(
    size,
    (u, v, out) => {
      // Patchy sheen: the plastic weave catches light unevenly.
      const gloss = smoothstep(0.45, 0.85, fbm2(u * 12, v * 11, 3, seed + 61))
      const r = mix(0.9, 0.68, gloss) + dirt(u, v) * 0.08
      out[0] = out[1] = out[2] = clamp01(r)
      out[3] = 1
    },
    false,
  )
  return bundle(map, normalMap, roughnessMap)
}

// ---------------------------------------------------------------------- leaf

export interface LeafTextures {
  map: THREE.DataTexture
  alphaMap: THREE.DataTexture
  normalMap: THREE.DataTexture
  dispose(): void
}

/** Peach leaves: long lanceolate blades with a serrated, irregular edge. */
export function makeLeafTextures(seed: number, size = 256): LeafTextures {
  const shape = (u: number, v: number) => {
    const t = v
    const w = Math.sin(Math.pow(t, 0.62) * Math.PI) * 0.44
    const serrate = Math.sin(t * 54) * 0.012 + (valueNoise2(t * 22, 3.1, seed) - 0.5) * 0.02
    return (w + serrate) - Math.abs(u - 0.5)
  }
  const vein = (u: number, v: number) => {
    const mid = 1 - smoothstep(0, 0.016, Math.abs(u - 0.5))
    const side = Math.abs(Math.sin((v * 13 + (u - 0.5) * 7) * Math.PI))
    return mid * 0.85 + (1 - smoothstep(0.9, 1.0, side)) * 0.25
  }
  const map = makeTexture(
    size,
    (u, v, out) => {
      const mottle = fbm2(u * 7, v * 7, 3, seed + 3)
      const edge = smoothstep(0.32, 0.46, Math.abs(u - 0.5))
      let r = 0.28 + mottle * 0.16
      let g = 0.44 + mottle * 0.2
      let b = 0.19 + mottle * 0.11
      r = mix(r, 0.35, edge * 0.5)
      g = mix(g, 0.42, edge * 0.3)
      b = mix(b, 0.16, edge * 0.4)
      const vn = vein(u, v)
      out[0] = mix(r, 0.42, vn * 0.5)
      out[1] = mix(g, 0.52, vn * 0.5)
      out[2] = mix(b, 0.24, vn * 0.5)
      out[3] = 1
    },
    true,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping,
  )
  const alphaMap = makeTexture(
    size,
    (u, v, out) => {
      const a = smoothstep(0, 0.012, shape(u, v)) * smoothstep(0, 0.02, v) * smoothstep(0, 0.02, 1 - v)
      out[0] = out[1] = out[2] = a
      out[3] = 1
    },
    false,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping,
  )
  const normalMap = normalFromHeight(size, (u, v) => vein(u, v) * 0.6 + fbm2(u * 20, v * 20, 2, seed + 8) * 0.2, 1.6, THREE.ClampToEdgeWrapping)
  return {
    map,
    alphaMap,
    normalMap,
    dispose() {
      map.dispose()
      alphaMap.dispose()
      normalMap.dispose()
    },
  }
}

// -------------------------------------------------------------------- ground

export function makeGroundTextures(seed: number, size = 512): SurfaceTextures {
  const soil = (u: number, v: number) => fbm2(u * 16, v * 16, 5, seed + 2)
  const litter = (u: number, v: number) => smoothstep(0.7, 0.9, fbm2(u * 40, v * 37, 3, seed + 6))
  const grass = (u: number, v: number) => smoothstep(0.52, 0.86, fbm2(u * 26, v * 24, 4, seed + 12))
  const map = makeTexture(
    size,
    (u, v, out) => {
      // Mown orchard floor: grass with soil showing through, not bare desert.
      const s = soil(u, v)
      let r = 0.22 + s * 0.14
      let g = 0.28 + s * 0.18
      let b = 0.12 + s * 0.06
      const bare = smoothstep(0.55, 0.86, fbm2(u * 5.5, v * 5.2, 4, seed + 33))
      r = mix(r, 0.3 + s * 0.16, bare * 0.85)
      g = mix(g, 0.24 + s * 0.14, bare * 0.85)
      b = mix(b, 0.16 + s * 0.08, bare * 0.85)
      const li = litter(u, v)
      r = mix(r, 0.44, li * 0.5)
      g = mix(g, 0.32, li * 0.5)
      b = mix(b, 0.17, li * 0.5)
      out[0] = r
      out[1] = g
      out[2] = b
      out[3] = 1
    },
    true,
  )
  const normalMap = normalFromHeight(size, (u, v) => soil(u, v) * 0.6 + litter(u, v) * 0.4, 1.4)
  const roughnessMap = makeTexture(
    size,
    (u, v, out) => {
      out[0] = out[1] = out[2] = clamp01(0.88 - grass(u, v) * 0.12)
      out[3] = 1
    },
    false,
  )
  return bundle(map, normalMap, roughnessMap)
}

// ----------------------------------------------------------- sky environment

/** Equirect summer sky, used both as background and as the PMREM source. */
export function makeSkyTexture(size = 256): THREE.DataTexture {
  const w = size * 2
  const h = size
  const data = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h
    // Row 0 of the data ends up at the bottom of the sphere, so v runs up.
    const el = -Math.cos(v * Math.PI) // +1 zenith .. -1 nadir
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w
      let r: number, g: number, b: number
      if (el >= 0) {
        const t = Math.pow(el, 0.55)
        r = mix(0.72, 0.24, t)
        g = mix(0.83, 0.46, t)
        b = mix(0.95, 0.82, t)
        const cloud = smoothstep(0.55, 0.85, fbm2(u * 9, v * 9, 4, 3)) * (1 - t) * 0.7
        r = mix(r, 0.97, cloud)
        g = mix(g, 0.97, cloud)
        b = mix(b, 0.98, cloud)
      } else {
        // Ground hemisphere. It must start from exactly the horizon colour, or
        // a tan band appears above the far edge of the terrain.
        const t = Math.pow(-el, 0.7)
        r = mix(0.72, 0.32, t)
        g = mix(0.83, 0.33, t)
        b = mix(0.95, 0.24, t)
      }
      const i = (y * w + x) * 4
      data[i] = clamp01(r) * 255
      data[i + 1] = clamp01(g) * 255
      data[i + 2] = clamp01(b) * 255
      data[i + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

/** Soft round sprite for airborne dust / pollen. */
export function makeMoteSprite(size = 64): THREE.DataTexture {
  return makeTexture(
    size,
    (u, v, out) => {
      const d = Math.hypot(u - 0.5, v - 0.5) * 2
      const a = Math.pow(1 - clamp01(d), 2.2)
      out[0] = out[1] = out[2] = 1
      out[3] = a
    },
    false,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping,
  )
}

// ------------------------------------------------------- vegetation billboards

/** A tuft of grass blades on a transparent quad. */
export function makeGrassTexture(seed: number, size = 128): { map: THREE.DataTexture; alphaMap: THREE.DataTexture } {
  const rng = makeRng((seed * 7717) | 0)
  const blades = Array.from({ length: 11 }, () => ({
    x: 0.12 + rng() * 0.76,
    lean: (rng() - 0.5) * 0.34,
    w: 0.022 + rng() * 0.026,
    h: 0.45 + rng() * 0.5,
    tone: rng(),
  }))
  const cover = (u: number, v: number) => {
    let best = 0
    let tone = 0
    for (const b of blades) {
      if (v > b.h) continue
      const t = v / b.h
      const cx = b.x + b.lean * t * t
      const w = b.w * (1 - t * 0.85)
      const d = Math.abs(u - cx)
      const a = 1 - smoothstep(w * 0.5, w, d)
      if (a > best) {
        best = a
        tone = b.tone
      }
    }
    return { a: best, tone }
  }
  const map = makeTexture(
    size,
    (u, v, out) => {
      const { tone } = cover(u, v)
      const shade = 0.68 + v * 0.62
      out[0] = (0.32 + tone * 0.2) * shade
      out[1] = (0.5 + tone * 0.26) * shade
      out[2] = (0.2 + tone * 0.12) * shade
      out[3] = 1
    },
    true,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping,
  )
  const alphaMap = makeTexture(
    size,
    (u, v, out) => {
      const { a } = cover(u, v)
      out[0] = out[1] = out[2] = a
      out[3] = 1
    },
    false,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping,
  )
  return { map, alphaMap }
}

/** Distant canopy blob - used only for background trees, never for the hero. */
export function makeCanopyTexture(seed: number, size = 256): { map: THREE.DataTexture; alphaMap: THREE.DataTexture } {
  const lobe = (u: number, v: number) => {
    const d = Math.hypot((u - 0.5) * 1.05, (v - 0.52) * 1.25)
    const wob = (fbm2(u * 5.5 + 3, v * 5.5 + 9, 4, seed) - 0.5) * 0.22
    return 0.46 + wob - d
  }
  const map = makeTexture(
    size,
    (u, v, out) => {
      const n = fbm2(u * 16, v * 16, 4, seed + 4)
      const n2 = fbm2(u * 44, v * 44, 3, seed + 8)
      const depth = smoothstep(0.1, 0.6, lobe(u, v))
      const lit = 0.45 + n * 0.5 + n2 * 0.2
      out[0] = (0.12 + lit * 0.2) * (0.65 + depth * 0.5)
      out[1] = (0.26 + lit * 0.34) * (0.65 + depth * 0.5)
      out[2] = (0.09 + lit * 0.16) * (0.65 + depth * 0.5)
      out[3] = 1
    },
    true,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping,
  )
  const alphaMap = makeTexture(
    size,
    (u, v, out) => {
      const n = fbm2(u * 22, v * 22, 4, seed + 12)
      const a = smoothstep(0.0, 0.09, lobe(u, v) + (n - 0.5) * 0.16)
      out[0] = out[1] = out[2] = a
      out[3] = 1
    },
    false,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping,
  )
  return { map, alphaMap }
}

/** Bark for the working branch. */
export function makeBarkTextures(seed: number, size = 512): SurfaceTextures {
  const grain = (u: number, v: number) => ridged(u * 5, v * 40, 4, seed) * 0.7 + fbm2(u * 20, v * 90, 3, seed + 3) * 0.3
  const map = makeTexture(
    size,
    (u, v, out) => {
      const g = grain(u, v)
      const moss = smoothstep(0.62, 0.9, fbm2(u * 7, v * 12, 3, seed + 21))
      let r = 0.26 + g * 0.2
      let gg = 0.2 + g * 0.16
      let b = 0.15 + g * 0.11
      r = mix(r, 0.24, moss * 0.5)
      gg = mix(gg, 0.31, moss * 0.5)
      b = mix(b, 0.16, moss * 0.5)
      out[0] = r
      out[1] = gg
      out[2] = b
      out[3] = 1
    },
    true,
  )
  const normalMap = normalFromHeight(size, grain, 2.6)
  const roughnessMap = makeTexture(
    size,
    (u, v, out) => {
      out[0] = out[1] = out[2] = clamp01(0.9 - grain(u, v) * 0.12)
      out[3] = 1
    },
    false,
  )
  return bundle(map, normalMap, roughnessMap)
}
