import { Game } from './game/Game'

const container = document.getElementById('app')!
const veil = document.getElementById('veil')

try {
  const game = new Game(container)
  game.start()
  // Dissolve the load veil once there is actually something behind it.
  requestAnimationFrame(() => requestAnimationFrame(() => veil?.classList.add('gone')))
  setTimeout(() => veil?.remove(), 2200)
} catch (err) {
  console.error(err)
  if (veil) {
    veil.style.background = '#1a1512'
    veil.style.color = '#e8dcb8'
    veil.style.display = 'flex'
    veil.style.alignItems = 'center'
    veil.style.justifyContent = 'center'
    veil.style.font = '16px/1.6 system-ui, sans-serif'
    veil.style.padding = '2rem'
    veil.style.textAlign = 'center'
    veil.textContent = 'WebGL 2 が使えないため、この端末では表示できません。'
  }
}
