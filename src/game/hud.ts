/* ------------------------------------------------------------------ *
 * 2D overlay.  Everything a four-year-old needs is carried by the
 * pictogram; the Japanese caption is there for whoever is sitting next
 * to them.
 * ------------------------------------------------------------------ */

export type ActionKind = 'lower' | 'auger' | 'unload' | 'again' | null

const ICONS: Record<string, string> = {
  lower: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <g fill="#3d2a10">
      <ellipse cx="14" cy="46" rx="4.6" ry="8.5" transform="rotate(-14 14 46)"/>
      <ellipse cx="32" cy="43" rx="4.6" ry="9"/>
      <ellipse cx="50" cy="46" rx="4.6" ry="8.5" transform="rotate(14 50 46)"/>
    </g>
    <g stroke="#3d2a10" stroke-width="3.4" stroke-linecap="round" fill="none">
      <path d="M14 58V50"/><path d="M32 58V50"/><path d="M50 58V50"/>
    </g>
    <path d="M8 27h48" stroke="#3d2a10" stroke-width="7.5" stroke-linecap="round"/>
    <path d="M32 4v12" stroke="#3d2a10" stroke-width="6" stroke-linecap="round"/>
    <path d="M23 12l9 9 9-9" stroke="#3d2a10" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`,
  auger: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="4" y="30" width="20" height="24" rx="4" fill="#3d2a10"/>
    <rect x="10" y="22" width="9" height="9" rx="2" fill="#3d2a10"/>
    <path d="M20 26h26" stroke="#3d2a10" stroke-width="8" stroke-linecap="round"/>
    <path d="M46 26v10" stroke="#3d2a10" stroke-width="8" stroke-linecap="round"/>
    <path d="M50 12h8M54 8v8" stroke="#3d2a10" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M36 45h22" stroke="#3d2a10" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M50 38l9 7-9 7" stroke="#3d2a10" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`,
  unload: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M6 12h26" stroke="#3d2a10" stroke-width="8" stroke-linecap="round"/>
    <path d="M32 12v8" stroke="#3d2a10" stroke-width="8" stroke-linecap="round"/>
    <g fill="#3d2a10">
      <ellipse cx="28" cy="27" rx="3" ry="4.4"/><ellipse cx="36" cy="30" rx="3" ry="4.4"/>
      <ellipse cx="30" cy="36" rx="3" ry="4.4"/><ellipse cx="37" cy="41" rx="3" ry="4.4"/>
      <ellipse cx="28" cy="45" rx="3" ry="4.4"/>
    </g>
    <path d="M12 42v14h40V42" stroke="#3d2a10" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M14 52h36" stroke="#3d2a10" stroke-width="5" stroke-linecap="round"/>
  </svg>`,
  again: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M52 32a20 20 0 1 1-6.2-14.4" stroke="#3d2a10" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M50 4v16H34" stroke="#3d2a10" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  rice: `<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="#ffe6a8">
    <ellipse cx="22" cy="26" rx="6" ry="10" transform="rotate(-20 22 26)"/>
    <ellipse cx="40" cy="22" rx="6" ry="10" transform="rotate(16 40 22)"/>
    <ellipse cx="32" cy="42" rx="6" ry="10"/></g></svg>`,
  cut: `<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="#ffe6a8">
    <path d="M6 46h52v8H6z"/><path d="M14 46V30M28 46V26M42 46V30M54 46V34" stroke="#ffe6a8" stroke-width="5" stroke-linecap="round"/></g></svg>`,
  tankFull: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="14" y="16" width="36" height="38" rx="5" fill="none" stroke="#ffe6a8" stroke-width="5"/>
    <rect x="19" y="26" width="26" height="23" rx="3" fill="#ffe6a8"/>
    <path d="M32 4v8M20 8l4 6M44 8l-4 6" stroke="#ffe6a8" stroke-width="4.5" stroke-linecap="round"/>
  </svg>`,
  truck: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M6 40V22h18v18z" fill="#ffe6a8"/><path d="M26 40V14h26v26z" fill="#ffe6a8"/>
    <circle cx="16" cy="47" r="6" fill="#ffe6a8"/><circle cx="44" cy="47" r="6" fill="#ffe6a8"/>
  </svg>`,
  done: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M10 34l14 14 30-32" stroke="#ffe6a8" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  chevron: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M40 8L16 32l24 24" stroke="#fff2cf" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  hand: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M26 44V14a5 5 0 0 1 10 0v18" stroke="#ffeec4" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M36 32a5 5 0 0 1 10 0v14a14 14 0 0 1-14 14h-4a12 12 0 0 1-9-4l-9-11 4-4 8 5" stroke="#ffeec4" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  soundOn: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M19 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`,
  soundOff: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`,
}

const CAPTIONS: Record<string, string> = {
  lower: 'ヘッダを さげる',
  auger: 'パイプを のばす',
  unload: 'おこめを だす！',
  again: 'もういちど',
}

export class Hud {
  private root: HTMLElement
  private gauge!: HTMLElement
  private gaugeFill!: HTMLElement
  private progress!: HTMLElement
  private progressCnt!: HTMLElement
  private actions!: HTMLElement
  private banner!: HTMLElement
  private steer!: HTMLElement
  private touchDot!: HTMLElement
  private finish!: HTMLElement
  private soundBtn!: HTMLButtonElement
  private chevL!: HTMLElement
  private chevR!: HTMLElement
  private current: ActionKind = null

  onAction: ((k: Exclude<ActionKind, null>) => void) | null = null
  onSound: ((on: boolean) => void) | null = null
  soundOn = true

  constructor(root: HTMLElement) {
    this.root = root
    this.build()
  }

  private build() {
    this.root.innerHTML = `
      <div class="panel" id="gauge">
        <div class="tank"><div class="fill"></div></div>
        <div class="lbl">おこめ<br>タンク</div>
      </div>
      <div class="panel" id="progress">
        <div class="cnt"><span class="pc">0%</span><small>たんぼ</small></div>
        <div class="ring"><i>${ICONS.cut}</i></div>
      </div>
      <button id="sound" aria-label="おと">${ICONS.soundOn}</button>
      <div id="banner"></div>
      <div class="chev l">${ICONS.chevron}</div>
      <div class="chev r" style="transform: scaleX(-1)">${ICONS.chevron}</div>
      <div id="steer"><div class="hint">${ICONS.hand}<span class="arrow">← ゆびで すすむむき →</span></div></div>
      <div id="touchdot"></div>
      <div id="actions"></div>
      <div id="finish"><div class="card">
        <h2>ぜんぶ かれた！</h2>
        <div class="rice-row"></div>
        <div class="sub"></div>
        <div class="again"></div>
      </div></div>`

    this.gauge = this.root.querySelector('#gauge')!
    this.gaugeFill = this.root.querySelector('#gauge .fill')!
    this.progress = this.root.querySelector('#progress')!
    this.progressCnt = this.root.querySelector('#progress .pc')!
    this.actions = this.root.querySelector('#actions')!
    this.banner = this.root.querySelector('#banner')!
    this.steer = this.root.querySelector('#steer')!
    this.touchDot = this.root.querySelector('#touchdot')!
    this.finish = this.root.querySelector('#finish')!
    this.soundBtn = this.root.querySelector('#sound')!
    this.chevL = this.root.querySelector('.chev.l')!
    this.chevR = this.root.querySelector('.chev.r')!

    this.soundBtn.addEventListener('click', () => {
      this.soundOn = !this.soundOn
      this.soundBtn.classList.toggle('off', !this.soundOn)
      this.soundBtn.innerHTML = this.soundOn ? ICONS.soundOn : ICONS.soundOff
      this.onSound?.(this.soundOn)
    })
    // the ring uses an svg icon; keep the progress element around for the var
    this.progress.style.setProperty('--p', '0')
  }

  setTank(f: number) {
    this.gaugeFill.style.height = `${Math.round(Math.max(0, Math.min(1, f)) * 100)}%`
    this.gauge.classList.toggle('full', f >= 0.999)
  }

  setProgress(p: number) {
    const pc = Math.round(Math.max(0, Math.min(1, p)) * 100)
    this.progress.style.setProperty('--p', String(pc))
    this.progressCnt.textContent = `${pc}%`
  }

  setAction(kind: ActionKind, pulse = true) {
    if (kind === this.current) return
    this.current = kind
    this.actions.innerHTML = ''
    if (!kind) return
    const btn = document.createElement('button')
    btn.className = `act ${pulse ? 'pulse ' : ''}${kind === 'unload' ? 'pour' : kind === 'lower' ? 'go' : ''}`
    btn.setAttribute('aria-label', CAPTIONS[kind])
    btn.innerHTML = `<span class="disc">${ICONS[kind]}</span><span class="cap">${CAPTIONS[kind]}</span>`
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.onAction?.(kind)
    })
    this.actions.appendChild(btn)
  }

  showBanner(icon: keyof typeof ICONS, text: string) {
    this.banner.innerHTML = `${ICONS[icon] ?? ''}<span>${text}</span>`
    this.banner.classList.remove('show')
    void this.banner.offsetWidth
    this.banner.classList.add('show')
  }

  setSteerHint(on: boolean) {
    this.steer.classList.toggle('show', on)
    this.chevL.classList.toggle('on', on)
    this.chevR.classList.toggle('on', on)
    if (!on) {
      this.chevL.classList.remove('lit')
      this.chevR.classList.remove('lit')
    }
  }

  /** -1..1 — lights the arrow on the side the machine is leaning towards */
  setSteer(v: number) {
    this.chevL.classList.toggle('lit', v < -0.12)
    this.chevR.classList.toggle('lit', v > 0.12)
  }

  setTouch(active: boolean, x: number, y: number) {
    this.touchDot.classList.toggle('on', active)
    if (active) {
      this.touchDot.style.left = `${x}px`
      this.touchDot.style.top = `${y}px`
    }
  }

  showFinish(loads: number, grains: number) {
    const row = this.finish.querySelector('.rice-row')!
    row.innerHTML = ''
    const n = Math.max(1, Math.min(12, loads))
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span')
      s.textContent = '🍚'
      s.style.animationDelay = `${0.35 + i * 0.11}s`
      row.appendChild(s)
    }
    this.finish.querySelector('.sub')!.textContent = `おこめを ${loads}かい はこびました（${grains.toLocaleString('ja-JP')}つぶ）`
    const again = this.finish.querySelector('.again')! as HTMLElement
    again.innerHTML = ''
    const btn = document.createElement('button')
    btn.className = 'act pulse'
    btn.setAttribute('aria-label', CAPTIONS.again)
    btn.innerHTML = `<span class="disc">${ICONS.again}</span><span class="cap">${CAPTIONS.again}</span>`
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.onAction?.('again')
    })
    again.appendChild(btn)
    this.finish.classList.add('show')
  }

  hideFinish() {
    this.finish.classList.remove('show')
  }
}
