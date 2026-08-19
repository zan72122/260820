import * as THREE from 'three'
import { Rng } from './math'

type Ctx2D = CanvasRenderingContext2D

function makeCanvas(size: number, draw: (c: Ctx2D, s: number) => void): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const c = cv.getContext('2d')!
  draw(c, size)
  return cv
}

function tex(cv: HTMLCanvasElement, repeat = 1, srgb = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(cv)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.anisotropy = 4
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}

const cache = new Map<string, THREE.Texture>()
function once(key: string, build: () => THREE.Texture): THREE.Texture {
  let t = cache.get(key)
  if (!t) {
    t = build()
    cache.set(key, t)
  }
  return t
}

/** Warm beech worktop. */
export function woodTexture(): THREE.Texture {
  return once('wood', () => {
    const cv = makeCanvas(512, (c, s) => {
      const g = c.createLinearGradient(0, 0, 0, s)
      g.addColorStop(0, '#c99a68')
      g.addColorStop(0.5, '#c08e5c')
      g.addColorStop(1, '#c69465')
      c.fillStyle = g
      c.fillRect(0, 0, s, s)
      const rng = new Rng(7717)
      for (let i = 0; i < 260; i++) {
        const y = rng.range(0, s)
        c.strokeStyle = `rgba(${90 + rng.range(0, 50) | 0},${60 + rng.range(0, 40) | 0},30,${rng.range(0.03, 0.14).toFixed(3)})`
        c.lineWidth = rng.range(0.6, 3.2)
        c.beginPath()
        c.moveTo(0, y)
        for (let x = 0; x <= s; x += 32) c.lineTo(x, y + Math.sin(x * 0.03 + i) * rng.range(0.5, 3.5))
        c.stroke()
      }
      for (let i = 0; i < 14; i++) {
        const x = rng.range(0, s), y = rng.range(0, s), r = rng.range(3, 9)
        c.strokeStyle = 'rgba(105,72,38,0.18)'
        c.lineWidth = 1.4
        for (let k = 0; k < 4; k++) {
          c.beginPath()
          c.ellipse(x, y, r + k * 2.6, (r + k * 2.6) * 0.6, rng.range(0, 3), 0, Math.PI * 2)
          c.stroke()
        }
      }
    })
    return tex(cv, 2, true)
  })
}

/** Soft matte wall tiles for the back of the patisserie. */
export function tileTexture(): THREE.Texture {
  return once('tile', () => {
    const cv = makeCanvas(256, (c, s) => {
      c.fillStyle = '#e9e6df'
      c.fillRect(0, 0, s, s)
      const n = 4, cell = s / n
      const rng = new Rng(4242)
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const v = rng.range(-6, 6) | 0
          c.fillStyle = `rgb(${232 + v},${229 + v},${222 + v})`
          c.fillRect(i * cell + 2, j * cell + 2, cell - 4, cell - 4)
        }
      c.strokeStyle = 'rgba(190,186,178,0.9)'
      c.lineWidth = 2
      for (let i = 0; i <= n; i++) {
        c.beginPath(); c.moveTo(i * cell, 0); c.lineTo(i * cell, s); c.stroke()
        c.beginPath(); c.moveTo(0, i * cell); c.lineTo(s, i * cell); c.stroke()
      }
    })
    return tex(cv, 6, true)
  })
}

