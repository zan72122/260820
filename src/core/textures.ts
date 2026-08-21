import * as THREE from 'three'
import { Rng, clamp01, lerp, smoothstep } from './math'

type Ctx = CanvasRenderingContext2D

function makeCanvas(size: number, height = size): { c: HTMLCanvasElement; x: Ctx } {
  const c = document.createElement('canvas')
  c.width = size
  c.height = height
  const x = c.getContext('2d', { willReadFrequently: true })
  if (!x) throw new Error('2D canvas context unavailable')
  return { c, x }
}

/** Tileable value noise sampled on a torus so generated maps repeat seamlessly. */
function valueNoise(seed: number, period: number): (x: number, y: number) => number {
  const rng = new Rng(seed)
  const grid = new Float32Array(period * period)
  for (let i = 0; i < grid.length; i++) grid[i] = rng.next()
  const at = (ix: number, iy: number): number =>
    grid[(((iy % period) + period) % period) * period + (((ix % period) + period) % period)]
  return (x, y) => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = x - x0
    const fy = y - y0
    const ux = fx * fx * (3 - 2 * fx)
    const uy = fy * fy * (3 - 2 * fy)
    const a = at(x0, y0)
    const b = at(x0 + 1, y0)
    const c = at(x0, y0 + 1)
    const d = at(x0 + 1, y0 + 1)
    return lerp(lerp(a, b, ux), lerp(c, d, ux), uy)
  }
}

function fbm(
  seed: number,
  basePeriod: number,
  octaves: number,
): (x: number, y: number) => number {
  const layers: Array<{ n: (x: number, y: number) => number; f: number; a: number }> = []
  let amp = 1
  let total = 0
  for (let o = 0; o < octaves; o++) {
    const f = Math.pow(2, o)
    layers.push({ n: valueNoise(seed + o * 7919, basePeriod * f), f, a: amp })
    total += amp
    amp *= 0.5
  }
  return (x, y) => {
    let s = 0
    for (const l of layers) s += l.n(x * l.f, y * l.f) * l.a
    return s / total
  }
}

function writePixels(
  x: Ctx,
  size: number,
  fn: (u: number, v: number) => [number, number, number],
): void {
  const img = x.createImageData(size, size)
  const d = img.data
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const [r, g, b] = fn(i / size, j / size)
      const k = (j * size + i) * 4
      d[k] = clamp01(r) * 255
      d[k + 1] = clamp01(g) * 255
      d[k + 2] = clamp01(b) * 255
      d[k + 3] = 255
    }
  }
  x.putImageData(img, 0, 0)
}

function toTexture(c: HTMLCanvasElement, srgb: boolean, repeat = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.anisotropy = 4
  t.needsUpdate = true
  return t
}

/** Derive a tangent-space normal map from a grayscale height canvas. */
function heightToNormal(src: HTMLCanvasElement, strength: number): THREE.CanvasTexture {
  const size = src.width
  const sx = src.getContext('2d', { willReadFrequently: true })
  if (!sx) throw new Error('2D canvas context unavailable')
  const h = sx.getImageData(0, 0, size, size).data
  const height = (i: number, j: number): number => {
    const ii = ((i % size) + size) % size
    const jj = ((j % size) + size) % size
    return h[(jj * size + ii) * 4] / 255
  }
  const { c, x } = makeCanvas(size)
  const img = x.createImageData(size, size)
  const d = img.data
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const dx = (height(i + 1, j) - height(i - 1, j)) * strength
      const dy = (height(i, j + 1) - height(i, j - 1)) * strength
      let nx = -dx
      let ny = -dy
      const nz = 1
      const len = Math.hypot(nx, ny, nz)
      nx /= len
      ny /= len
      const k = (j * size + i) * 4
      d[k] = (nx * 0.5 + 0.5) * 255
      d[k + 1] = (ny * 0.5 + 0.5) * 255
      d[k + 2] = (nz / len) * 0.5 * 255 + 127.5
      d[k + 3] = 255
    }
  }
  x.putImageData(img, 0, 0)
  return toTexture(c, false)
}

