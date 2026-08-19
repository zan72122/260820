import { Game } from './game/game'

declare global {
  interface Window {
    __game?: Game
  }
}

function fail(msg: string) {
  const n = document.createElement('div')
  n.id = 'notice'
  n.className = 'show'
  n.innerHTML = `<div><p style="font-size:1.3em;font-weight:800">稲コンバイン</p><p>${msg}</p></div>`
  document.getElementById('app')?.appendChild(n)
  document.getElementById('boot')?.classList.add('hidden')
}

async function boot() {
  const canvas = document.getElementById('scene') as HTMLCanvasElement | null
  const ui = document.getElementById('ui')
  if (!canvas || !ui) return

  // fail early and legibly rather than throwing at the first draw call
  const probe = document.createElement('canvas')
  if (!probe.getContext('webgl2') && !probe.getContext('webgl')) {
    fail('このブラウザでは WebGL が使えません。<br>Safari の設定を確認してください。')
    return
  }

  try {
    const game = new Game(canvas, ui)
    await game.build()
    game.start()
    window.__game = game
    requestAnimationFrame(() => {
      document.getElementById('boot')?.classList.add('hidden')
      window.setTimeout(() => document.getElementById('boot')?.remove(), 700)
    })
  } catch (err) {
    console.error(err)
    fail(`よみこみに しっぱいしました。<br><small>${String(err)}</small>`)
  }
}

// iOS fires a synthetic resize when the URL bar collapses; nothing else to do
window.addEventListener('gesturestart', (e) => e.preventDefault())
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false })

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
else void boot()
