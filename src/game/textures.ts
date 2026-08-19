import * as THREE from 'three'

/* ------------------------------------------------------------------ *
 * Procedural canvas textures.  Everything the game draws is generated
 * at boot: no binary assets, no network fetches, works offline.
 * ------------------------------------------------------------------ */

const hash2 = (x: number, y: number, s: number): number => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/** tiling value noise; `period` must be an integer for seamless wrap */
function vnoise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const w = (a: number, b: number) => hash2(((a % period) + period) % period, ((b % period) + period) % period, seed)
  const a = w(xi, yi)
  const b = w(xi + 1, yi)
  const c = w(xi, yi + 1)
  const d = w(xi + 1, yi + 1)
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
}

function fbm(x: number, y: number, octaves: number, period: number, seed: number): number {
  let amp = 0.5
  let sum = 0
  let norm = 0
  let f = 1
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(x * f, y * f, period * f, seed + i * 37)
    norm += amp
    amp *= 0.5
    f *= 2
  }
  return sum / norm
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  return [c, ctx]
}

function finish(c: HTMLCanvasElement, srgb: boolean, repeat = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.anisotropy = 4
  t.needsUpdate = true
  return t
}

export interface SoilSet {
  dry: THREE.CanvasTexture
  wet: THREE.CanvasTexture
  rough: THREE.CanvasTexture
  normalish: THREE.CanvasTexture
}

/**
 * Paddy soil.  `dry` is the sun-baked cracked earth of a drained rice
 * paddy, `wet` is the darker churned mud the crawler leaves behind.
 */
export function makeSoil(size = 256): SoilSet {
  const [cd, dctx] = canvas(size)
  const [cw, wctx] = canvas(size)
  const [cr, rctx] = canvas(size)

  const dImg = dctx.createImageData(size, size)
  const wImg = wctx.createImageData(size, size)
  const rImg = rctx.createImageData(size, size)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * 8
      const v = (y / size) * 8
      const n = fbm(u, v, 4, 8, 11)
      const grit = fbm(u * 6, v * 6, 2, 48, 91)
      const i = (y * size + x) * 4

      // dry: warm ochre brown, pale where the sun baked the crust
      const d = 0.72 + n * 0.5 + grit * 0.16
      dImg.data[i] = Math.min(255, 118 * d + 16)
      dImg.data[i + 1] = Math.min(255, 94 * d + 12)
      dImg.data[i + 2] = Math.min(255, 64 * d + 8)
      dImg.data[i + 3] = 255

      // wet: darker, cooler, higher contrast churned mud
      const m = 0.55 + n * 0.7 + grit * 0.1
      wImg.data[i] = Math.min(255, 74 * m + 12)
      wImg.data[i + 1] = Math.min(255, 58 * m + 10)
      wImg.data[i + 2] = Math.min(255, 44 * m + 9)
      wImg.data[i + 3] = 255

      // roughness map: rough crust, smoother in the noise troughs (damp)
      const r = 165 + n * 80 + grit * 26
      rImg.data[i] = rImg.data[i + 1] = rImg.data[i + 2] = Math.max(0, Math.min(255, r))
      rImg.data[i + 3] = 255
    }
  }
  dctx.putImageData(dImg, 0, 0)
  wctx.putImageData(wImg, 0, 0)
  rctx.putImageData(rImg, 0, 0)

  // clods + cracks give the eye something with real scale
  const clods = (ctx: CanvasRenderingContext2D, light: string, dark: string, count: number) => {
    for (let i = 0; i < count; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      const r = 1.5 + Math.random() * 4.5
      ctx.globalAlpha = 0.16 + Math.random() * 0.2
      ctx.fillStyle = dark
      ctx.beginPath()
      ctx.ellipse(x, y + r * 0.35, r, r * 0.7, Math.random() * 3.14, 0, 6.283)
      ctx.fill()
      ctx.fillStyle = light
      ctx.beginPath()
      ctx.ellipse(x, y - r * 0.2, r * 0.8, r * 0.5, Math.random() * 3.14, 0, 6.283)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
  clods(dctx, '#b79a6c', '#4e3a24', 340)
  clods(wctx, '#6d5a44', '#241a11', 300)

  // hairline shrink cracks on the dry crust
  dctx.strokeStyle = 'rgba(45,32,20,0.5)'
  dctx.lineWidth = 1
  for (let i = 0; i < 26; i++) {
    let x = Math.random() * size
    let y = Math.random() * size
    let a = Math.random() * 6.283
    dctx.beginPath()
    dctx.moveTo(x, y)
    for (let s = 0; s < 9; s++) {
      a += (Math.random() - 0.5) * 1.1
      x += Math.cos(a) * 7
      y += Math.sin(a) * 7
      dctx.lineTo(x, y)
    }
    dctx.stroke()
  }

  // wet mud gets a few standing-water sheens
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 3 + Math.random() * 9
    const g = wctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(96,104,96,0.42)')
    g.addColorStop(1, 'rgba(96,104,96,0)')
    wctx.fillStyle = g
    wctx.beginPath()
    wctx.arc(x, y, r, 0, 6.283)
    wctx.fill()
  }

  return {
    dry: finish(cd, true, 1),
    wet: finish(cw, true, 1),
    rough: finish(cr, false, 1),
    normalish: finish(cr, false, 1),
  }
}

