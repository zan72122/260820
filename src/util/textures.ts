import { CanvasTexture, RepeatWrapping, SRGBColorSpace, Texture } from 'three'
import { Rng } from './math'

function makeCanvas(w: number, h = w): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  return { c, g }
}

function finish(c: HTMLCanvasElement, srgb: boolean, repeat = 1): CanvasTexture {
  const t = new CanvasTexture(c)
  if (srgb) t.colorSpace = SRGBColorSpace
  if (repeat !== 1) {
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(repeat, repeat)
  }
  t.anisotropy = 4
  t.needsUpdate = true
  return t
}

/** Value-noise field sampled on a grid, tiled seamlessly. */
function valueNoise(size: number, cells: number, rng: Rng): Float32Array {
  const grid = new Float32Array(cells * cells)
  for (let i = 0; i < grid.length; i++) grid[i] = rng.next()
  const out = new Float32Array(size * size)
  const scale = cells / size
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x * scale
      const fy = y * scale
      const x0 = Math.floor(fx)
      const y0 = Math.floor(fy)
      const tx = fx - x0
      const ty = fy - y0
      const sx = tx * tx * (3 - 2 * tx)
      const sy = ty * ty * (3 - 2 * ty)
      const i00 = (y0 % cells) * cells + (x0 % cells)
      const i10 = (y0 % cells) * cells + ((x0 + 1) % cells)
      const i01 = ((y0 + 1) % cells) * cells + (x0 % cells)
      const i11 = ((y0 + 1) % cells) * cells + ((x0 + 1) % cells)
      const a = grid[i00] + (grid[i10] - grid[i00]) * sx
      const b = grid[i01] + (grid[i11] - grid[i01]) * sx
      out[y * size + x] = a + (b - a) * sy
    }
  }
  return out
}

function fbm(size: number, octaves: number, seed: number): Float32Array {
  const out = new Float32Array(size * size)
  let amp = 1
  let total = 0
  let cells = 3
  for (let o = 0; o < octaves; o++) {
    const layer = valueNoise(size, cells, new Rng(seed + o * 7919))
    for (let i = 0; i < out.length; i++) out[i] += layer[i] * amp
    total += amp
    amp *= 0.5
    cells = Math.min(size, cells * 2)
  }
  for (let i = 0; i < out.length; i++) out[i] /= total
  return out
}

/** Dusk park ground: worn grass, a gravel path band, scattered dirt. */
export function makeGroundTexture(size = 512): CanvasTexture {
  const { c, g } = makeCanvas(size)
  const n = fbm(size, 5, 1337)
  const n2 = fbm(size, 4, 4211)
  const img = g.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const v = n[i]
      const w = n2[i]
      // grass base, browner where the fbm dips (worn patches)
      const grass = [0.20 + v * 0.13, 0.24 + v * 0.16, 0.13 + v * 0.09]
      const dirt = [0.30 + w * 0.12, 0.24 + w * 0.10, 0.17 + w * 0.07]
      const mix = Math.min(1, Math.max(0, (w - 0.42) * 3.2))
      const o = i * 4
      img.data[o] = (grass[0] * (1 - mix) + dirt[0] * mix) * 255
      img.data[o + 1] = (grass[1] * (1 - mix) + dirt[1] * mix) * 255
      img.data[o + 2] = (grass[2] * (1 - mix) + dirt[2] * mix) * 255
      img.data[o + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  return finish(c, true, 1)
}

/** Swept, compacted earth under the swing — no symmetry, no uniform wetness. */
export function makeSwingApronTexture(size = 256): CanvasTexture {
  const { c, g } = makeCanvas(size)
  const n = fbm(size, 5, 99)
  const img = g.createImageData(size, size)
  const cx = size * 0.5
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const v = n[i]
      // the wear ellipse is deliberately off-centre
      const dx = (x - cx * 0.94) / (size * 0.42)
      const dy = (y - cx * 1.06) / (size * 0.3)
      const d = Math.sqrt(dx * dx + dy * dy)
      const wear = Math.max(0, 1 - d) * (0.65 + v * 0.5)
      const base = [0.22 + v * 0.12, 0.25 + v * 0.13, 0.15 + v * 0.09]
      const bare = [0.34 + v * 0.10, 0.27 + v * 0.08, 0.20 + v * 0.06]
      const k = Math.min(1, wear * 1.3)
      const o = i * 4
      img.data[o] = (base[0] * (1 - k) + bare[0] * k) * 255
      img.data[o + 1] = (base[1] * (1 - k) + bare[1] * k) * 255
      img.data[o + 2] = (base[2] * (1 - k) + bare[2] * k) * 255
      img.data[o + 3] = Math.min(255, k * 300)
    }
  }
  g.putImageData(img, 0, 0)
  return finish(c, true)
}

