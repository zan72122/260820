import * as THREE from 'three'

export interface PointerSnapshot {
  /** Normalised device coordinates, -1..1 with +Y up. */
  ndc: THREE.Vector2
  startNdc: THREE.Vector2
  /** CSS pixels. */
  x: number
  y: number
  startX: number
  startY: number
  dx: number
  dy: number
  totalDx: number
  totalDy: number
  duration: number
  moved: boolean
}

/**
 * Single-pointer touch layer. Only one finger ever drives the game, so a second
 * touch is ignored rather than fighting the first — important for small hands
 * resting on the glass.
 */
export class InputSystem {
  readonly ndc = new THREE.Vector2()
  readonly startNdc = new THREE.Vector2()

  active = false
  justDown = false
  justUp = false
  moved = false

  x = 0
  y = 0
  startX = 0
  startY = 0
  dx = 0
  dy = 0
  totalDx = 0
  totalDy = 0
  duration = 0

  /** Snapshot of the gesture as it was at the moment of release. */
  released: PointerSnapshot | null = null

  private pointerId = -1
  private downAt = 0
  private readonly el: HTMLElement
  private readonly onDown: (e: PointerEvent) => void
  private readonly onMove: (e: PointerEvent) => void
  private readonly onUp: (e: PointerEvent) => void
  private readonly onContext: (e: Event) => void

  constructor(el: HTMLElement) {
    this.el = el

    const toLocal = (e: PointerEvent): { x: number; y: number } => {
      const r = this.el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const setNdc = (target: THREE.Vector2, x: number, y: number): void => {
      const r = this.el.getBoundingClientRect()
      target.set((x / Math.max(1, r.width)) * 2 - 1, -(y / Math.max(1, r.height)) * 2 + 1)
    }

    this.onDown = (e) => {
      if (this.active) return
      this.pointerId = e.pointerId
      const p = toLocal(e)
      this.active = true
      this.justDown = true
      this.moved = false
      this.x = this.startX = p.x
      this.y = this.startY = p.y
      this.dx = this.dy = 0
      this.totalDx = this.totalDy = 0
      this.duration = 0
      this.downAt = performance.now()
      setNdc(this.ndc, p.x, p.y)
      this.startNdc.copy(this.ndc)
      if (this.el.setPointerCapture) {
        try {
          this.el.setPointerCapture(e.pointerId)
        } catch {
          /* capture is best-effort */
        }
      }
      e.preventDefault()
    }

    this.onMove = (e) => {
      if (!this.active || e.pointerId !== this.pointerId) return
      const p = toLocal(e)
      this.dx += p.x - this.x
      this.dy += p.y - this.y
      this.x = p.x
      this.y = p.y
      this.totalDx = this.x - this.startX
      this.totalDy = this.y - this.startY
      if (Math.hypot(this.totalDx, this.totalDy) > 8) this.moved = true
      setNdc(this.ndc, p.x, p.y)
      e.preventDefault()
    }

    this.onUp = (e) => {
      if (!this.active || e.pointerId !== this.pointerId) return
      this.duration = (performance.now() - this.downAt) / 1000
      this.released = {
        ndc: this.ndc.clone(),
        startNdc: this.startNdc.clone(),
        x: this.x,
        y: this.y,
        startX: this.startX,
        startY: this.startY,
        dx: this.dx,
        dy: this.dy,
        totalDx: this.totalDx,
        totalDy: this.totalDy,
        duration: this.duration,
        moved: this.moved,
      }
      this.active = false
      this.justUp = true
      this.pointerId = -1
      e.preventDefault()
    }

    this.onContext = (e) => e.preventDefault()

    el.addEventListener('pointerdown', this.onDown, { passive: false })
    el.addEventListener('pointermove', this.onMove, { passive: false })
    el.addEventListener('pointerup', this.onUp, { passive: false })
    el.addEventListener('pointercancel', this.onUp, { passive: false })
    el.addEventListener('contextmenu', this.onContext)
  }

  /** Advances the held-duration clock; call once per frame before reading state. */
  beginFrame(dt: number): void {
    if (this.active) {
      this.duration += dt
      this.totalDx = this.x - this.startX
      this.totalDy = this.y - this.startY
    }
  }

  /** Clears one-shot flags and per-frame deltas; call once per frame after reading. */
  endFrame(): void {
    this.justDown = false
    this.justUp = false
    this.released = null
    this.dx = 0
    this.dy = 0
  }

  dispose(): void {
    this.el.removeEventListener('pointerdown', this.onDown)
    this.el.removeEventListener('pointermove', this.onMove)
    this.el.removeEventListener('pointerup', this.onUp)
    this.el.removeEventListener('pointercancel', this.onUp)
    this.el.removeEventListener('contextmenu', this.onContext)
  }
}