/** Fine vertical brushing for the aluminium pan (roughness + bump). */
export function aluminiumRough(): THREE.Texture {
  return once('alu-rough', () => {
    const cv = makeCanvas(512, (c, s) => {
      c.fillStyle = '#c2c2c2'
      c.fillRect(0, 0, s, s)
      const rng = new Rng(9091)
      for (let i = 0; i < 1400; i++) {
        const x = rng.range(0, s)
        const a = rng.range(0.02, 0.16)
        const bright = rng.next() > 0.5
        c.strokeStyle = bright ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`
        c.lineWidth = rng.range(0.4, 1.6)
        c.beginPath()
        c.moveTo(x, rng.range(-20, s * 0.4))
        c.lineTo(x + rng.range(-2, 2), rng.range(s * 0.6, s + 20))
        c.stroke()
      }
      // faint used-pan blotches
      for (let i = 0; i < 26; i++) {
        const g = c.createRadialGradient(rng.range(0, s), rng.range(0, s), 1, rng.range(0, s), rng.range(0, s), rng.range(20, 70))
        g.addColorStop(0, 'rgba(120,110,95,0.20)')
        g.addColorStop(1, 'rgba(120,110,95,0)')
        c.fillStyle = g
        c.fillRect(0, 0, s, s)
      }
    })
    const t = tex(cv, 1)
    t.repeat.set(6, 1)
    return t
  })
}

/** Slight bake-discolouration overlay for a used pan. */
export function aluminiumTint(): THREE.Texture {
  return once('alu-tint', () => {
    const cv = makeCanvas(256, (c, s) => {
      c.fillStyle = '#cfd0cd'
      c.fillRect(0, 0, s, s)
      const rng = new Rng(3311)
      for (let i = 0; i < 40; i++) {
        const g = c.createRadialGradient(rng.range(0, s), rng.range(0, s), 1, rng.range(0, s), rng.range(0, s), rng.range(14, 60))
        g.addColorStop(0, `rgba(${188 + rng.range(0, 20) | 0},${172 + rng.range(0, 20) | 0},148,0.28)`)
        g.addColorStop(1, 'rgba(190,175,150,0)')
        c.fillStyle = g
        c.fillRect(0, 0, s, s)
      }
    })
    const t = tex(cv, 1, true)
    t.repeat.set(3, 1)
    return t
  })
}

/** Quilted oven-mitt cloth. */
export function mittTexture(color: string): THREE.Texture {
  return once('mitt-' + color, () => {
    const cv = makeCanvas(256, (c, s) => {
      c.fillStyle = color
      c.fillRect(0, 0, s, s)
      const rng = new Rng(555)
      for (let i = 0; i < 4000; i++) {
        c.fillStyle = `rgba(255,255,255,${rng.range(0.01, 0.06)})`
        c.fillRect(rng.range(0, s), rng.range(0, s), 1.5, 1.5)
      }
      c.strokeStyle = 'rgba(255,255,255,0.30)'
      c.setLineDash([5, 6])
      c.lineWidth = 2
      for (let i = 0; i <= 4; i++) {
        const p = (i * s) / 4
        c.beginPath(); c.moveTo(p, 0); c.lineTo(p, s); c.stroke()
        c.beginPath(); c.moveTo(0, p); c.lineTo(s, p); c.stroke()
      }
      c.setLineDash([])
      c.fillStyle = 'rgba(0,0,0,0.08)'
      for (let i = 0; i < 60; i++) c.fillRect(rng.range(0, s), rng.range(0, s), rng.range(2, 10), rng.range(2, 10))
    })
    return tex(cv, 2, true)
  })
}

/** Chiffon crumb: irregular fine bubbles, used for the cut-away face. */
export function crumbTexture(base: string, dark: string, seed = 1234): THREE.Texture {
  return once(`crumb-${base}-${seed}`, () => {
    const cv = makeCanvas(512, (c, s) => {
      c.fillStyle = base
      c.fillRect(0, 0, s, s)
      const rng = new Rng(seed)
      for (let i = 0; i < 2600; i++) {
        const r = Math.pow(rng.next(), 2.2) * 9 + 1.1
        const x = rng.range(0, s), y = rng.range(0, s)
        const g = c.createRadialGradient(x - r * 0.25, y - r * 0.25, 0.2, x, y, r)
        g.addColorStop(0, `rgba(0,0,0,${rng.range(0.06, 0.2)})`)
        g.addColorStop(0.75, `rgba(0,0,0,${rng.range(0.03, 0.1)})`)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        c.fillStyle = g
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill()
        c.strokeStyle = `rgba(255,255,255,${rng.range(0.05, 0.18)})`
        c.lineWidth = 0.7
        c.beginPath(); c.arc(x, y, r * 0.92, Math.PI * 0.8, Math.PI * 1.9); c.stroke()
      }
      c.fillStyle = dark
      c.globalAlpha = 0.5
      c.fillRect(0, 0, s, 14)
      c.globalAlpha = 1
    })
    return tex(cv, 1, true)
  })
}

/** Soft round sprite for steam. */
export function steamSprite(): THREE.Texture {
  return once('steam', () => {
    const cv = makeCanvas(128, (c, s) => {
      const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
      g.addColorStop(0, 'rgba(255,255,255,0.85)')
      g.addColorStop(0.35, 'rgba(255,255,255,0.42)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      c.fillStyle = g
      c.fillRect(0, 0, s, s)
    })
    const t = new THREE.CanvasTexture(cv)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })
}

/** Baked top crust: tiny mottling + a hint of cracking. */
export function crustTexture(tintA: string, tintB: string, seed = 99): THREE.Texture {
  return once(`crust-${tintA}-${tintB}-${seed}`, () => {
    const cv = makeCanvas(512, (c, s) => {
      c.fillStyle = tintA
      c.fillRect(0, 0, s, s)
      const rng = new Rng(seed)
      for (let i = 0; i < 900; i++) {
        const g = c.createRadialGradient(rng.range(0, s), rng.range(0, s), 0.5, rng.range(0, s), rng.range(0, s), rng.range(3, 22))
        g.addColorStop(0, tintB)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        c.globalAlpha = rng.range(0.05, 0.22)
        c.fillStyle = g
        c.fillRect(0, 0, s, s)
      }
      c.globalAlpha = 1
    })
    return tex(cv, 1, true)
  })
}

/** Frosted window light panel. */
export function windowTexture(): THREE.Texture {
  return once('window', () => {
    const cv = makeCanvas(256, (c, s) => {
      const g = c.createLinearGradient(0, 0, 0, s)
      g.addColorStop(0, '#ffffff')
      g.addColorStop(0.6, '#f2f6fb')
      g.addColorStop(1, '#dfe7f0')
      c.fillStyle = g
      c.fillRect(0, 0, s, s)
    })
    return tex(cv, 1, true)
  })
}
