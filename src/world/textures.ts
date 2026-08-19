import * as THREE from 'three'
import { fbm2, mulberry32, clamp } from '../core/rng'

/**
 * Every surface in the scene is textured procedurally at boot: no binary assets,
 * small footprint on mobile, and fully deterministic for tests.
 */

type Painter = (ctx: CanvasRenderingContext2D, size: number) => void

const cache = new Map<string, THREE.Texture>()

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d', { willReadFrequently: false })!
  return [c, ctx]
}

function texture(
  key: string,
  size: number,
  paint: Painter,
  opts: { srgb?: boolean; repeat?: number } = {},
): THREE.Texture {
  const hit = cache.get(key)
  if (hit) return hit
  const [canvas, ctx] = makeCanvas(size)
  paint(ctx, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.generateMipmaps = true
  tex.anisotropy = 4
  if (opts.srgb) tex.colorSpace = THREE.SRGBColorSpace
  if (opts.repeat) tex.repeat.set(opts.repeat, opts.repeat)
  tex.needsUpdate = true
  cache.set(key, tex)
  return tex
}

function fill(ctx: CanvasRenderingContext2D, size: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(0, 0, size, size)
}

/** Soft round blob, used for pores, speckles and scuffs. */
function blob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  softness = 0.55,
) {
  const g = ctx.createRadialGradient(x, y, r * softness * 0.2, x, y, r)
  g.addColorStop(0, color)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

/** Repeat a paint op with wrap-around so the tile is seamless. */
function wrapped(
  size: number,
  x: number,
  y: number,
  r: number,
  draw: (x: number, y: number) => void,
) {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const px = x + dx * size
      const py = y + dy * size
      if (px + r < 0 || px - r > size || py + r < 0 || py - r > size) continue
      draw(px, py)
    }
  }
}

/* ------------------------------------------------------------------ */
/* Sponge                                                              */
/* ------------------------------------------------------------------ */

/** Cut face: pale vanilla crumb full of fine air bubbles. */
export const spongeCrumbMap = () =>
  texture(
    'crumb',
    256,
    (ctx, s) => {
      const rng = mulberry32(4711)
      fill(ctx, s, '#efd196')
      // broad tonal drift so the crumb never reads as flat colour
      for (let y = 0; y < s; y += 2) {
        for (let x = 0; x < s; x += 2) {
          const n = fbm2(x / 34, y / 34, 3, 9)
          const v = clamp(0.5 + n * 0.35, 0, 1)
          ctx.fillStyle = `rgba(${Math.round(120 + v * 40)},${Math.round(
            92 + v * 34,
          )},${Math.round(48 + v * 22)},0.10)`
          ctx.fillRect(x, y, 2, 2)
        }
      }
      // air bubbles: a few big, many tiny
      for (let i = 0; i < 900; i++) {
        const r = 0.7 + Math.pow(rng(), 3) * 5.2
        const x = rng() * s
        const y = rng() * s
        const a = 0.1 + rng() * 0.3
        wrapped(s, x, y, r + 2, (px, py) => {
          blob(ctx, px, py, r, `rgba(150,116,64,${a})`)
          // bright lower lip: bubbles catch the key light
          blob(ctx, px, py - r * 0.34, r * 0.62, `rgba(255,247,224,${a * 0.85})`)
        })
      }
      for (let i = 0; i < 260; i++) {
        const x = rng() * s
        const y = rng() * s
        blob(ctx, x, y, 1 + rng() * 2.2, 'rgba(255,252,238,0.5)')
      }
    },
    { srgb: true },
  )

/** Height detail for the crumb so pores read under the key light. */
export const spongeCrumbBump = () =>
  texture('crumbBump', 256, (ctx, s) => {
    const rng = mulberry32(4711)
    fill(ctx, s, '#8c8c8c')
    for (let i = 0; i < 900; i++) {
      const r = 0.7 + Math.pow(rng(), 3) * 5.2
      const x = rng() * s
      const y = rng() * s
      wrapped(s, x, y, r + 2, (px, py) => {
        blob(ctx, px, py, r, 'rgba(0,0,0,0.55)')
        blob(ctx, px, py - r * 0.34, r * 0.6, 'rgba(255,255,255,0.4)')
      })
    }
  })

/** Baked outside: darker, glossier, faintly domed. */
export const spongeCrustMap = () =>
  texture(
    'crust',
    256,
    (ctx, s) => {
      const rng = mulberry32(1201)
      fill(ctx, s, '#b9803f')
      for (let y = 0; y < s; y += 2) {
        for (let x = 0; x < s; x += 2) {
          const n = fbm2(x / 22, y / 22, 4, 3)
          const v = clamp(0.5 + n * 0.55, 0, 1)
          ctx.fillStyle = `rgba(${Math.round(70 + v * 120)},${Math.round(
            40 + v * 96,
          )},${Math.round(16 + v * 56)},0.42)`
          ctx.fillRect(x, y, 2, 2)
        }
      }
      for (let i = 0; i < 220; i++) {
        const x = rng() * s
        const y = rng() * s
        const r = 1.5 + rng() * 7
        wrapped(s, x, y, r + 2, (px, py) =>
          blob(ctx, px, py, r, `rgba(88,50,20,${0.12 + rng() * 0.2})`),
        )
      }
      for (let i = 0; i < 120; i++) {
        const x = rng() * s
        const y = rng() * s
        blob(ctx, x, y, 1 + rng() * 3, 'rgba(240,196,132,0.35)')
      }
    },
    { srgb: true },
  )

