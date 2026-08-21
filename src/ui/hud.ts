/**
 * 画面まわり。クレーン操作とカメラ操作を同じ gesture に割り当てない。
 * 1 つの gesture に 1 つの機械動作。
 */
import * as THREE from 'three'
import { CHUTE_VARIANTS, ROLLER_START_S, SITE, chuteCenter, type ChuteVariant } from '../build/layout'
import { clamp } from '../core/rng'

export type HotspotKind = 'turn' | 'push' | 'swipe'

export interface HotspotSpec {
  id: string
  world: THREE.Vector3
  kind: HotspotKind
  progress: number
  done: boolean
}

interface HotspotEl {
  el: HTMLDivElement
  ring: HTMLDivElement
  glyph: HTMLDivElement
  spec: HotspotSpec
  lastAngle: number | null
  startY: number | null
  startX: number | null
  active: boolean
}

const GLYPH: Record<HotspotKind, string> = { turn: '↻', push: '⇢', swipe: '➜' }

export class Hud {
  readonly root: HTMLDivElement
  private titleEl: HTMLDivElement
  private hintEl: HTMLDivElement
  private dotsEl: HTMLDivElement
  private pendant: HTMLDivElement
  private knob: HTMLDivElement
  private rotary: HTMLDivElement
  private rotaryGrip: HTMLDivElement
  private hotLayer: HTMLDivElement
  private toastEl: HTMLDivElement
  private dirL: HTMLDivElement
  private dirR: HTMLDivElement
  private screen: HTMLDivElement
  private badge: HTMLDivElement

  /** -1..1。ペンダントの上下レバー */
  hoist = 0
  /** 画面の横スワイプ量（px、累積）。旋回に使う */
  swipeDx = 0
  swipeActive = false
  /** 回転ハンドルの角度変化（rad、累積） */
  yawDelta = 0
  /** ボルト・ピン・スワイプの進捗を通知 */
  onHotspotProgress: ((id: string, delta: number) => void) | null = null
  onHotspotSwipe: ((id: string) => void) | null = null
  onTapAdvance: (() => void) | null = null

  private hotspots = new Map<string, HotspotEl>()
  private toastTimer = 0

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'layer'
    parent.appendChild(this.root)

    const top = el('div', 'topbar')
    this.titleEl = el('div', 'step-title')
    this.hintEl = el('div', 'step-hint')
    this.dotsEl = el('div', 'dots')
    top.append(this.titleEl, this.hintEl, this.dotsEl)
    this.root.appendChild(top)

    this.badge = el('div', 'badge')
    this.root.appendChild(this.badge)

    this.pendant = el('div', 'pendant')
    const cable = el('div', 'cable')
    const cap = el('div', 'caption')
    cap.textContent = 'まきあげ'
    const track = el('div', 'track')
    this.knob = el('div', 'knob')
    track.appendChild(this.knob)
    this.pendant.append(cable, cap, track)
    this.root.appendChild(this.pendant)
    this.bindPendant(track)

    this.rotary = el('div', 'rotary')
    const face = el('div', 'face')
    this.rotaryGrip = el('div', 'grip')
    const rl = el('div', 'label')
    rl.textContent = 'むき'
    this.rotary.append(face, this.rotaryGrip, rl)
    this.root.appendChild(this.rotary)
    this.bindRotary()

    this.dirL = el('div', 'dirhint left')
    this.dirL.textContent = '◀'
    this.dirL.style.setProperty('--dx', '-10px')
    this.dirR = el('div', 'dirhint right')
    this.dirR.textContent = '▶'
    this.root.append(this.dirL, this.dirR)

    this.hotLayer = el('div', 'layer')
    this.root.appendChild(this.hotLayer)

    this.toastEl = el('div', 'toast')
    this.root.appendChild(this.toastEl)

