import './ui/styles.css'
import { Game } from './game'

const app = document.getElementById('app')
if (!app) throw new Error('#app not found')

function fail(message: string) {
  app!.innerHTML = `<div class="screen"><div class="card"><h1>うごかせません</h1><p>${message}</p></div></div>`
}

try {
  const probe = document.createElement('canvas')
  const gl = probe.getContext('webgl2') || probe.getContext('webgl')
  if (!gl) {
    fail('この ブラウザでは WebGL が つかえません。')
  } else {
    new Game(app)
  }
} catch (err) {
  console.error(err)
  fail('よみこみに しっぱいしました。ページを さいよみこみ してください。')
}

// iOS Safari のダブルタップ拡大とスクロールを抑える
document.addEventListener('gesturestart', (e) => e.preventDefault())
document.addEventListener('dblclick', (e) => e.preventDefault())