export interface TextureSet {
  rollerMap: THREE.Texture
  rollerRough: THREE.Texture
  rollerNormal: THREE.Texture
  galvMap: THREE.Texture
  galvRough: THREE.Texture
  paintMap: THREE.Texture
  paintRough: THREE.Texture
  groundMap: THREE.Texture
  groundRough: THREE.Texture
  groundNormal: THREE.Texture
  concreteMap: THREE.Texture
  concreteRough: THREE.Texture
  diffuserMap: THREE.Texture
  barkMap: THREE.Texture
  barkRough: THREE.Texture
  woodMap: THREE.Texture
  lightPool: THREE.Texture
  contact: THREE.Texture
  leaf: THREE.Texture
  glow: THREE.Texture
  windows: THREE.Texture
}

/* ------------------------------------------------------------------ */

function buildRoller(): {
  map: THREE.Texture
  rough: THREE.Texture
  normal: THREE.Texture
} {
  const S = 256
  // Cylinder UVs: u wraps around the circumference, v runs along the roller axis.
  const grain = fbm(1201, 8, 4)
  const scuff = fbm(3307, 16, 3)
  const dew = fbm(5501, 6, 3)

  const { c: mc, x: mx } = makeCanvas(S)
  writePixels(mx, S, (u, v) => {
    // Ends of the roller are darker: grime collects at the bearing collars.
    const endMask = smoothstep(0.0, 0.09, v) * smoothstep(1.0, 0.91, v)
    const collar = 1 - smoothstep(0.055, 0.085, Math.min(v, 1 - v))
    const g = grain(u * 8, v * 8)
    // UV chalking: sun-bleached resin reads slightly desaturated and lighter.
    const chalk = smoothstep(0.35, 0.85, grain(u * 3 + 11, v * 3 + 4))
    // Wear band across the middle where shoes and clothing rub.
    const rub = smoothstep(0.22, 0.5, 1 - Math.abs(v - 0.5) * 2) * scuff(u * 16, v * 6)
    let r = 0.2 + g * 0.05
    let gg = 0.205 + g * 0.05
    let b = 0.212 + g * 0.05
    r = lerp(r, 0.335, chalk * 0.7)
    gg = lerp(gg, 0.335, chalk * 0.66)
    b = lerp(b, 0.33, chalk * 0.6)
    const polish = rub * 0.16
    r -= polish
    gg -= polish
    b -= polish * 0.9
    const e = lerp(0.42, 1, endMask) * lerp(1, 0.55, collar)
    return [r * e, gg * e, b * e]
  })

  const { c: hc, x: hx } = makeCanvas(S)
  writePixels(hx, S, (u, v) => {
    const collar = 1 - smoothstep(0.05, 0.082, Math.min(v, 1 - v))
    const g = grain(u * 8, v * 8) * 0.5 + scuff(u * 24, v * 10) * 0.5
    const h = lerp(g, 0.15, collar)
    return [h, h, h]
  })

  const { c: rc, x: rx } = makeCanvas(S)
  writePixels(rx, S, (u, v) => {
    const chalk = smoothstep(0.35, 0.85, grain(u * 3 + 11, v * 3 + 4))
    const rub = smoothstep(0.22, 0.5, 1 - Math.abs(v - 0.5) * 2) * scuff(u * 16, v * 6)
    // Night dew beads on the upper resin: local patches of gloss, not a uniform sheen.
    const wet = smoothstep(0.62, 0.9, dew(u * 6, v * 6))
    let r = lerp(0.55, 0.82, chalk)
    r -= rub * 0.22
    r = lerp(r, 0.24, wet * 0.8)
    return [r, r, r]
  })

  return {
    map: toTexture(mc, true),
    rough: toTexture(rc, false),
    normal: heightToNormal(hc, 1.4),
  }
}