/**
 * Brass wear map. The clock is not one uniform gold plastic: the sheltered
 * inner train stays bright, the rain-facing outer frame oxidises, dust settles
 * on upward faces, and the inside of the glass carries a faint film.
 */
export function makeBrassMaps(size = 256): { rough: Texture; ao: Texture; tint: CanvasTexture } {
  const patina = fbm(size, 5, 5150)
  const dust = fbm(size, 4, 8123)

  const { c: rc, g: rg } = makeCanvas(size)
  const rimg = rg.createImageData(size, size)
  for (let i = 0; i < size * size; i++) {
    const p = patina[i]
    const d = dust[i]
    // upward-facing dust bands make roughness climb towards the top of the map
    const v = Math.min(1, 0.24 + p * 0.42 + d * 0.3 + (i / (size * size)) * 0.12)
    const o = i * 4
    rimg.data[o] = rimg.data[o + 1] = rimg.data[o + 2] = v * 255
    rimg.data[o + 3] = 255
  }
  rg.putImageData(rimg, 0, 0)

  const { c: ac, g: ag } = makeCanvas(size)
  const aimg = ag.createImageData(size, size)
  for (let i = 0; i < size * size; i++) {
    const v = Math.min(1, 0.55 + patina[i] * 0.45)
    const o = i * 4
    aimg.data[o] = aimg.data[o + 1] = aimg.data[o + 2] = v * 255
    aimg.data[o + 3] = 255
  }
  ag.putImageData(aimg, 0, 0)

  const { c: tc, g: tg } = makeCanvas(size)
  const timg = tg.createImageData(size, size)
  for (let i = 0; i < size * size; i++) {
    const p = patina[i]
    const d = dust[i]
    // warm brass -> green-grey oxide -> pale dust
    const r = 0.72 - p * 0.28 + d * 0.06
    const gg = 0.58 - p * 0.10 + d * 0.09
    const b = 0.32 + p * 0.16 + d * 0.12
    const o = i * 4
    timg.data[o] = r * 255
    timg.data[o + 1] = gg * 255
    timg.data[o + 2] = b * 255
    timg.data[o + 3] = 255
  }
  tg.putImageData(timg, 0, 0)

  return {
    rough: finish(rc, false, 2),
    ao: finish(ac, false, 2),
    tint: finish(tc, true, 2),
  }
}

/** Soft radial falloff, used for lamp haloes and the pool of light on the ground. */
export function makeGlowTexture(size = 128, power = 2.4): CanvasTexture {
  const { c, g } = makeCanvas(size)
  const img = g.createImageData(size, size)
  const r = size * 0.5
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - r) / r
      const dy = (y + 0.5 - r) / r
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy))
      const v = Math.pow(1 - d, power)
      const o = (y * size + x) * 4
      img.data[o] = img.data[o + 1] = img.data[o + 2] = 255
      img.data[o + 3] = v * 255
    }
  }
  g.putImageData(img, 0, 0)
  return finish(c, false)
}

/**
 * Vertical falloff for a lamp's beam in the evening air: dense at the shade,
 * gone by the time it reaches the ground.
 */
export function makeBeamTexture(w = 32, h = 128): CanvasTexture {
  const { c, g } = makeCanvas(w, h)
  const img = g.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    // uv.y = 1 at the cone's apex, which is row 0 of the canvas
    const t = 1 - y / (h - 1)
    // Brightest just under the shade, not at the shade itself — a hard white apex
    // reads as a bug, and a real beam is diffuse where the glass ends.
    const a = Math.pow(t, 2.6) * 0.82 * (1 - Math.pow(Math.max(0, t - 0.86) / 0.14, 1.6) * 0.62)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      img.data[o] = img.data[o + 1] = img.data[o + 2] = 255
      img.data[o + 3] = a * 255
    }
  }
  g.putImageData(img, 0, 0)
  return finish(c, false)
}

