import type { Input, UnitPt } from '../core/gestures'
import type { Flavor } from '../core/flavors'

const ICONS: Record<string, string> = {
  fold: '<path d="M12 42c0-16 12-26 22-26s18 8 18 16" /><path d="M46 24l6 8 8-6" /><path d="M10 48c10 6 32 6 44 0" />',
  pour: '<path d="M10 22c0 12 8 20 18 20h6" /><path d="M8 20h26" /><path d="M36 30c4 6 6 12 6 18" /><path d="M30 52h26v6H30z" />',
  oven: '<path d="M14 20h36v28H14z" /><path d="M14 28h36" /><path d="M6 40l14-10 14 10" />',
  flip: '<path d="M8 40a24 24 0 0 1 48 0" /><path d="M4 34l4 8 8-4" /><path d="M60 34l-4 8-8-4" /><path d="M22 48h20" />',
  mount: '<path d="M32 8v22" /><path d="M24 24l8 8 8-8" /><path d="M22 38h20v6H22z" /><path d="M28 44h8v14h-8z" />',
  cool: '<path d="M20 46c-4-6 4-10 0-16s4-10 0-16" /><path d="M32 48c-4-6 4-10 0-16s4-10 0-16" /><path d="M44 46c-4-6 4-10 0-16s4-10 0-16" />',
  loosen: '<path d="M52 32a20 20 0 1 1-8-16" /><path d="M46 6l-2 12 12-2" /><path d="M32 22v20" />',
  lift: '<path d="M32 54V14" /><path d="M20 26l12-12 12 12" /><path d="M14 56h36" />',
  press: '<path d="M32 10v22" /><path d="M22 26l10 10 10-10" /><path d="M12 46c8 6 32 6 40 0" />',
  wait: '<circle cx="32" cy="32" r="20" /><path d="M32 20v14l10 6" />',
}

export class Hud {
  private guide = document.getElementById('guide') as unknown as SVGSVGElement
  private track = document.getElementById('guide-track') as unknown as SVGPathElement
  private fill = document.getElementById('guide-fill') as unknown as SVGPathElement
  private dot = document.getElementById('guide-dot') as unknown as SVGCircleElement
  private arrow = document.getElementById('guide-arrow') as unknown as SVGPolygonElement
  private verb = document.getElementById('verb') as HTMLElement
  private verbIcon = document.getElementById('verb-icon') as unknown as SVGSVGElement
  private verbLabel = document.getElementById('verb-label') as HTMLElement
  private finish = document.getElementById('finish') as HTMLElement
  private flavorBox = document.getElementById('flavors') as HTMLElement
  private loading = document.getElementById('loading') as HTMLElement
  private btnSound = document.getElementById('btn-sound') as HTMLButtonElement
  private btnRestart = document.getElementById('btn-restart') as HTMLButtonElement
  private btnAgain = document.getElementById('btn-again') as HTMLButtonElement

  private points: UnitPt[] = []
  private isTap = false
  private strokeW = 18
  private pathLen = 0

  onSound?: (muted: boolean) => void
  onRestart?: () => void
  onFlavor?: (f: Flavor) => void
  onAgain?: () => void

  constructor(private input: Input) {
    let muted = false
    this.btnSound.addEventListener('click', () => {
      muted = !muted
      this.btnSound.textContent = muted ? '🔇' : '🔊'
      this.btnSound.classList.toggle('off', muted)
      this.onSound?.(muted)
    })
    this.btnRestart.addEventListener('click', () => this.onRestart?.())
    this.btnAgain.addEventListener('click', () => this.onAgain?.())
  }

  setLoaded() {
    this.loading.classList.add('gone')
  }

  setVerb(key: keyof typeof ICONS | null, label = '') {
    if (!key) {
      this.verb.classList.remove('on')
      return
    }
    this.verbIcon.innerHTML = `<g fill="none" stroke="#8a5a2b" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[key] ?? ''}</g>`
    this.verbLabel.textContent = label
    this.verb.classList.add('on')
  }

  /** Draw the ghost trajectory the finger should follow. */
  showGuide(points: UnitPt[], opts: { faint?: boolean; tap?: boolean; width?: number } = {}) {
    this.points = points
    this.isTap = !!opts.tap
    this.strokeW = opts.width ?? (opts.tap ? 6 : 18)
    this.guide.classList.toggle('faint', !!opts.faint)
    this.guide.classList.toggle('tap', this.isTap)
    this.arrow.setAttribute('opacity', this.isTap ? '0' : '0.95')
    this.guide.classList.add('on')
    this.layout()
    this.setProgress(0)
  }

  hideGuide() {
    this.guide.classList.remove('on')
    this.arrow.setAttribute('opacity', '0')
    this.points = []
  }

  /** Recompute pixel geometry after a resize / orientation change. */
  layout() {
    if (!this.points.length) return
    const vp = this.input.vp
    this.guide.setAttribute('viewBox', `0 0 ${vp.w} ${vp.h}`)
    this.guide.setAttribute('width', String(vp.w))
    this.guide.setAttribute('height', String(vp.h))
    const px = this.points.map((p) => this.input.toPx(p))
    const d = px.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    const w = (this.strokeW * vp.scale) / 320
    this.track.setAttribute('d', d)
    this.fill.setAttribute('d', d)
    this.track.style.strokeWidth = `${Math.max(6, w * 1.05)}px`
    this.track.style.strokeDasharray = this.isTap ? 'none' : `${Math.max(3, w * 0.16)} ${Math.max(10, w * 0.95)}`
    this.fill.style.strokeWidth = `${Math.max(6, w)}px`
    this.dot.setAttribute('r', String(Math.max(9, w * 0.44)))
    this.pathLen = this.fill.getTotalLength ? this.fill.getTotalLength() : 0
  }

  setProgress(p: number) {
    if (!this.points.length) return
    const len = this.pathLen
    if (!len) return
    const at = Math.max(0.0001, Math.min(1, p)) * len
    this.fill.style.strokeDasharray = `${at} ${len + 10}`
    const pt = this.fill.getPointAtLength(at)
    this.dot.setAttribute('cx', String(pt.x))
    this.dot.setAttribute('cy', String(pt.y))
    if (this.isTap || p > 0.985) {
      this.arrow.setAttribute('opacity', '0')
      return
    }
    const ahead = this.fill.getPointAtLength(Math.min(len, at + 6))
    const ang = (Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180) / Math.PI
    const s = Math.max(0.7, this.input.vp.scale / 300)
    this.arrow.setAttribute('opacity', '0.95')
    this.arrow.setAttribute('transform', `translate(${pt.x} ${pt.y}) rotate(${ang}) scale(${s})`)
  }

  showFinish(flavors: Flavor[], currentId: string) {
    this.flavorBox.innerHTML = ''
    for (const f of flavors) {
      const b = document.createElement('button')
      b.className = 'flavor' + (f.id === currentId ? ' sel' : '')
      b.type = 'button'
      b.style.background = f.chip
      b.textContent = f.label
      b.addEventListener('click', () => {
        this.flavorBox.querySelectorAll('.flavor').forEach((e) => e.classList.remove('sel'))
        b.classList.add('sel')
        this.onFlavor?.(f)
      })
      this.flavorBox.appendChild(b)
    }
    this.finish.classList.remove('hidden')
  }

  hideFinish() {
    this.finish.classList.add('hidden')
  }
}
