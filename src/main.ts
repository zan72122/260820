import { Game } from './Game'

const canvas = document.getElementById('gl') as HTMLCanvasElement
const overlay = document.getElementById('overlay') as HTMLElement
const boot = document.getElementById('boot') as HTMLElement

function fail(): void {
  const d = document.createElement('div')
  d.className = 'no-webgl'
  d.textContent = 'WebGL を利用できません。別のブラウザでお試しください。'
  document.getElementById('app')?.appendChild(d)
  boot.classList.add('gone')
}

try {
  const game = new Game(canvas, overlay)
  game.start()
  // Textures and geometry are all generated on the fly, so one frame is enough.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      boot.classList.add('gone')
      window.setTimeout(() => boot.remove(), 1000)
    })
  })
  ;(window as unknown as { game: Game }).game = game
} catch (err) {
  console.error(err)
  fail()
}
