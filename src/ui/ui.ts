export type HintKind = 'up' | 'hold' | 'side' | 'pull' | 'tap'

interface HintEl {
  el: HTMLDivElement
  kind: HintKind | null
}

const GLYPHS: Record<HintKind, string> = {
  up: `<g class="glyph"><circle class="dot" cx="46" cy="52" r="11"/><path class="trail" d="M46 44 L46 20"/><path class="trail" d="M38 28 L46 18 L54 28"/></g>`,
  hold: `<g class="glyph"><circle class="ring" cx="46" cy="46" r="19"/><circle class="dot" cx="46" cy="46" r="11"/></g>`,
  side: `<g class="glyph"><circle class="dot" cx="46" cy="46" r="11"/><path class="trail" d="M20 46 L72 46"/></g>`,
  pull: `<g class="glyph"><circle class="dot" cx="46" cy="34" r="11"/><path class="trail" d="M46 44 L46 70"/><path class="trail" d="M38 62 L46 72 L54 62"/></g>`,
  tap: `<g class="glyph"><circle class="ring" cx="46" cy="46" r="17"/><circle class="dot" cx="46" cy="46" r="9"/></g>`,
}

/**
 * Every prompt in the game is a gesture drawn on screen. There is no text and
 * no arrow pointing at the machinery: the player is four, and the whole point
 * is that the cause is discovered rather than announced.
 */
export class UI {
  private readonly root: HTMLElement
  private readonly hints: HintEl[] = []
  private readonly fadeEl: HTMLDivElement
  private readonly boot: HTMLElement | null
  private readonly bootBar: HTMLElement | null
  private startBtn: HTMLButtonElement | null = null

  constructor(root: HTMLElement) {
    this.root = root

    const vignette = document.createElement('div')
    vignette.className = 'vignette'
    root.appendChild(vignette)

    for (let i = 0; i < 3; i++) {
      const el = document.createElement('div')
      el.className = 'hint'
      el.innerHTML = `<svg viewBox="0 0 92 92"><circle class="ring pulse" cx="46" cy="46" r="20"/></svg>`
      root.appendChild(el)
      this.hints.push({ el, kind: null })
    }

    this.fadeEl = document.createElement('div')
    this.fadeEl.className = 'fade'
    root.appendChild(this.fadeEl)

    this.boot = document.getElementById('boot')
    this.bootBar = document.getElementById('boot-bar-fill')
  }

  setLoadProgress(p: number): void {
    if (this.bootBar) this.bootBar.style.width = `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`
  }

  /** Shows the single wordless start affordance; resolves on the first tap. */
  waitForStart(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.boot) {
        resolve()
        return
      }
      const btn = document.createElement('button')
      btn.className = 'start'
      btn.type = 'button'
      btn.setAttribute('aria-label', 'start')
      btn.innerHTML = `<svg viewBox="0 0 132 132">
        <circle class="ring pulse" cx="66" cy="66" r="40"/>
        <circle class="ring" cx="66" cy="66" r="40"/>
        <path class="tri" d="M56 48 L88 66 L56 84 Z"/>
      </svg>`
      this.boot.appendChild(btn)
      this.startBtn = btn
      requestAnimationFrame(() => btn.classList.add('on'))
      const go = (e: Event): void => {
        e.preventDefault()
        btn.removeEventListener('pointerup', go)
        resolve()
      }
      btn.addEventListener('pointerup', go, { passive: false })
    })
  }

  dismissBoot(): void {
    this.startBtn?.classList.remove('on')
    this.boot?.classList.add('gone')
    window.setTimeout(() => this.boot?.remove(), 900)
  }

  /** `x` and `y` are 0..1 screen coordinates from the top-left. */
  showHint(slot: number, kind: HintKind, x: number, y: number): void {
    const h = this.hints[slot]
    if (!h) return
    if (h.kind !== kind) {
      h.kind = kind
      h.el.className = `hint ${kind}`
      h.el.innerHTML = `<svg viewBox="0 0 92 92"><circle class="ring pulse" cx="46" cy="46" r="20"/>${GLYPHS[kind]}</svg>`
      // Restart the entry transition on the next frame so the fade is visible.
      requestAnimationFrame(() => h.el.classList.add('on'))
    }
    const w = this.root.clientWidth
    const ht = this.root.clientHeight
    // Keep the prompt clear of the very edges, where a thumb usually rests.
    const cx = Math.min(0.9, Math.max(0.1, x)) * w
    const cy = Math.min(0.88, Math.max(0.12, y)) * ht
    h.el.style.transform = `translate(${cx}px, ${cy}px)`
  }

  hideHint(slot: number): void {
    const h = this.hints[slot]
    if (!h || h.kind === null) return
    h.kind = null
    h.el.classList.remove('on')
  }

  hideAllHints(): void {
    for (let i = 0; i < this.hints.length; i++) this.hideHint(i)
  }

  setFade(on: boolean): void {
    this.fadeEl.classList.toggle('on', on)
  }
}