function buildGalvanised(): { map: THREE.Texture; rough: THREE.Texture } {
  const S = 256
  const spangle = fbm(911, 10, 2)
  const fine = fbm(2131, 32, 2)
  const stain = fbm(7717, 5, 3)
  const { c: mc, x: mx } = makeCanvas(S)
  writePixels(mx, S, (u, v) => {
    const s = spangle(u * 10, v * 10)
    const crystal = smoothstep(0.42, 0.58, s)
    const dull = stain(u * 5, v * 5)
    let g = lerp(0.3, 0.42, crystal) + (fine(u * 32, v * 32) - 0.5) * 0.05
    // White rust: slightly warmer, chalkier patches where water sits.
    const rust = smoothstep(0.68, 0.92, dull)
    const r = lerp(g, 0.4, rust)
    const gg = lerp(g, 0.395, rust)
    const b = lerp(g * 1.02, 0.375, rust)
    return [r, gg, b]
  })
  const { c: rc, x: rx } = makeCanvas(S)
  writePixels(rx, S, (u, v) => {
    const crystal = smoothstep(0.42, 0.58, spangle(u * 10, v * 10))
    const rust = smoothstep(0.68, 0.92, stain(u * 5, v * 5))
    const r = lerp(0.46, 0.34, crystal) + rust * 0.32 + (fine(u * 32, v * 32) - 0.5) * 0.06
    return [r, r, r]
  })
  return { map: toTexture(mc, true), rough: toTexture(rc, false) }
}

function buildPaintedSteel(): { map: THREE.Texture; rough: THREE.Texture } {
  const S = 256
  const chip = fbm(4441, 14, 3)
  const dirt = fbm(6151, 6, 3)
  const orangePeel = fbm(8231, 48, 1)
  const { c: mc, x: mx } = makeCanvas(S)
  writePixels(mx, S, (u, v) => {
    // Park green enamel over primer; chips reveal grey primer, not bare colour.
    const base: [number, number, number] = [0.115, 0.168, 0.148]
    const c = smoothstep(0.78, 0.93, chip(u * 14, v * 14))
    const d = smoothstep(0.4, 0.95, dirt(u * 6, v * 6)) * 0.16
    const p = (orangePeel(u * 48, v * 48) - 0.5) * 0.02
    const r = lerp(base[0], 0.29, c) + p - d * 0.4
    const g = lerp(base[1], 0.285, c) + p - d * 0.35
    const b = lerp(base[2], 0.278, c) + p - d * 0.3
    return [r, g, b]
  })
  const { c: rc, x: rx } = makeCanvas(S)
  writePixels(rx, S, (u, v) => {
    const c = smoothstep(0.78, 0.93, chip(u * 14, v * 14))
    const d = smoothstep(0.4, 0.95, dirt(u * 6, v * 6))
    const r = lerp(0.42, 0.86, c) + d * 0.14 + (orangePeel(u * 48, v * 48) - 0.5) * 0.08
    return [r, r, r]
  })
  return { map: toTexture(mc, true), rough: toTexture(rc, false) }
}

function buildGround(): {
  map: THREE.Texture
  rough: THREE.Texture
  normal: THREE.Texture
} {
  const S = 512
  const coarse = fbm(1777, 6, 4)
  const grit = fbm(2999, 40, 3)
  const damp = fbm(4523, 4, 3)
  const litter = fbm(6337, 26, 2)

  const { c: mc, x: mx } = makeCanvas(S)
  writePixels(mx, S, (u, v) => {
    const c = coarse(u * 6, v * 6)
    const g = grit(u * 40, v * 40)
    const w = smoothstep(0.5, 0.78, damp(u * 4, v * 4))
    // Compacted decomposed-granite park surface.
    let r = 0.128 + c * 0.055 + (g - 0.5) * 0.035
    let gg = 0.114 + c * 0.05 + (g - 0.5) * 0.033
    let b = 0.098 + c * 0.04 + (g - 0.5) * 0.03
    // Damp ground reads darker and a touch cooler.
    r = lerp(r, r * 0.55, w)
    gg = lerp(gg, gg * 0.57, w)
    b = lerp(b, b * 0.66, w)
    // Dry leaf litter drifted into low spots.
    const leaf = smoothstep(0.72, 0.88, litter(u * 26, v * 26)) * (1 - w * 0.7)
    r = lerp(r, 0.2, leaf)
    gg = lerp(gg, 0.135, leaf)
    b = lerp(b, 0.072, leaf)
    return [r, gg, b]
  })

  const { c: rc, x: rx } = makeCanvas(S)
  writePixels(rx, S, (u, v) => {
    const w = smoothstep(0.5, 0.78, damp(u * 4, v * 4))
    const g = grit(u * 40, v * 40)
    const r = lerp(0.94, 0.3, w) + (g - 0.5) * 0.1
    return [r, r, r]
  })

  const { c: hc, x: hx } = makeCanvas(S)
  writePixels(hx, S, (u, v) => {
    const h = coarse(u * 6, v * 6) * 0.55 + grit(u * 40, v * 40) * 0.45
    return [h, h, h]
  })

  return {
    map: toTexture(mc, true, 5),
    rough: toTexture(rc, false, 5),
    normal: heightToNormal(hc, 1.1),
  }
}