/** Loose rice grain: thousands of little hulled ellipses. Used for the pile + tank. */
export function makeGrain(size = 256): { color: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const [cc, ctx] = canvas(size)
  const [cb, bctx] = canvas(size)
  ctx.fillStyle = '#b58f45'
  ctx.fillRect(0, 0, size, size)
  bctx.fillStyle = '#606060'
  bctx.fillRect(0, 0, size, size)

  const drawGrain = (
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    a: number,
    rx: number,
    fill: string,
  ) => {
    c.save()
    c.translate(x, y)
    c.rotate(a)
    c.fillStyle = fill
    c.beginPath()
    c.ellipse(0, 0, rx, rx * 0.42, 0, 0, 6.283)
    c.fill()
    c.restore()
  }

  // shadow pass, then body, then highlight — gives the pile a grainy relief
  for (let i = 0; i < 1500; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const a = Math.random() * 6.283
    const rx = 2.6 + Math.random() * 1.5
    drawGrain(ctx, x + 0.7, y + 0.9, a, rx * 1.05, 'rgba(90,64,26,0.55)')
    const l = 0.78 + Math.random() * 0.22
    drawGrain(
      ctx,
      x,
      y,
      a,
      rx,
      `rgb(${Math.round(232 * l)},${Math.round(203 * l)},${Math.round(138 * l)})`,
    )
    drawGrain(ctx, x - rx * 0.22, y - rx * 0.12, a, rx * 0.45, 'rgba(255,248,214,0.75)')

    drawGrain(bctx, x + 0.8, y + 1, a, rx * 1.05, 'rgba(0,0,0,0.5)')
    drawGrain(bctx, x, y, a, rx, 'rgba(220,220,220,0.85)')
  }
  return { color: finish(cc, true, 1), bump: finish(cb, false, 1) }
}

/** Painted sheet-metal: fine orange-peel, a few scuffs, dust settled low. */
export function makePaintRoughness(size = 256): THREE.CanvasTexture {
  const [c, ctx] = canvas(size)
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm((x / size) * 16, (y / size) * 16, 3, 16, 5)
      const i = (y * size + x) * 4
      const v = 74 + n * 70
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  ctx.strokeStyle = 'rgba(200,200,200,0.5)'
  for (let i = 0; i < 40; i++) {
    ctx.lineWidth = Math.random() * 1.4 + 0.3
    const x = Math.random() * size
    const y = Math.random() * size
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 14)
    ctx.stroke()
  }
  return finish(c, false, 1)
}

/** Soft round alpha blob: dust puffs, chaff clouds, distant clouds. */
export function makePuff(size = 128, hardness = 0.25): THREE.CanvasTexture {
  const [c, ctx] = canvas(size)
  const g = ctx.createRadialGradient(size / 2, size / 2, size * hardness * 0.5, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const t = finish(c, true, 1)
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  return t
}

/** Lumpy cumulus silhouette for the far sky. */
export function makeCloud(size = 256): THREE.CanvasTexture {
  const [c, ctx] = canvas(size)
  ctx.clearRect(0, 0, size, size)
  const blobs = 16
  for (let i = 0; i < blobs; i++) {
    const t = i / (blobs - 1)
    const x = size * (0.14 + t * 0.72) + (Math.random() - 0.5) * size * 0.08
    const bell = Math.sin(t * Math.PI)
    const y = size * (0.62 - bell * 0.16) + (Math.random() - 0.5) * size * 0.05
    const r = size * (0.07 + bell * 0.15) * (0.75 + Math.random() * 0.5)
    const g = ctx.createRadialGradient(x, y - r * 0.25, r * 0.1, x, y, r)
    g.addColorStop(0, 'rgba(255,255,255,0.98)')
    g.addColorStop(0.6, 'rgba(248,246,240,0.75)')
    g.addColorStop(1, 'rgba(236,234,230,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 6.283)
    ctx.fill()
  }
  const t = finish(c, true, 1)
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  return t
}

/** Rubber crawler belt: moulded lugs + fabric weave, used as a roughness/bump hint. */
export function makeRubber(size = 128): THREE.CanvasTexture {
  const [c, ctx] = canvas(size)
  ctx.fillStyle = '#3a3a3a'
  ctx.fillRect(0, 0, size, size)
  const img = ctx.getImageData(0, 0, size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm((x / size) * 24, (y / size) * 24, 2, 24, 3)
      const i = (y * size + x) * 4
      const v = 150 + n * 70
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return finish(c, false, 1)
}

export function disposeTexture(t: THREE.Texture | null | undefined) {
  if (t) t.dispose()
}
