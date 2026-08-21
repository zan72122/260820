import './styles.css'
import { createQuality } from './core/quality'
import { Game } from './game/game'

function fail(message: string): void {
  const boot = document.getElementById('boot')
  if (!boot) return
  boot.innerHTML = ''
  const p = document.createElement('p')
  p.textContent = message
  p.style.cssText =
    'color:#c8d2df;font:14px/1.7 -apple-system,sans-serif;text-align:center;padding:0 28px;max-width:22rem'
  boot.appendChild(p)
}

async function main(): Promise<void> {
  const canvas = document.getElementById('scene') as HTMLCanvasElement | null
  const uiRoot = document.getElementById('ui')
  if (!canvas || !uiRoot) return

  // iOS fires a synthetic resize as the address bar collapses; re-reading the
  // element size on the next frame keeps the first render at the right shape.
  const sizeProbe = document.createElement('canvas')
  const quality = createQuality(sizeProbe)

  let game: Game
  try {
    game = new Game(canvas, quality, uiRoot)
  } catch (err) {
    console.error(err)
    fail('この端末では表示できませんでした。ページを再読み込みしてください。')
    return
  }

  await game.start()

  if (new URLSearchParams(location.search).get('debug') === '1') {
    const { mountDebug } = await import('./debug/debug')
    mountDebug(game, uiRoot)
  }

  // Expose the instance for the automated smoke test only.
  ;(window as Window & { __game?: Game }).__game = game
}

void main().catch((err) => {
  console.error(err)
  fail('読み込みに失敗しました。ページを再読み込みしてください。')
})
