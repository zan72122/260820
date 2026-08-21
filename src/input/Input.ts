import { clamp } from '../util/math'

export interface SwipeEvent {
  /** 0..1 how far the finger travelled, relative to the short side of the screen. */
  length: number
  /** -1..1 alignment with the swing's on-screen direction of travel. */
  alignment: number
  /** Screen position where the gesture ended. */
  x: number
  y: number
}

/**
 * One finger, one arc. Deliberately forgiving: there is no timing window and no
 * failure state — a swipe in roughly the right direction always books the next
 * pump, and a swipe in the wrong direction simply books a smaller one.
 */
export class Input {
  private active = false
  private fired = false
  private startX = 0
  private startY = 0
  private lastX = 0
  private lastY = 0
  private path: { x: number; y: number }[] = []

  /** Unit vector, in screen pixels, of the swing's current direction of travel. */
  swingDir: { x: number; y: number } = { x: 1, y: 0 }

  onSwipe: ((e: SwipeEvent) => void) | null = null
  onFirstTouch: (() => void) | null = null
  private touched = false

  constructor(private el: HTMLElement) {
    const opts = { passive: false } as AddEventListenerOptions
    el.addEventListener('pointerdown', this.down, opts)
    el.addEventListener('pointermove', this.move, opts)
    el.addEventListener('pointerup', this.up, opts)
    el.addEventListener('pointercancel', this.up, opts)
    el.addEventListener('pointerleave', this.up, opts)
    // iOS Safari still fires a synthetic scroll/zoom unless these are eaten.
    el.addEventListener('touchmove', (e) => e.preventDefault(), opts)
    el.addEventListener('gesturestart', (e) => e.preventDefault(), opts)
    el.addEventListener('contextmenu', (e) => e.preventDefault(), opts)
  }

  private short(): number {
    return Math.min(window.innerWidth, window.innerHeight)
  }

  private down = (e: PointerEvent): void => {
    if (!this.touched) {
      this.touched = true
      this.onFirstTouch?.()
    }
    this.active = true
    this.fired = false
    this.startX = this.lastX = e.clientX
    this.startY = this.lastY = e.clientY
    this.path = [{ x: e.clientX, y: e.clientY }]
    this.el.setPointerCapture?.(e.pointerId)
  }

  private move = (e: PointerEvent): void => {
    if (!this.active) return
    e.preventDefault()
    this.lastX = e.clientX
    this.lastY = e.clientY
    this.path.push({ x: e.clientX, y: e.clientY })
    if (this.path.length > 40) this.path.shift()

    const dx = this.lastX - this.startX
    const dy = this.lastY - this.startY
    const len = Math.hypot(dx, dy)
    // Respond while the finger is still down: a four-year-old should not have to
    // finish and lift before anything happens.
    if (!this.fired && len > this.short() * 0.09) {
      this.fired = true
      this.emit(dx, dy, len)
    }
  }

  private up = (e: PointerEvent): void => {
    if (!this.active) return
    this.active = false
    const dx = this.lastX - this.startX
    const dy = this.lastY - this.startY
    const len = Math.hypot(dx, dy)
    if (!this.fired && len > this.short() * 0.035) {
      this.fired = true
      this.emit(dx, dy, len)
    }
    this.el.releasePointerCapture?.(e.pointerId)
  }

  private emit(dx: number, dy: number, len: number): void {
    const n = Math.max(1e-4, len)
    const alignment = clamp((dx / n) * this.swingDir.x + (dy / n) * this.swingDir.y, -1, 1)
    this.onSwipe?.({
      length: clamp(len / (this.short() * 0.42)),
      alignment,
      x: this.lastX,
      y: this.lastY,
    })
  }
}
