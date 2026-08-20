/**
 * A single finger. Extra touches are ignored on purpose: nothing in this game
 * needs two fingers, and a four-year-old's spare hand rests on the screen.
 */
export class Input {
  x = 0
  y = 0
  down = false
  justDown = false
  justUp = false
  /** Seconds since the very first touch of the session. */
  everTouched = false
  private id: number | null = null
  private onFirst: (() => void) | null = null

  attach(el: HTMLElement, onFirstGesture: () => void): void {
    this.onFirst = onFirstGesture
    const opts: AddEventListenerOptions = { passive: false }
    el.addEventListener('pointerdown', this.handleDown, opts)
    el.addEventListener('pointermove', this.handleMove, opts)
    window.addEventListener('pointerup', this.handleUp, opts)
    window.addEventListener('pointercancel', this.handleUp, opts)
    el.addEventListener('contextmenu', (e) => e.preventDefault())
    el.addEventListener('touchstart', (e) => e.preventDefault(), opts)
    el.addEventListener('touchmove', (e) => e.preventDefault(), opts)
  }

  private handleDown = (e: PointerEvent): void => {
    if (this.id !== null) return
    e.preventDefault()
    this.id = e.pointerId
    this.x = e.clientX
    this.y = e.clientY
    this.down = true
    this.justDown = true
    if (!this.everTouched) {
      this.everTouched = true
    }
    this.onFirst?.()
  }

  private handleMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.id) return
    e.preventDefault()
    this.x = e.clientX
    this.y = e.clientY
  }

  private handleUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.id) return
    this.id = null
    this.down = false
    this.justUp = true
  }

  /** Call once per frame, after the game has read the edge flags. */
  endFrame(): void {
    this.justDown = false
    this.justUp = false
  }
}