    this.screen = el('div', 'screen hidden')
    this.root.appendChild(this.screen)
  }

  // -------------------------------------------------------- ペンダント
  private bindPendant(track: HTMLDivElement) {
    let id: number | null = null
    let rect: DOMRect | null = null
    const set = (clientY: number) => {
      if (!rect) return
      const center = rect.top + rect.height / 2
      const v = clamp((center - clientY) / (rect.height / 2 - 26), -1, 1)
      this.hoist = Math.abs(v) < 0.12 ? 0 : v
      this.knob.style.transform = `translateY(${-this.hoist * (rect.height / 2 - 34)}px)`
    }
    track.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      id = e.pointerId
      track.setPointerCapture(id)
      rect = track.getBoundingClientRect()
      set(e.clientY)
    })
    track.addEventListener('pointermove', (e) => {
      if (id !== e.pointerId) return
      set(e.clientY)
    })
    const release = (e: PointerEvent) => {
      if (id !== e.pointerId) return
      id = null
      this.hoist = 0
      this.knob.style.transform = 'translateY(0px)'
    }
    track.addEventListener('pointerup', release)
    track.addEventListener('pointercancel', release)
  }

  // -------------------------------------------------------- 回転ハンドル
  private bindRotary() {
    let id: number | null = null
    let last = 0
    const angleOf = (e: PointerEvent) => {
      const r = this.rotary.getBoundingClientRect()
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2))
    }
    this.rotary.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      id = e.pointerId
      this.rotary.setPointerCapture(id)
      last = angleOf(e)
    })
    this.rotary.addEventListener('pointermove', (e) => {
      if (id !== e.pointerId) return
      const a = angleOf(e)
      let d = a - last
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      // 機械の回転速度には上限がある。指の速さを溜め込みすぎない。
      this.yawDelta = Math.max(-0.6, Math.min(0.6, this.yawDelta + d))
      this.gripAngle += d
      this.rotaryGrip.style.transform = `rotate(${this.gripAngle}rad) translateY(0)`
      this.rotary.style.setProperty('transform', 'none')
      this.rotaryGrip.style.left = `${50 + Math.sin(this.gripAngle) * 42}%`
      this.rotaryGrip.style.top = `${50 - Math.cos(this.gripAngle) * 42}%`
      this.rotaryGrip.style.marginTop = '-13px'
      last = a
    })
    const rel = (e: PointerEvent) => {
      if (id !== e.pointerId) return
      id = null
    }
    this.rotary.addEventListener('pointerup', rel)
    this.rotary.addEventListener('pointercancel', rel)
  }
  private gripAngle = 0

  /** 3D キャンバス上の横スワイプ（旋回）とタップ送りを拾う */
  bindCanvas(canvas: HTMLCanvasElement) {
    let id: number | null = null
    let startX = 0
    let startY = 0
    let moved = 0
    canvas.addEventListener('pointerdown', (e) => {
      id = e.pointerId
      startX = e.clientX
      startY = e.clientY
      moved = 0
      this.swipeDx = 0
      this.swipeActive = true
    })
    canvas.addEventListener('pointermove', (e) => {
      if (id !== e.pointerId) return
      this.swipeDx = e.clientX - startX
      moved = Math.max(moved, Math.hypot(e.clientX - startX, e.clientY - startY))
    })
    const end = (e: PointerEvent) => {
      if (id !== e.pointerId) return
      id = null
      this.swipeActive = false
      this.swipeDx = 0
      if (moved < 12 && this.onTapAdvance) this.onTapAdvance()
    }
    canvas.addEventListener('pointerup', end)
    canvas.addEventListener('pointercancel', end)
  }

  // -------------------------------------------------------- 表示更新
  setStep(title: string, hint: string, index: number, total: number) {
    this.titleEl.textContent = title
    this.hintEl.textContent = hint
    this.dotsEl.replaceChildren()
    for (let i = 0; i < total; i++) {
      const d = document.createElement('i')
      if (i < index) d.className = 'done'
      else if (i === index) d.className = 'now'
      this.dotsEl.appendChild(d)
    }
  }

  setBadge(text: string) {
    this.badge.textContent = text
  }

  /** enabled: 触れるか（工程が違えば無効）／active: いま動かせるか（玉掛け中は待ち） */
  showPendant(enabled: boolean, hint = false, active = true) {
    this.pendant.classList.toggle('faded', !enabled)
    this.pendant.classList.toggle('dim', enabled && !active)
    this.pendant.classList.toggle('hint', hint && enabled && active)
  }

  showRotary(enabled: boolean, aligned = false, active = true) {
    this.rotary.classList.toggle('faded', !enabled)
    this.rotary.classList.toggle('dim', enabled && !active)
    this.rotary.classList.toggle('aligned', aligned && enabled)
  }

  showDirHint(dir: -1 | 0 | 1) {
    this.dirL.classList.toggle('on', dir < 0)
    this.dirR.classList.toggle('on', dir > 0)
  }

  toast(text: string, seconds = 2.2) {
    this.toastEl.textContent = text
    this.toastEl.classList.add('on')
    this.toastTimer = seconds
  }

  // -------------------------------------------------------- ホットスポット
  setHotspots(specs: HotspotSpec[]) {
    const seen = new Set(specs.map((s) => s.id))
    for (const [id, h] of this.hotspots) {
      if (!seen.has(id)) {
        h.el.remove()
        this.hotspots.delete(id)
      }
    }
    for (const spec of specs) {
      let h = this.hotspots.get(spec.id)
      if (!h) h = this.createHotspot(spec)
      h.spec = spec
      h.glyph.textContent = GLYPH[spec.kind]
      h.ring.style.setProperty('--p', String(Math.round(spec.progress * 100)))
      h.el.classList.toggle('done', spec.done)
    }
  }

  private createHotspot(spec: HotspotSpec): HotspotEl {
    const div = el('div', 'hotspot')
    const ring = el('div', 'ring')
    const glyph = el('div', 'glyph')
    div.append(ring, glyph)
    this.hotLayer.appendChild(div)
    const h: HotspotEl = { el: div, ring, glyph, spec, lastAngle: null, startY: null, startX: null, active: false }
    this.hotspots.set(spec.id, h)

    let pid: number | null = null
    div.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      pid = e.pointerId
      div.setPointerCapture(pid)
      h.active = true
      const r = div.getBoundingClientRect()
      h.lastAngle = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2))
      h.startY = e.clientY
      h.startX = e.clientX
    })
    div.addEventListener('pointermove', (e) => {
      if (pid !== e.pointerId || !h.active) return
      e.stopPropagation()
      const r = div.getBoundingClientRect()
      if (h.spec.kind === 'turn') {
        const a = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2))
        let d = a - (h.lastAngle ?? a)
        while (d > Math.PI) d -= Math.PI * 2
        while (d < -Math.PI) d += Math.PI * 2
        h.lastAngle = a
        this.onHotspotProgress?.(h.spec.id, Math.abs(d) / (Math.PI * 2))
      } else if (h.spec.kind === 'push') {
        // ピンは「押し込む」。方向を問わず指の移動量で進める（4歳児でも止まらない）
        const dx = e.clientX - (h.startX ?? e.clientX)
        const dy = e.clientY - (h.startY ?? e.clientY)
        const d = Math.hypot(dx, dy)
        if (d > 0) {
          h.startX = e.clientX
          h.startY = e.clientY
          this.onHotspotProgress?.(h.spec.id, d / 170)
        }
      } else {
        const d = Math.hypot(e.clientX - (h.startX ?? 0), e.clientY - (h.startY ?? 0))
        if (d > 42) {
          h.active = false
          this.onHotspotSwipe?.(h.spec.id)
        }
      }
    })
    const rel = (e: PointerEvent) => {
      if (pid !== e.pointerId) return
      pid = null
      h.active = false
      h.lastAngle = null
    }
    div.addEventListener('pointerup', rel)
    div.addEventListener('pointercancel', rel)
    return h
  }

  projectHotspots(camera: THREE.PerspectiveCamera, w: number, h: number) {
    const v = new THREE.Vector3()
    for (const hs of this.hotspots.values()) {
      v.copy(hs.spec.world).project(camera)
      const visible = v.z < 1
      hs.el.style.display = visible ? '' : 'none'
      hs.el.style.left = `${((v.x + 1) / 2) * w}px`
      hs.el.style.top = `${((1 - v.y) / 2) * h}px`
    }
  }

  tick(dt: number) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt
      if (this.toastTimer <= 0) this.toastEl.classList.remove('on')
    }
  }

  // -------------------------------------------------------- 全画面パネル
  /** テストやプログラムからパネルを閉じる */
  hideScreen() {
    this.closeScreen()
  }

  private closeScreen() {
    this.screen.classList.add('hidden')
    this.screen.replaceChildren()
  }

  showStart(onStart: () => void) {
    const card = el('div', 'card')
    const h = document.createElement('h1')
    h.textContent = 'こうえんの　こうじげんば'
    const p = document.createElement('p')
    p.textContent = 'クレーンの　ペンダントを　つかって、はこばれてきた ぶひんを くみたてよう。'
    const b = document.createElement('button')
    b.className = 'btn'
    b.textContent = 'はじめる'
    b.addEventListener('click', () => {
      this.closeScreen()
      onStart()
    })
    card.append(h, p, b)
    this.screen.replaceChildren(card)
    this.screen.classList.remove('hidden')
  }

  showChooser(current: ChuteVariant, onPick: (v: ChuteVariant) => void) {
    const card = el('div', 'card')
    const h = document.createElement('h1')
    h.textContent = 'さいごの　すべるところ'
    const p = document.createElement('p')
    p.textContent = 'ささえる　はしらと　つなぎかたは　おなじ。さいごの　いちくかんだけ　かえられる。'
    const grid = el('div', 'choices')
    let picked: ChuteVariant = current
    const buttons: HTMLButtonElement[] = []
    for (const v of CHUTE_VARIANTS) {
      const b = document.createElement('button')
      b.className = 'choice' + (v.id === current ? ' sel' : '')
      b.innerHTML = variantSvg(v.id)
      const name = document.createElement('b')
      name.textContent = v.name
      const note = document.createElement('span')
      note.textContent = v.note
      b.append(name, note)
      b.addEventListener('click', () => {
        picked = v.id
        buttons.forEach((x) => x.classList.remove('sel'))
        b.classList.add('sel')
      })
      buttons.push(b)
      grid.appendChild(b)
    }
    const go = document.createElement('button')
    go.className = 'btn'
    go.textContent = 'これで　つくる'
    go.addEventListener('click', () => {
      this.closeScreen()
      onPick(picked)
    })
    card.append(h, p, grid, go)
    this.screen.replaceChildren(card)
    this.screen.classList.remove('hidden')
  }

  showFinish(title: string, body: string, actions: Array<{ label: string; ghost?: boolean; run: () => void }>) {
    const card = el('div', 'card')
    const h = document.createElement('h1')
    h.textContent = title
    const p = document.createElement('p')
    p.textContent = body
    card.append(h, p)
    for (const a of actions) {
      const b = document.createElement('button')
      b.className = 'btn' + (a.ghost ? ' ghost' : '')
      b.style.margin = '4px'
      b.textContent = a.label
      b.addEventListener('click', () => {
        this.closeScreen()
        a.run()
      })
      card.appendChild(b)
    }
    this.screen.replaceChildren(card)
    this.screen.classList.remove('hidden')
  }

  get screenOpen(): boolean {
    return !this.screen.classList.contains('hidden')
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  e.className = cls
  return e
}