/* ------------------------------------------------------------------ */
/* Buttercream                                                         */
/* ------------------------------------------------------------------ */

export const creamMap = () =>
  texture(
    'cream',
    256,
    (ctx, s) => {
      const rng = mulberry32(88)
      fill(ctx, s, '#fdf6ea')
      for (let y = 0; y < s; y += 2) {
        for (let x = 0; x < s; x += 2) {
          const n = fbm2(x / 40, y / 26, 3, 17)
          const v = clamp(0.5 + n * 0.4, 0, 1)
          ctx.fillStyle = `rgba(${Math.round(196 + v * 58)},${Math.round(
            172 + v * 62,
          )},${Math.round(134 + v * 70)},0.34)`
          ctx.fillRect(x, y, 2, 2)
        }
      }
      // spatula tracks: long horizontal ridges with a soft highlight
      ctx.lineCap = 'round'
      for (let i = 0; i < 46; i++) {
        const y = rng() * s
        const w = 1.4 + rng() * 5
        ctx.strokeStyle = `rgba(214,190,150,${0.10 + rng() * 0.16})`
        ctx.lineWidth = w
        ctx.beginPath()
        ctx.moveTo(-10, y)
        for (let x = -10; x < s + 10; x += 16) {
          ctx.lineTo(x, y + Math.sin(x * 0.06 + i) * 2.4)
        }
        ctx.stroke()
        ctx.strokeStyle = `rgba(255,253,246,${0.16 + rng() * 0.2})`
        ctx.lineWidth = w * 0.42
        ctx.beginPath()
        ctx.moveTo(-10, y - w * 0.4)
        for (let x = -10; x < s + 10; x += 16) {
          ctx.lineTo(x, y - w * 0.4 + Math.sin(x * 0.06 + i) * 2.4)
        }
        ctx.stroke()
      }
    },
    { srgb: true },
  )

export const creamBump = () =>
  texture('creamBump', 256, (ctx, s) => {
    const rng = mulberry32(88)
    fill(ctx, s, '#808080')
    ctx.lineCap = 'round'
    for (let i = 0; i < 46; i++) {
      const y = rng() * s
      const w = 1.4 + rng() * 5
      ctx.strokeStyle = `rgba(0,0,0,${0.2 + rng() * 0.3})`
      ctx.lineWidth = w
      ctx.beginPath()
      ctx.moveTo(-10, y)
      for (let x = -10; x < s + 10; x += 16)
        ctx.lineTo(x, y + Math.sin(x * 0.06 + i) * 2.4)
      ctx.stroke()
      ctx.strokeStyle = `rgba(255,255,255,${0.24 + rng() * 0.3})`
      ctx.lineWidth = w * 0.45
      ctx.beginPath()
      ctx.moveTo(-10, y - w * 0.45)
      for (let x = -10; x < s + 10; x += 16)
        ctx.lineTo(x, y - w * 0.45 + Math.sin(x * 0.06 + i) * 2.4)
      ctx.stroke()
    }
  })

/* ------------------------------------------------------------------ */
/* Room surfaces                                                       */
/* ------------------------------------------------------------------ */

export const woodMap = () =>
  texture(
    'wood',
    256,
    (ctx, s) => {
      const rng = mulberry32(303)
      fill(ctx, s, '#9d6a41')
      for (let y = 0; y < s; y++) {
        const n = fbm2(y / 6, 0.5, 3, 5)
        const v = clamp(0.5 + n * 0.6, 0, 1)
        ctx.fillStyle = `rgba(${Math.round(60 + v * 120)},${Math.round(
          34 + v * 80,
        )},${Math.round(16 + v * 46)},0.45)`
        ctx.fillRect(0, y, s, 1)
      }
      for (let i = 0; i < 40; i++) {
        const y = rng() * s
        ctx.strokeStyle = `rgba(70,42,20,${0.08 + rng() * 0.14})`
        ctx.lineWidth = 0.6 + rng() * 1.6
        ctx.beginPath()
        ctx.moveTo(0, y)
        for (let x = 0; x <= s; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.03 + i) * 3)
        ctx.stroke()
      }
      // light scuffing from use
      for (let i = 0; i < 60; i++)
        blob(ctx, rng() * s, rng() * s, 2 + rng() * 12, 'rgba(255,236,214,0.05)')
    },
    { srgb: true },
  )

