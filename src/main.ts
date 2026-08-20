import { Game } from './game/Game'
import { Input } from './core/Input'
import { Settings } from './core/Settings'
import { Quality } from './core/Quality'
import { GameAudio } from './audio/Audio'
import { UI } from './ui/UI'

const canvas = document.getElementById('gl') as HTMLCanvasElement
const settings = new Settings()
const quality = new Quality(settings)
const audio = new GameAudio()
const input = new Input(canvas)
const game = new Game(canvas, input, settings, quality, audio)

let running = false
const ui = new UI(game, settings, audio, () => {
  running = true
})

function layout() {
  const w = Math.max(1, Math.round(window.innerWidth))
  const h = Math.max(1, Math.round(window.innerHeight))
  document.body.style.width = `${w}px`
  document.body.style.height = `${h}px`
  game.resize(w, h)
}
layout()
window.addEventListener('resize', layout)
window.addEventListener('orientationchange', () => {
  layout()
  setTimeout(layout, 250)
})
window.visualViewport?.addEventListener('resize', layout)

let last = performance.now()
let timeScale = 1
const STEP = 1 / 32
function frame(now: number) {
  requestAnimationFrame(frame)
  const real = Math.max(0.0005, (now - last) / 1000)
  last = now
  quality.sample(real)
  // Fixed sub-steps: on a slow device the simulation still advances in real
  // time instead of drifting into slow motion, and physics stays stable.
  let acc = Math.min(0.25, real * timeScale)
  if (!running) acc = 0
  let steps = 0
  while (acc > 1e-4 && steps < 8) {
    const step = Math.min(STEP, acc)
    game.update(step)
    acc -= step
    steps++
  }
  if (!running) game.update(1e-5)
  game.render()
  ui.update()
}
requestAnimationFrame(frame)

// expose a little state for automated checks
;(window as unknown as Record<string, unknown>).__renkon = {
  game,
  get phase() {
    return game.phase
  },
  get harvested() {
    return game.harvested
  },
  setTimeScale(v: number) {
    timeScale = Math.max(0.1, Math.min(6, v))
  },
}
