/**
 * One finger, nothing else. Extra pointers are ignored outright rather than
 * fighting the first one, so a toddler resting a palm on the glass cannot
 * derail a drag, and there is no pinch or two-finger gesture to discover.
 */
export interface PointerSample {
  x: number
  y: number
  dx: number
  dy: number
}

export type PointerPhase = 'down' | 'move' | 'up'

export class SingleTouch {
  private activeId: number | null = null
  private last = { x: 0, y: 0 }
  readonly current: PointerSample = { x: 0, y: 0, dx: 0, dy: 0 }
  down = false
  /** Total distance travelled since the finger went down, in CSS pixels. */
  travel = 0

  private handlers: ((phase: PointerPhase, s: PointerSample) => void)[] = []
  private readonly element: HTMLElement
  private readonly onDown: (e: PointerEvent) => void
  private readonly onMove: (e: PointerEvent) => void
  private readonly onUp: (e: PointerEvent) => void
  private readonly onContext: (e: Event) => void

  constructor(element: HTMLElement) {
    this.element = element
    this.onDown = (e) => {
      if (this.activeId !== null) return
      this.activeId = e.pointerId
      this.down = true
      this.travel = 0
      this.last.x = e.clientX
      this.last.y = e.clientY
      this.set(e.clientX, e.clientY, 0, 0)
      try {
        element.setPointerCapture(e.pointerId)
      } catch {
        /* capture is a nicety, not a requirement */
      }
      this.emit('down')
      e.preventDefault()
    }
    this.onMove = (e) => {
      if (e.pointerId !== this.activeId) return
      const dx = e.clientX - this.last.x
      const dy = e.clientY - this.last.y
      this.last.x = e.clientX
      this.last.y = e.clientY
      this.travel += Math.hypot(dx, dy)
      this.set(e.clientX, e.clientY, dx, dy)
      this.emit('move')
      e.preventDefault()
    }
    this.onUp = (e) => {
      if (e.pointerId !== this.activeId) return
      this.set(e.clientX, e.clientY, 0, 0)
      this.down = false
      this.activeId = null
      this.emit('up')
      try {
        element.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
      e.preventDefault()
    }
    this.onContext = (e) => e.preventDefault()

    element.addEventListener('pointerdown', this.onDown, { passive: false })
    element.addEventListener('pointermove', this.onMove, { passive: false })
    element.addEventListener('pointerup', this.onUp, { passive: false })
    element.addEventListener('pointercancel', this.onUp, { passive: false })
    element.addEventListener('lostpointercapture', this.onUp, { passive: false })
    element.addEventListener('contextmenu', this.onContext)
  }

  private set(x: number, y: number, dx: number, dy: number): void {
    this.current.x = x
    this.current.y = y
    this.current.dx = dx
    this.current.dy = dy
  }

  private emit(phase: PointerPhase): void {
    for (const h of this.handlers) h(phase, this.current)
  }

  on(handler: (phase: PointerPhase, s: PointerSample) => void): void {
    this.handlers.push(handler)
  }

  /** Drop the finger without an event, e.g. when the page is hidden. */
  forceRelease(): void {
    if (!this.down) return
    this.down = false
    this.activeId = null
    this.emit('up')
  }

  dispose(): void {
    this.element.removeEventListener('pointerdown', this.onDown)
    this.element.removeEventListener('pointermove', this.onMove)
    this.element.removeEventListener('pointerup', this.onUp)
    this.element.removeEventListener('pointercancel', this.onUp)
    this.element.removeEventListener('lostpointercapture', this.onUp)
    this.element.removeEventListener('contextmenu', this.onContext)
    this.handlers = []
  }
}
