import './style.css'
import * as THREE from 'three'
import { Game } from './game'
import { CircleGesture, PathGesture, TapGesture } from './core/gestures'

const params = new URLSearchParams(location.search)
const FAST = params.get('fast') === '1'
const canvas = document.getElementById('stage') as HTMLCanvasElement

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
const maxDpr = FAST ? 1 : isMobile ? 2 : 2
const quality: 'high' | 'low' = FAST || isMobile ? 'low' : 'high'

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !FAST && !isMobile,
  powerPreference: 'high-performance',
  alpha: false,
  stencil: false,
})
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.94
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.localClippingEnabled = true
renderer.setClearColor(0xe9e2d6, 1)

const game = new Game(renderer, canvas, quality)

// ---- adaptive resolution ---------------------------------------------------
let dpr = Math.min(maxDpr, window.devicePixelRatio || 1)
let frameAcc = 0
let frameCount = 0

function resize() {
  const w = Math.max(1, window.innerWidth)
  const h = Math.max(1, window.innerHeight)
  renderer.setPixelRatio(dpr)
  renderer.setSize(w, h, false)
  game.resize(w, h)
}

window.addEventListener('resize', resize)
window.addEventListener('orientationchange', () => {
  game.interrupt()
  setTimeout(resize, 120)
})
window.visualViewport?.addEventListener('resize', resize)

// ---- loop ------------------------------------------------------------------
let last = performance.now()
let running = true
let timeScale = 1
let rafId = 0

function tick(now: number) {
  rafId = requestAnimationFrame(tick)
  const raw = Math.min(0.05, (now - last) / 1000)
  last = now
  if (!running) return

  frameAcc += raw
  frameCount++
  if (frameCount >= 60) {
    const avg = frameAcc / frameCount
    if (avg > 0.023 && dpr > 0.75) {
      dpr = Math.max(0.75, dpr - 0.2)
      resize()
    } else if (avg < 0.0135 && dpr < Math.min(maxDpr, window.devicePixelRatio || 1)) {
      dpr = Math.min(Math.min(maxDpr, window.devicePixelRatio || 1), dpr + 0.15)
      resize()
    }
    frameAcc = 0
    frameCount = 0
  }

  game.update(raw * timeScale)
  renderer.render(game.world.scene, game.rig.camera)
}

// Tab hidden / app backgrounded: nothing advances, no sound, no hot pan moving.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    running = false
    game.interrupt()
    game.audio.suspend()
  } else {
    last = performance.now()
    running = true
    game.audio.resume()
  }
})
window.addEventListener('pagehide', () => {
  running = false
  game.audio.suspend()
})

resize()
game.start()
rafId = requestAnimationFrame(tick)
requestAnimationFrame(() => game.hud.setLoaded())

// ---- automation surface ----------------------------------------------------
declare global {
  interface Window {
    __chiffon: {
      state: () => ReturnType<Game['debugState']>
      guidePx: () => { x: number; y: number }[] | null
      gestureKind: () => string | null
      setTimeScale: (s: number) => void
      goto: (id: string) => void
      pickFlavor: (id: string) => void
      step: (seconds: number, dt?: number) => void
      render: () => void
      progress: () => number | null
      fast: boolean
      running: () => boolean
    }
  }
}

window.__chiffon = {
  state: () => game.debugState(),
  guidePx: () => {
    const g = game.input.active
    if (!g) return null
    const pts = g.guide()
    if (!pts.length) return null
    return pts.map((p) => game.input.toPx(p))
  },
  gestureKind: () => {
    const g = game.input.active
    if (!g) return null
    if (g instanceof CircleGesture) return 'circle'
    if (g instanceof TapGesture) return 'tap'
    if (g instanceof PathGesture) return 'path'
    return 'other'
  },
  setTimeScale: (s: number) => {
    timeScale = Math.max(0.1, Math.min(8, s))
  },
  goto: (id: string) => game.goto(id as never),
  // Lets an automated play-through advance logical time without waiting on
  // a software rasteriser to draw every frame.
  step: (seconds: number, dt = 1 / 60) => {
    const n = Math.max(1, Math.min(4000, Math.round(seconds / dt)))
    for (let i = 0; i < n; i++) game.update(dt)
  },
  render: () => renderer.render(game.world.scene, game.rig.camera),
  progress: () => game.input.active?.progress ?? null,
  pickFlavor: (id: string) => game.setFlavorById(id),
  fast: FAST,
  running: () => running && rafId !== 0,
}

if (FAST) timeScale = 2

// Development-only inspection helpers (tree-shaken out unless ?fast=1 is used).
if (FAST) {
  ;(window as unknown as { __dbg: unknown }).__dbg = {
    isolateCake: () => {
      game.world.chiffon.setFill(1)
      game.world.chiffon.setRise(1)
      game.world.chiffon.setBake(1)
      game.world.scene.traverse((o) => {
        if (o !== game.world.chiffon.mesh && (o as THREE.Mesh).isMesh) o.visible = false
      })
      game.world.chiffon.mesh.visible = true
      game.rig.snapTo({
        portrait: { pos: [0.02, 0.22, 0.42], target: [0.02, 0.06, 0.06], fov: 40 },
        landscape: { pos: [0.02, 0.22, 0.42], target: [0.02, 0.06, 0.06], fov: 40 },
      })
    },
    look: (px: number, py: number, pz: number, tx: number, ty: number, tz: number, fov = 40) => {
      const pose = { pos: [px, py, pz] as [number, number, number], target: [tx, ty, tz] as [number, number, number], fov }
      game.rig.snapTo({ portrait: pose, landscape: pose })
    },
    cakeInfo: () => {
      const m = game.world.chiffon.mesh
      m.geometry.computeBoundingBox()
      return {
        parent: m.parent?.name,
        worldPos: m.getWorldPosition(new THREE.Vector3()).toArray(),
        bbox: m.geometry.boundingBox?.min.toArray().concat(m.geometry.boundingBox.max.toArray()),
        influences: m.morphTargetInfluences,
      }
    },
  }
}
