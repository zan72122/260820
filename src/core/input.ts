/**
 * One finger. Nothing else is ever required - no pinch, no two-finger rotate,
 * no precise angle. Extra touches are ignored rather than fighting the first.
 */

export interface PointerSample {
  x: number
  y: number
  /** CSS pixels moved since the previous sample. */
  dx: number
  dy: number
  /** CSS pixels moved since the gesture began. */
  totalX: number
  totalY: number
}

export interface PointerHandlers {
  onDown(p: PointerSample): void
  onMove(p: PointerSample): void
  onUp(p: PointerSample): void
}

export class PointerInput {
  private activeId: number | null = null
  private last = { x: 0, y: 0 }
  private start = { x: 0, y: 0 }
  private detach: Array<() => void> = []

  constructor(
    el: HTMLElement,
    private handlers: PointerHandlers,
  ) {
    const down = (e: PointerEvent) => {
      if (this.activeId !== null) return
      this.activeId = e.pointerId
      this.start = { x: e.clientX, y: e.clientY }
      this.last = { x: e.clientX, y: e.clientY }
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* capture is a nicety, not a requirement */
      }
      handlers.onDown(this.sample(e))
      e.preventDefault()
    }
    const move = (e: PointerEvent) => {
      if (e.pointerId !== this.activeId) return
      const s = this.sample(e)
      this.last = { x: e.clientX, y: e.clientY }
      handlers.onMove(s)
      e.preventDefault()
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId !== this.activeId) return
      const s = this.sample(e)
      this.activeId = null
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        /* already gone */
      }
      handlers.onUp(s)
    }

    el.addEventListener('pointerdown', down, { passive: false })
    el.addEventListener('pointermove', move, { passive: false })
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('lostpointercapture', up)
    const noCtx = (e: Event) => e.preventDefault()
    el.addEventListener('contextmenu', noCtx)
    this.detach = [
      () => el.removeEventListener('pointerdown', down),
      () => el.removeEventListener('pointermove', move),
      () => el.removeEventListener('pointerup', up),
      () => el.removeEventListener('pointercancel', up),
      () => el.removeEventListener('lostpointercapture', up),
      () => el.removeEventListener('contextmenu', noCtx),
    ]
  }

  private sample(e: PointerEvent): PointerSample {
    return {
      x: e.clientX,
      y: e.clientY,
      dx: e.clientX - this.last.x,
      dy: e.clientY - this.last.y,
      totalX: e.clientX - this.start.x,
      totalY: e.clientY - this.start.y,
    }
  }

  get isDown(): boolean {
    return this.activeId !== null
  }

  /** Drop the current gesture without breaking state (rotation, context loss). */
  cancel(): void {
    if (this.activeId === null) return
    const s: PointerSample = { x: this.last.x, y: this.last.y, dx: 0, dy: 0, totalX: 0, totalY: 0 }
    this.activeId = null
    this.handlers.onUp(s)
  }

  dispose(): void {
    for (const d of this.detach) d()
    this.detach = []
  }
}
