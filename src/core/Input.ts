/**
 * Single-finger input. No multi-touch gestures, no sliders: water pressure is
 * inferred from how long the finger is held down and how fast it moves.
 */
export class Input {
  down = false
  /** css pixels */
  x = 0
  y = 0
  prevX = 0
  prevY = 0
  downX = 0
  downY = 0
  /** css px / s, smoothed */
  speed = 0
  holdTime = 0
  /** 0..1 continuous estimate of weak / medium / strong */
  pressure = 0
  justPressed = false
  justReleased = false
  /** total path length since press, css px */
  travel = 0
  private pending = 0
  private moved = false
  private lastMoveT = 0

  constructor(private el: HTMLElement) {
    el.addEventListener('pointerdown', this.onDown, { passive: false })
    el.addEventListener('pointermove', this.onMove, { passive: false })
    el.addEventListener('pointerup', this.onUp, { passive: false })
    el.addEventListener('pointercancel', this.onUp, { passive: false })
    el.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  private point(e: PointerEvent) {
    const r = this.el.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  private onDown = (e: PointerEvent) => {
    if (this.down && e.isPrimary === false) return
    e.preventDefault()
    const p = this.point(e)
    this.down = true
    this.justPressed = true
    this.x = this.prevX = this.downX = p.x
    this.y = this.prevY = this.downY = p.y
    this.holdTime = 0
    this.travel = 0
    this.pending = 0
    this.speed = 0
    this.pressure = 0
    this.moved = false
    this.lastMoveT = performance.now()
    try {
      this.el.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  private onMove = (e: PointerEvent) => {
    if (!this.down) return
    e.preventDefault()
    const p = this.point(e)
    const now = performance.now()
    const dt = Math.max(1, now - this.lastMoveT) / 1000
    this.lastMoveT = now
    void dt
    const dx = p.x - this.x
    const dy = p.y - this.y
    const step = Math.hypot(dx, dy)
    // distance is accumulated here and turned into a speed on the simulation
    // clock, so pointer events arriving in bursts do not distort it
    this.pending += step
    this.travel += step
    this.x = p.x
    this.y = p.y
    if (this.travel > 6) this.moved = true
  }

  private onUp = (e: PointerEvent) => {
    if (!this.down) return
    e.preventDefault()
    this.down = false
    this.justReleased = true
  }

  get isTap() {
    return !this.moved && this.holdTime < 0.45
  }

  update(dt: number) {
    if (this.down) {
      this.holdTime += dt
      const inst = this.pending / dt
      this.pending = 0
      this.speed += (inst - this.speed) * Math.min(1, dt * 12)
      const hold = Math.min(1, this.holdTime / 0.7)
      const move = Math.min(1, this.speed / 900)
      const target = 0.3 + 0.45 * hold + 0.35 * move
      this.pressure += (Math.min(1, target) - this.pressure) * Math.min(1, dt * 7)
    } else {
      this.pressure += (0 - this.pressure) * Math.min(1, dt * 9)
      this.pending = 0
      this.speed *= Math.exp(-dt * 8)
    }
  }

  endFrame() {
    this.justPressed = false
    this.justReleased = false
    this.prevX = this.x
    this.prevY = this.y
  }
}
