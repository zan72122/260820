import type { Settings } from '../core/Settings'
import type { Game } from '../game/Game'
import type { GameAudio } from '../audio/Audio'

const css = `
.rk-ui { position: fixed; inset: 0; pointer-events: none; z-index: 10;
  padding: calc(env(safe-area-inset-top) + 10px) calc(env(safe-area-inset-right) + 10px)
           calc(env(safe-area-inset-bottom) + 10px) calc(env(safe-area-inset-left) + 10px); }
.rk-btn { pointer-events: auto; position: absolute; width: 52px; height: 52px; border-radius: 26px;
  border: none; background: rgba(24,26,24,0.42); backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px); color: #eee; display: flex; align-items: center;
  justify-content: center; cursor: pointer; box-shadow: 0 2px 10px rgba(0,0,0,0.25); }
.rk-btn:active { transform: scale(0.94); }
.rk-gear { top: calc(env(safe-area-inset-top) + 10px); right: calc(env(safe-area-inset-right) + 10px); }
.rk-replay { bottom: calc(env(safe-area-inset-bottom) + 12px); left: calc(env(safe-area-inset-left) + 12px);
  opacity: 0; transition: opacity .4s; }
.rk-replay.on { opacity: 1; }
.rk-panel { pointer-events: auto; position: absolute; top: calc(env(safe-area-inset-top) + 70px);
  right: calc(env(safe-area-inset-right) + 10px); width: 244px; max-width: calc(100vw - 24px);
  background: rgba(22,24,22,0.72); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  border-radius: 16px; padding: 14px 16px; color: #e9e7e0; font-size: 14px; display: none;
  box-shadow: 0 6px 24px rgba(0,0,0,0.35); }
.rk-panel.open { display: block; }
.rk-row { display: flex; align-items: center; justify-content: space-between; margin: 12px 0; gap: 10px; }
.rk-row:first-child { margin-top: 2px; }
.rk-label { display:flex; align-items:center; gap:8px; }
.rk-panel input[type=range] { width: 116px; accent-color: #b9c4a6; }
.rk-toggle { position: relative; width: 46px; height: 27px; border-radius: 14px; border: none;
  background: #4a4d47; cursor: pointer; transition: background .2s; flex: none; }
.rk-toggle.on { background: #7f9464; }
.rk-toggle span { position: absolute; top: 3px; left: 3px; width: 21px; height: 21px; border-radius: 11px;
  background: #eee; transition: transform .2s; }
.rk-toggle.on span { transform: translateX(19px); }
.rk-start { pointer-events: auto; position: fixed; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 18px; z-index: 20;
  background: radial-gradient(120% 90% at 50% 45%, rgba(24,28,26,0.30), rgba(12,14,13,0.86)); transition: opacity .5s; }
.rk-drop { width: 108px; height: 108px; border-radius: 60px; border: 2px solid rgba(232,228,214,0.75);
  animation: rkpulse 2.2s ease-out infinite; }
@keyframes rkpulse { 0% { transform: scale(0.82); opacity: .25 } 45% { opacity: .95 } 100% { transform: scale(1.25); opacity: 0 } }
.rk-hand { position:absolute; width:44px; height:44px; border-radius:24px; background: rgba(240,238,228,0.9);
  box-shadow: 0 0 0 8px rgba(240,238,228,0.18); }
.rk-fade { position: fixed; inset: 0; background: #0b0d0c; opacity: 0; pointer-events: none;
  transition: opacity .35s; z-index: 15; }
`

const ICON_GEAR = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.6v2.6M12 18.8v2.6M21.4 12h-2.6M5.2 12H2.6M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8M18.6 18.6l-1.8-1.8M7.2 7.2L5.4 5.4"/></svg>`
const ICON_SECTION = `<svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 9h22"/><path d="M4 9v13h18V9"/><ellipse cx="9" cy="15" rx="3.1" ry="2.3"/><ellipse cx="16.5" cy="15.6" rx="2.7" ry="2"/><path d="M12.1 15.2h1.7"/></svg>`
const ICON_SOUND = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9.5a3.6 3.6 0 0 1 0 5"/></svg>`
const ICON_CALM = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/></svg>`
const ICON_PERF = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4.5-5"/></svg>`