/** 選択カードの断面プレビュー。実際の滑走面の中心線をそのまま描く。 */
function variantSvg(v: ChuteVariant): string {
  const pts: string[] = []
  const n = 40
  for (let i = 0; i <= n; i++) {
    const s = i / n
    const c = chuteCenter(s, v)
    const base = chuteCenter(s, 'straight')
    // 4歳児にも違いが分かるよう、まっすぐとの差だけ誇張して描く（模式図）
    const y = base.y + (c.y - base.y) * 2.4
    pts.push(`${(6 + s * 88).toFixed(1)},${(8 + (-y / SITE.chuteDrop) * 38).toFixed(1)}`)
  }
  const line = `<polyline points="${pts.join(' ')}" fill="none" stroke="#f2c33c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`
  let extra = ''
  if (v === 'roller') {
    for (let i = 0; i < 8; i++) {
      const s = ROLLER_START_S + (i / 8) * (1 - ROLLER_START_S)
      const c = chuteCenter(s, v)
      extra += `<circle cx="${(6 + s * 88).toFixed(1)}" cy="${(8 + (-c.y / SITE.chuteDrop) * 38 + 4.5).toFixed(1)}" r="2.8" fill="#cdd3d6"/>`
    }
  }
  return `<svg viewBox="0 0 100 54" aria-hidden="true">${line}${extra}</svg>`
}