/** A single soft dot for the star field. */
export function makeStarSprite(size = 32): CanvasTexture {
  const { c, g } = makeCanvas(size)
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.22, 'rgba(255,255,255,0.75)')
  grd.addColorStop(0.55, 'rgba(255,255,255,0.14)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, size, size)
  return finish(c, false)
}

/** Torn, wispy cloud alpha with an irregular edge — the moon hides behind one of these. */
export function makeCloudTexture(size = 256, seed = 21): CanvasTexture {
  const { c, g } = makeCanvas(size, size / 2)
  const h = size / 2
  const n = fbm(size, 5, seed)
  const n2 = fbm(size, 4, seed + 777)
  const img = g.createImageData(size, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const dx = (x / size - 0.5) * 2
      const dy = (y / h - 0.5) * 2
      const body = Math.max(0, 1 - Math.sqrt(dx * dx * 0.75 + dy * dy * 1.9))
      const v = n[i] * 0.7 + n2[i] * 0.5
      let a = body * 1.5 * (v - 0.28)
      a = Math.max(0, Math.min(1, a * 2.1))
      const o = (y * size + x) * 4
      img.data[o] = img.data[o + 1] = img.data[o + 2] = 255
      img.data[o + 3] = a * 255
    }
  }
  g.putImageData(img, 0, 0)
  return finish(c, false)
}

/** Moon albedo: maria, a few craters, subtle limb darkening baked in. */
export function makeMoonTexture(size = 256): CanvasTexture {
  const { c, g } = makeCanvas(size, size / 2)
  const h = size / 2
  const base = fbm(size, 5, 4242)
  const fine = fbm(size, 6, 8484)
  const img = g.createImageData(size, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const b = base[i]
      const f = fine[i]
      // maria = the darker low-lying plains
      const maria = Math.max(0, Math.min(1, (0.52 - b) * 4))
      let v = 0.86 - maria * 0.22 + (f - 0.5) * 0.09
      v = Math.max(0.4, Math.min(1, v))
      const o = (y * size + x) * 4
      img.data[o] = v * 246
      img.data[o + 1] = v * 243
      img.data[o + 2] = v * 231
      img.data[o + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  // a handful of craters, deterministic
  const rng = new Rng(9001)
  for (let k = 0; k < 26; k++) {
    const x = rng.range(0, size)
    const y = rng.range(h * 0.12, h * 0.88)
    const r = rng.range(1.5, 8)
    const grd = g.createRadialGradient(x, y, 0, x, y, r)
    grd.addColorStop(0, 'rgba(255,255,250,0.16)')
    grd.addColorStop(0.62, 'rgba(120,116,108,0.22)')
    grd.addColorStop(1, 'rgba(255,255,250,0)')
    g.fillStyle = grd
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
  }
  return finish(c, true)
}

/** Bark: vertical fibre, not a flat brown tube. */
export function makeBarkTexture(size = 128): CanvasTexture {
  const { c, g } = makeCanvas(size)
  const n = fbm(size, 5, 3131)
  const img = g.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const streak = Math.sin(x * 0.55 + n[i] * 7) * 0.5 + 0.5
      const v = 0.30 + n[i] * 0.24 + streak * 0.12
      const o = i * 4
      img.data[o] = v * 150
      img.data[o + 1] = v * 122
      img.data[o + 2] = v * 96
      img.data[o + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  return finish(c, true, 1)
}

/** Concrete/asphalt for the clock foundation and the park apron. */
export function makeConcreteTexture(size = 256): CanvasTexture {
  const { c, g } = makeCanvas(size)
  const n = fbm(size, 6, 606)
  const img = g.createImageData(size, size)
  for (let i = 0; i < size * size; i++) {
    const v = 0.44 + n[i] * 0.2
    const o = i * 4
    img.data[o] = v * 198
    img.data[o + 1] = v * 194
    img.data[o + 2] = v * 186
    img.data[o + 3] = 255
  }
  g.putImageData(img, 0, 0)
  return finish(c, true, 2)
}
