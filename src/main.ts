import './style.css'
import { Game } from './core/app'

const canvas = document.getElementById('scene') as HTMLCanvasElement
const veil = document.getElementById('veil') as HTMLElement

declare global {
  interface Window {
    momo?: {
      debug(): Record<string, unknown>
      test: Record<string, (...args: number[]) => void>
    }
  }
}

try {
  const game = new Game(canvas, veil)
  window.momo = { debug: () => game.debug(), test: game.testApi() }
} catch (err) {
  // No WebGL2: leave a calm empty field rather than an error dialog a child
  // cannot read.
  console.error(err)
  veil.style.background = 'linear-gradient(#cfe3f2, #d8d2b6)'
  veil.classList.remove('clear')
}
