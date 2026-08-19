import './ui/style.css'
import { Game } from './game/game'
import { DEBUG } from './core/flags'

const canvas = document.getElementById('stage') as HTMLCanvasElement

let game: Game
try {
  game = new Game(canvas)
} catch (err) {
  const boot = document.getElementById('boot')
  if (boot)
    boot.textContent =
      'この　ブラウザでは　あそべません (WebGL2 がひつようです)'
  throw err
}

let last = performance.now()
let running = true
let rafId = 0

function frame(now: number) {
  rafId = requestAnimationFrame(frame)
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  game.update(dt)
  game.render()
  game.stageObj.sampleFrame(performance.now() - now, now)
}

function start() {
  if (running) return
  running = true
  last = performance.now()
  rafId = requestAnimationFrame(frame)
}

function stop() {
  running = false
  cancelAnimationFrame(rafId)
}

/** Pause physics and drawing in the background; resume without a time jump. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stop()
    game.onHidden()
  } else {
    game.onVisible()
    start()
  }
})

let resizeRaf = 0
const onResize = () => {
  cancelAnimationFrame(resizeRaf)
  // iOS reports stale metrics during a rotation; settle on the next frame
  resizeRaf = requestAnimationFrame(() => game.onResize())
}
window.addEventListener('resize', onResize)
window.addEventListener('orientationchange', onResize)
if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize)

rafId = requestAnimationFrame(frame)
requestAnimationFrame(() => game.bootDone())

if (DEBUG) {
  const el = document.createElement('pre')
  el.style.cssText =
    'position:fixed;left:8px;bottom:8px;margin:0;font:11px/1.4 monospace;color:#9fe;text-shadow:0 1px 2px #000;pointer-events:none;z-index:9'
  document.body.appendChild(el)
  setInterval(() => {
    el.textContent = JSON.stringify(game.debugState, null, 1)
  }, 200)
}

// Test surface for the Chromium smoke run (and handy in the console).
declare global {
  interface Window {
    __cake?: {
      state: () => Game['debugState']
      project: (x: number, y: number, z: number) => { x: number; y: number }
      dump: () => unknown
      restart: () => void
    }
  }
}
window.__cake = {
  state: () => game.debugState,
  project: (x, y, z) => game.project(x, y, z),
  dump: () => game.candyDump,
  restart: () => game.restart(),
}