function buildConcrete(): { map: THREE.Texture; rough: THREE.Texture } {
  const S = 256
  const blotch = fbm(1319, 5, 4)
  const pores = fbm(3733, 44, 2)
  const { c: mc, x: mx } = makeCanvas(S)
  writePixels(mx, S, (u, v) => {
    const b = blotch(u * 5, v * 5)
    const p = smoothstep(0.72, 0.9, pores(u * 44, v * 44))
    const base = 0.155 + b * 0.05 - p * 0.06
    return [base, base * 0.99, base * 0.95]
  })
  const { c: rc, x: rx } = makeCanvas(S)
  writePixels(rx, S, (u, v) => {
    const p = smoothstep(0.72, 0.9, pores(u * 44, v * 44))
    const r = 0.88 - blotch(u * 5, v * 5) * 0.1 + p * 0.08
    return [r, r, r]
  })
  return { map: toTexture(mc, true, 2), rough: toTexture(rc, false, 2) }
}

/** Diffuser dirt: multiplies emission so lamps never read as clean flat white. */
function buildDiffuser(): THREE.Texture {
  const S = 128
  const grime = fbm(7013, 7, 3)
  const streak = fbm(9109, 3, 2)
  const { c, x } = makeCanvas(S)
  writePixels(x, S, (u, v) => {
    const g = grime(u * 7, v * 7)
    // Dirt runs down the diffuser face and collects along the bottom edge.
    const run = smoothstep(0.35, 0.9, streak(u * 3, v * 0.6)) * smoothstep(0.15, 0.95, v)
    const settle = smoothstep(0.72, 1.0, v) * 0.35
    const dust = 1 - (g * 0.2 + run * 0.22 + settle)
    return [dust, dust * 0.995, dust * 0.97]
  })
  return toTexture(c, true)
}

function buildBark(): { map: THREE.Texture; rough: THREE.Texture } {
  const S = 256
  const ridge = fbm(2087, 6, 4)
  const fine = fbm(4409, 30, 2)
  const { c: mc, x: mx } = makeCanvas(S)
  writePixels(mx, S, (u, v) => {
    // Vertical fissures: stretch the noise along the trunk axis.
    const r0 = ridge(u * 12, v * 2.5)
    const f = fine(u * 30, v * 8)
    const fissure = smoothstep(0.3, 0.62, r0)
    const base = 0.07 + f * 0.03
    const r = lerp(base * 0.6, base + 0.055, fissure)
    return [r, r * 0.94, r * 0.84]
  })
  const { c: rc, x: rx } = makeCanvas(S)
  writePixels(rx, S, (u, v) => {
    const r = 0.9 - ridge(u * 12, v * 2.5) * 0.12 + fine(u * 30, v * 8) * 0.08
    return [r, r, r]
  })
  return { map: toTexture(mc, true), rough: toTexture(rc, false) }
}

function buildWood(): THREE.Texture {
  const S = 256
  const wobble = fbm(5231, 5, 3)
  const pore = fbm(6421, 36, 2)
  const { c, x } = makeCanvas(S)
  writePixels(x, S, (u, v) => {
    const rings = Math.abs(Math.sin((v * 9 + wobble(u * 5, v * 5) * 1.7) * Math.PI))
    const g = smoothstep(0.2, 0.9, rings)
    const p = pore(u * 36, v * 12) * 0.05
    const r = lerp(0.113, 0.163, g) + p
    return [r, r * 0.78, r * 0.56]
  })
  return toTexture(c, true, 1)
}

