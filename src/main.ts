import { Game } from './core/Game'
import { Ambience } from './core/Audio'
import { Hud } from './ui/Hud'
import { VenueChapter } from './chapters/VenueChapter'

/**
 * 「長岡花火の一晩」
 * 第一夜：信濃川河川敷の会場をととのえる。
 */

const canvas = document.getElementById('stage') as HTMLCanvasElement
const uiRoot = document.getElementById('ui') as HTMLElement

const hud = new Hud(uiRoot)
const audio = new Ambience()

const aspect = () => window.innerWidth / Math.max(1, window.innerHeight)

// 画面の高さは iOS のツールバーで変わるので、実測値を CSS 変数に流す
function syncViewport() {
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`)
}
syncViewport()
window.addEventListener('resize', syncViewport)
window.addEventListener('orientationchange', () => setTimeout(syncViewport, 300))

// テクスチャ生成で一瞬止まるので、読み込み表示を出してから組み立てる
requestAnimationFrame(() => {
  setTimeout(() => {
    let game: Game
    try {
      game = new Game(canvas)
    } catch (err) {
      console.error(err)
      showFatal('この ブラウザでは 3D を ひょうじ できません')
      return
    }

    const chapter = new VenueChapter(
      game.quality.level,
      game.quality.shadowMap,
      hud,
      audio,
      aspect(),
    )
    game.setChapter(chapter)
    game.start()
    hud.hideLoading()

    window.addEventListener('resize', () => chapter.setAspect(aspect()))
    window.addEventListener('orientationchange', () =>
      setTimeout(() => chapter.setAspect(aspect()), 300),
    )

    // 開発用のショートカット（?dbg=gate など）
    const dbg = new URLSearchParams(location.search).get('dbg')
    if (dbg) {
      ;(window as unknown as { venue: VenueChapter }).venue = chapter
      hud.showStart(false)
      chapter.jump(dbg)
    }

    hud.onStart = () => {
      void audio.start()
      hud.showStart(false)
      chapter.restart()
    }
    hud.onReplay = () => {
      hud.showEnd(false)
      chapter.restart()
    }

    // iOS で音が止まったときの復帰
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void audio.start()
    })
  }, 60)
})

function showFatal(msg: string) {
  const d = document.createElement('div')
  d.className = 'veil'
  d.innerHTML = `<div class="title-block"><div class="title-sub">${msg}</div></div>`
  uiRoot.appendChild(d)
  hud.hideLoading()
}
