import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace, WebGLRenderer } from 'three'
import { Game } from './game/game'
import { buildTextures, type TextureBundle } from './gfx/textureLab'
import { detectQuality, isE2E } from './core/quality'
import { Audio } from './core/audio'
import type { SafeInsets } from './game/cameraDirector'

const canvas = document.getElementById('view') as HTMLCanvasElement
const boot = document.getElementById('boot') as HTMLDivElement
const lost = document.getElementById('lost') as HTMLDivElement

/** Read the CSS environment safe-area insets in device-independent pixels. */
function readSafeInsets(): SafeInsets {
  const probe = document.createElement('div')
  probe.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'width:0',
    'height:0',
    'visibility:hidden',
    'padding-top:env(safe-area-inset-top,0px)',
    'padding-right:env(safe-area-inset-right,0px)',
    'padding-bottom:env(safe-area-inset-bottom,0px)',
    'padding-left:env(safe-area-inset-left,0px)',
  ].join(';')
  document.body.appendChild(probe)
  const cs = getComputedStyle(probe)
  const insets: SafeInsets = {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  }
  probe.remove()
  return insets
}

function seedFromQuery(): number {
  const raw = new URLSearchParams(location.search).get('seed')
  if (raw !== null) {
    const n = Number(raw)
    if (Number.isFinite(n)) return n >>> 0
  }
  // Deterministic capture runs must always look the same.
  if (isE2E()) return 0x1a2b3c4d
  return (Math.random() * 0xffffffff) >>> 0
}

async function main(): Promise<void> {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: isE2E(),
  })
  const quality = detectQuality(renderer.getContext())
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.12
  renderer.shadowMap.enabled = quality.shadows
  renderer.shadowMap.type = PCFSoftShadowMap
  renderer.setClearColor(0x2d3a2f, 1)

  const seed = seedFromQuery()
  const audio = new Audio()
  let textures: TextureBundle
  try {
    textures = await buildTextures(renderer, quality, seed)
  } catch (err) {
    console.error('texture build failed', err)
    return
  }

  const game = new Game({ renderer, canvas, textures, quality, audio, seed })

  let width = 0
  let height = 0
  const resize = (): void => {
    const insets = readSafeInsets()
    width = Math.max(1, Math.round(window.innerWidth))
    height = Math.max(1, Math.round(window.innerHeight))
    const dpr = Math.min(window.devicePixelRatio || 1, quality.pixelRatioCap)
    renderer.setPixelRatio(dpr)
    renderer.setSize(width, height, false)
    game.setViewport(width, height, insets)
  }
  resize()
  window.addEventListener('resize', resize)
  window.addEventListener('orientationchange', () => {
    // iOS reports the old size for a frame or two after a rotation.
    resize()
    setTimeout(resize, 120)
    setTimeout(resize, 420)
  })
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resize)
  }

  // ---- WebGL context loss -----------------------------------------------
  let contextLost = false
  canvas.addEventListener(
    'webglcontextlost',
    (e) => {
      e.preventDefault()
      contextLost = true
      lost.classList.add('on')
    },
    false,
  )
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false
    renderer.resetState()
    renderer.shadowMap.enabled = quality.shadows
    renderer.shadowMap.type = PCFSoftShadowMap
    resize()
    lost.classList.remove('on')
  })

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      audio.suspend()
    } else {
      audio.resume()
      last = performance.now()
    }
  })

  let last = performance.now()
  let raf = 0
  let paused = false
  const frame = (now: number): void => {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
    last = now
    if (contextLost || document.hidden) return
    if (paused) {
      game.render()
      return
    }
    game.update(dt)
    game.render()
  }
  raf = requestAnimationFrame(frame)
  void raf

  boot.classList.add('gone')
  setTimeout(() => boot.remove(), 800)

  // ---- automation surface ------------------------------------------------
  // Only ever read by the capture scripts; the game itself never uses it.
  ;(window as unknown as Record<string, unknown>).__mango = {
    ready: true,
    quality: quality.tier,
    seed,
    state: () => game.debugState(),
    pause: (on: boolean) => {
      paused = on
      last = performance.now()
    },
    attach: (l: number, r: number) => game.forceAttach(l, r),
    scrub: (v: number) => game.scrub(v),
    closeup: (on: boolean) => game.setCloseup(on),
    poke: (v?: number) => game.pokeNet(v),
    step: (seconds: number, dt = 1 / 60) => {
      const n = Math.max(1, Math.round(seconds / dt))
      for (let i = 0; i < n; i++) game.update(dt)
    },
    render: () => game.render(),
    size: () => ({ width, height }),
    dumpTexture: (name: string) => textures.debugCanvases?.[name]?.toDataURL('image/png') ?? null,
    dumpMangoChannel: (channel: number) => {
      const t = textures.mangoData as unknown as {
        image: { data: Uint8Array; width: number; height: number }
      }
      const { data, width, height } = t.image
      const c = document.createElement('canvas')
      c.width = width
      c.height = height
      const ctx = c.getContext('2d')!
      const img = ctx.createImageData(width, height)
      for (let i = 0; i < width * height; i++) {
        const v = data[i * 4 + channel]
        img.data[i * 4] = v
        img.data[i * 4 + 1] = v
        img.data[i * 4 + 2] = v
        img.data[i * 4 + 3] = 255
      }
      ctx.putImageData(img, 0, 0)
      return c.toDataURL('image/png')
    },
  }
}

void main()