export class UI {
  root = document.createElement('div')
  private panel = document.createElement('div')
  private replayBtn = document.createElement('button')
  private startOverlay: HTMLDivElement | null = null
  private fade = document.createElement('div')

  constructor(private game: Game, settings: Settings, audio: GameAudio, onStart: () => void) {
    const style = document.createElement('style')
    style.textContent = css
    document.head.appendChild(style)

    this.root.className = 'rk-ui'
    document.body.appendChild(this.root)
    document.body.appendChild(this.fade)
    this.fade.className = 'rk-fade'

    const gear = document.createElement('button')
    gear.className = 'rk-btn rk-gear'
    gear.innerHTML = ICON_GEAR
    gear.setAttribute('aria-label', 'せってい')
    gear.onclick = () => this.panel.classList.toggle('open')
    this.root.appendChild(gear)

    this.panel.className = 'rk-panel'
    this.panel.innerHTML = `
      <div class="rk-row"><span class="rk-label">${ICON_SOUND} おと</span>
        <input id="rk-vol" type="range" min="0" max="100" step="1"></div>
      <div class="rk-row"><span class="rk-label">${ICON_CALM} ひかえめ</span>
        <button class="rk-toggle" id="rk-calm"><span></span></button></div>
      <div class="rk-row"><span class="rk-label">${ICON_PERF} かるく</span>
        <button class="rk-toggle" id="rk-low"><span></span></button></div>`
    this.root.appendChild(this.panel)

    const vol = this.panel.querySelector('#rk-vol') as HTMLInputElement
    vol.value = String(Math.round(settings.data.volume * 100))
    vol.oninput = () => {
      const v = Number(vol.value) / 100
      settings.set('volume', v)
      audio.setVolume(v)
    }
    const calm = this.panel.querySelector('#rk-calm') as HTMLButtonElement
    const low = this.panel.querySelector('#rk-low') as HTMLButtonElement
    const sync = () => {
      calm.classList.toggle('on', settings.data.calmVisuals)
      low.classList.toggle('on', settings.data.quality === 'low')
    }
    calm.onclick = () => {
      settings.set('calmVisuals', !settings.data.calmVisuals)
      sync()
    }
    low.onclick = () => {
      settings.set('quality', settings.data.quality === 'low' ? 'auto' : 'low')
      sync()
    }
    sync()

    this.replayBtn.className = 'rk-btn rk-replay'
    this.replayBtn.innerHTML = ICON_SECTION
    this.replayBtn.setAttribute('aria-label', 'もういちど みる')
    this.replayBtn.onclick = () => {
      if (this.game.replaying) this.game.stopReplay()
      else this.game.startReplay()
    }
    this.root.appendChild(this.replayBtn)

    // first tap: unlocks audio and starts the morning
    const start = document.createElement('div')
    start.className = 'rk-start'
    start.innerHTML = `<div class="rk-drop"></div>`
    start.onpointerdown = (e) => {
      e.preventDefault()
      start.style.opacity = '0'
      setTimeout(() => start.remove(), 520)
      this.startOverlay = null
      void audio.start().then(() => audio.setVolume(settings.data.volume))
      onStart()
    }
    document.body.appendChild(start)
    this.startOverlay = start

    document.addEventListener('pointerdown', (e) => {
      if (!this.panel.contains(e.target as Node) && e.target !== gear && !gear.contains(e.target as Node)) {
        this.panel.classList.remove('open')
      }
    })
  }

  get started() {
    return this.startOverlay === null
  }

  update() {
    this.replayBtn.classList.toggle('on', this.game.canReplay)
    this.replayBtn.style.pointerEvents = this.game.canReplay ? 'auto' : 'none'
    this.fade.style.opacity = this.game.replaying ? '0' : '0'
  }
}