export const metalMap = () =>
  texture(
    'metal',
    256,
    (ctx, s) => {
      const rng = mulberry32(7)
      fill(ctx, s, '#b9bcc0')
      for (let i = 0; i < 700; i++) {
        const y = rng() * s
        ctx.strokeStyle = `rgba(${rng() > 0.5 ? 255 : 90},${
          rng() > 0.5 ? 255 : 92
        },${rng() > 0.5 ? 255 : 96},${0.03 + rng() * 0.07})`
        ctx.lineWidth = 0.5 + rng()
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(s, y + (rng() - 0.5) * 3)
        ctx.stroke()
      }
      for (let i = 0; i < 40; i++)
        blob(ctx, rng() * s, rng() * s, 3 + rng() * 14, 'rgba(70,72,78,0.06)')
    },
    { srgb: true },
  )

export const wallMap = () =>
  texture(
    'wall',
    256,
    (ctx, s) => {
      fill(ctx, s, '#8a7565')
      for (let y = 0; y < s; y += 2)
        for (let x = 0; x < s; x += 2) {
          const n = fbm2(x / 18, y / 18, 4, 21)
          const v = clamp(0.5 + n * 0.5, 0, 1)
          ctx.fillStyle = `rgba(${Math.round(40 + v * 90)},${Math.round(
            32 + v * 78,
          )},${Math.round(26 + v * 66)},0.4)`
          ctx.fillRect(x, y, 2, 2)
        }
    },
    { srgb: true },
  )

/**
 * One shared atlas for the background props (jars, tins, labels, oven parts).
 * Cells are 1/4 of the sheet; geometry UVs are authored straight into a cell so
 * the whole set of shelf props draws from a single 256px texture.
 */
export const propsAtlas = () =>
  texture(
    'props',
    256,
    (ctx, s) => {
      const rng = mulberry32(555)
      const cell = s / 4
      const cells: Array<[string, string]> = [
        ['#cfc3ad', '#a3927a'], // flour sack
        ['#8e5b3a', '#6c412a'], // cocoa tin
        ['#c9b184', '#a68a5f'], // kraft box
        ['#7d8f96', '#5c6b71'], // steel tin
        ['#d8cbbb', '#b6a591'], // ceramic jar
        ['#a8556b', '#7e3d4e'], // berry jar
        ['#c9a44c', '#9c7b32'], // honey
        ['#5f6d5a', '#465141'], // herb jar
        ['#e0d6c4', '#bcae98'], // paper
        ['#4a4744', '#33312f'], // oven metal
        ['#8f4a3a', '#6a352a'], // copper pot
        ['#bcb2a2', '#948b7d'], // linen
        ['#d5b9d8', '#ab92ae'], // sprinkle jar
        ['#9ec6d8', '#7aa0b1'], // blue jar
        ['#3c3835', '#2a2724'], // dark trim
        ['#efe6d3', '#cfc4ad'], // label
      ]
      cells.forEach(([a, b], i) => {
        const cx = (i % 4) * cell
        const cy = Math.floor(i / 4) * cell
        const g = ctx.createLinearGradient(cx, cy, cx + cell, cy + cell)
        g.addColorStop(0, a)
        g.addColorStop(1, b)
        ctx.fillStyle = g
        ctx.fillRect(cx, cy, cell, cell)
        for (let k = 0; k < 60; k++) {
          ctx.fillStyle = `rgba(255,255,255,${rng() * 0.06})`
          ctx.fillRect(cx + rng() * cell, cy + rng() * cell, 2, 2)
        }
        // a paper band, so jars read as labelled containers from a distance
        if (i % 3 === 0) {
          ctx.fillStyle = 'rgba(246,238,222,0.85)'
          ctx.fillRect(cx + 2, cy + cell * 0.44, cell - 4, cell * 0.22)
          ctx.fillStyle = 'rgba(80,64,50,0.55)'
          for (let k = 0; k < 3; k++)
            ctx.fillRect(cx + 6, cy + cell * 0.48 + k * 4, cell - 14 - k * 6, 1.6)
        }
      })
    },
    { srgb: true },
  )

/** UV offset for atlas cell `i` (0..15), for authoring prop UVs. */
export function atlasUV(i: number): { u: number; v: number; size: number } {
  const size = 0.25
  return { u: (i % 4) * size, v: 1 - size - Math.floor(i / 4) * size, size }
}

/** Soft radial darkening used as a contact shadow decal under heavy props. */
export const contactShadowMap = () =>
  texture('contact', 128, (ctx, s) => {
    ctx.clearRect(0, 0, s, s)
    const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.08, s / 2, s / 2, s * 0.5)
    g.addColorStop(0, 'rgba(0,0,0,0.72)')
    g.addColorStop(0.45, 'rgba(0,0,0,0.38)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
  })

export function disposeTextures() {
  cache.forEach((t) => t.dispose())
  cache.clear()
}