/** Soft elliptical pool used to fake the ground throw of each fixture. */
function buildLightPool(): THREE.Texture {
  const S = 256
  const break0 = fbm(8641, 7, 3)
  const { c, x } = makeCanvas(S)
  const img = x.createImageData(S, S)
  const d = img.data
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const u = i / S - 0.5
      const v = j / S - 0.5
      const r = Math.hypot(u, v) * 2
      // Inverse-square-ish falloff, clipped at the edge so the quad has no seam.
      let a = 1 / (1 + 14 * r * r) - 0.07
      a *= smoothstep(1.0, 0.62, r)
      // Break the perfect circle with slow noise: real pools are uneven.
      a *= 0.72 + 0.28 * break0(i / S * 7, j / S * 7)
      const k = (j * S + i) * 4
      const c8 = clamp01(a) * 255
      d[k] = c8
      d[k + 1] = c8
      d[k + 2] = c8
      d[k + 3] = 255
    }
  }
  x.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.NoColorSpace
  t.wrapS = THREE.ClampToEdgeWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  t.needsUpdate = true
  return t
}

/** Baked contact shadow, multiplied under objects instead of a real shadow map. */
function buildContact(): THREE.Texture {
  const S = 128
  const { c, x } = makeCanvas(S)
  const img = x.createImageData(S, S)
  const d = img.data
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const u = i / S - 0.5
      const v = j / S - 0.5
      const r = Math.hypot(u, v) * 2
      const a = Math.pow(1 - clamp01(r), 1.7)
      const k = (j * S + i) * 4
      d[k] = 0
      d[k + 1] = 0
      d[k + 2] = 0
      d[k + 3] = a * 255
    }
  }
  x.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.NoColorSpace
  t.needsUpdate = true
  return t
}

function buildLeaf(): THREE.Texture {
  const S = 64
  const { c, x } = makeCanvas(S)
  x.clearRect(0, 0, S, S)
  x.fillStyle = '#3a2a16'
  x.beginPath()
  x.moveTo(S * 0.5, S * 0.08)
  x.bezierCurveTo(S * 0.92, S * 0.3, S * 0.86, S * 0.78, S * 0.5, S * 0.95)
  x.bezierCurveTo(S * 0.14, S * 0.78, S * 0.08, S * 0.3, S * 0.5, S * 0.08)
  x.fill()
  x.strokeStyle = 'rgba(90,70,40,0.7)'
  x.lineWidth = 1.4
  x.beginPath()
  x.moveTo(S * 0.5, S * 0.12)
  x.lineTo(S * 0.5, S * 0.9)
  x.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

/** Tiny soft sprite for the visible bulb core inside a diffuser. */
function buildGlow(): THREE.Texture {
  const S = 64
  const { c, x } = makeCanvas(S)
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.42)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g
  x.fillRect(0, 0, S, S)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.NoColorSpace
  t.needsUpdate = true
  return t
}

/** Distant housing block: a strip of lit and dark windows for the park boundary. */
function buildWindows(): THREE.Texture {
  const S = 256
  const { c, x } = makeCanvas(S, S)
  x.fillStyle = '#000000'
  x.fillRect(0, 0, S, S)
  const rng = new Rng(4242)
  const cols = 16
  const rows = 16
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (rng.next() > 0.32) continue
      const warm = rng.next()
      const r = Math.round(lerp(190, 255, warm))
      const g = Math.round(lerp(150, 205, warm))
      const b = Math.round(lerp(96, 150, warm))
      x.fillStyle = `rgb(${r},${g},${b})`
      const w = S / cols
      const h = S / rows
      x.fillRect(i * w + w * 0.28, j * h + h * 0.3, w * 0.42, h * 0.36)
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  t.needsUpdate = true
  return t
}

let cached: TextureSet | null = null

export function buildTextures(): TextureSet {
  if (cached) return cached
  const roller = buildRoller()
  const galv = buildGalvanised()
  const paint = buildPaintedSteel()
  const ground = buildGround()
  const concrete = buildConcrete()
  const bark = buildBark()
  cached = {
    rollerMap: roller.map,
    rollerRough: roller.rough,
    rollerNormal: roller.normal,
    galvMap: galv.map,
    galvRough: galv.rough,
    paintMap: paint.map,
    paintRough: paint.rough,
    groundMap: ground.map,
    groundRough: ground.rough,
    groundNormal: ground.normal,
    concreteMap: concrete.map,
    concreteRough: concrete.rough,
    diffuserMap: buildDiffuser(),
    barkMap: bark.map,
    barkRough: bark.rough,
    woodMap: buildWood(),
    lightPool: buildLightPool(),
    contact: buildContact(),
    leaf: buildLeaf(),
    glow: buildGlow(),
    windows: buildWindows(),
  }
  return cached
}
