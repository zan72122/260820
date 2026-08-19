/* One finger, one job: point at the side of the screen you want to go. */

export class Controls {
  /** -1 (hard left) .. +1 (hard right); 0 when nothing is touched */
  steer = 0
  active = false
  x = 0
  y = 0
  onFirstTouch: (() => void) | null = null
  onTouchChange: ((active: boolean, x: number, y: number) => void) | null = null
  private firstDone = false
  private id: number | null = null

  constructor(private el: HTMLElement) {
    const down = (e: PointerEvent) => {
      if (this.id !== null) return
      this.id = e.pointerId
      this.active = true
      this.set(e)
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* capture is a nicety, not a requirement */
      }
      if (!this.firstDone) {
        this.firstDone = true
        this.onFirstTouch?.()
      }
      this.onTouchChange?.(true, this.x, this.y)
      e.preventDefault()
    }
    const move = (e: PointerEvent) => {
      if (e.pointerId !== this.id) return
      this.set(e)
      this.onTouchChange?.(true, this.x, this.y)
      e.preventDefault()
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId !== this.id) return
      this.id = null
      this.active = false
      this.steer = 0
      this.onTouchChange?.(false, this.x, this.y)
    }
    el.addEventListener('pointerdown', down, { passive: false })
    el.addEventListener('pointermove', move, { passive: false })
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('pointerleave', up)
    el.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  private set(e: PointerEvent) {
    const r = this.el.getBoundingClientRect()
    this.x = e.clientX - r.left
    this.y = e.clientY - r.top
    const half = r.width * 0.5
    const raw = (this.x - half) / (r.width * 0.3)
    const dead = 0.1
    const v = Math.max(-1, Math.min(1, raw))
    this.steer = Math.abs(v) < dead ? 0 : (v - Math.sign(v) * dead) / (1 - dead)
  }

  /** Keyboard is only here so the game can be driven on a desktop for testing. */
  attachKeyboard() {
    const keys = new Set<string>()
    const apply = () => {
      const l = keys.has('ArrowLeft') || keys.has('a')
      const r = keys.has('ArrowRight') || keys.has('d')
      this.steer = l && !r ? -1 : r && !l ? 1 : 0
      this.active = l || r
    }
    window.addEventListener('keydown', (e) => {
      keys.add(e.key)
      apply()
    })
    window.addEventListener('keyup', (e) => {
      keys.delete(e.key)
      apply()
    })
  }
}
