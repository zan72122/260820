import * as THREE from 'three'

/**
 * One finger, nothing else. The first active pointer wins; extra touches are
 * ignored so a palm resting on an iPad cannot steal the drag. pointercancel and
 * pointerleave both end the gesture cleanly.
 */
export class Input {
  active = false
  /** css pixels */
  x = 0
  y = 0
  startX = 0
  startY = 0
  /** movement since last frame, css pixels */
  dx = 0
  dy = 0
  /** seconds since press */
  held = 0
  pressed = false
  released = false
  cancelled = false
  /** total path length of this gesture, css pixels */
  travel = 0

  readonly ndc = new THREE.Vector2()
  private raycaster = new THREE.Raycaster()
  private pointerId: number | null = null
  private pendingX = 0
  private pendingY = 0
  private moved = false
  private firstInteraction: (() => void) | null = null

  constructor(private el: HTMLElement) {
    el.addEventListener('pointerdown', this.onDown, { passive: false })
    el.addEventListener('pointermove', this.onMove, { passive: false })
    window.addEventListener('pointerup', this.onUp, { passive: false })
    window.addEventListener('pointercancel', this.onCancel, { passive: false })
    el.addEventListener('contextmenu', (e) => e.preventDefault())
    el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false })
    el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false })
  }

  onFirstInteraction(fn: () => void) {
    this.firstInteraction = fn
  }

  private onDown = (e: PointerEvent) => {
    if (this.pointerId !== null) return
    if ((e.target as HTMLElement)?.tagName === 'BUTTON') return
    e.preventDefault()
    this.pointerId = e.pointerId
    try {
      this.el.setPointerCapture(e.pointerId)
    } catch {
      /* capture is best effort */
    }
    this.x = this.pendingX = e.clientX
    this.y = this.pendingY = e.clientY
    this.startX = e.clientX
    this.startY = e.clientY
    this.active = true
    this.pressed = true
    this.held = 0
    this.travel = 0
    this.moved = true
    if (this.firstInteraction) {
      const fn = this.firstInteraction
      this.firstInteraction = null
      fn()
    }
  }

  private onMove = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return
    e.preventDefault()
    this.pendingX = e.clientX
    this.pendingY = e.clientY
    this.moved = true
  }

  private onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return
    this.pointerId = null
    this.active = false
    this.released = true
  }

  private onCancel = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return
    this.pointerId = null
    this.active = false
    this.released = true
    this.cancelled = true
  }

  beginFrame(dt: number, w: number, h: number) {
    if (this.moved) {
      this.dx = this.pendingX - this.x
      this.dy = this.pendingY - this.y
      this.x = this.pendingX
      this.y = this.pendingY
      this.moved = false
    } else {
      this.dx = 0
      this.dy = 0
    }
    if (this.active) {
      this.held += dt
      this.travel += Math.hypot(this.dx, this.dy)
    }
    this.ndc.set((this.x / w) * 2 - 1, -(this.y / h) * 2 + 1)
  }

  endFrame() {
    this.pressed = false
    this.released = false
    this.cancelled = false
  }

  /** NDC of the finger, lifted `pxUp` screen pixels so the hand never covers it. */
  ndcLifted(pxUp: number, w: number, h: number, out = new THREE.Vector2()) {
    return out.set((this.x / w) * 2 - 1, -((this.y - pxUp) / h) * 2 + 1)
  }

  ray(camera: THREE.Camera, ndc = this.ndc) {
    this.raycaster.setFromCamera(ndc, camera)
    return this.raycaster
  }

  /** Intersect the finger ray with a horizontal plane at height y. */
  planePoint(camera: THREE.Camera, y: number, ndc = this.ndc, out = new THREE.Vector3()) {
    const r = this.ray(camera, ndc)
    const dirY = r.ray.direction.y
    if (Math.abs(dirY) < 1e-5) return null
    const t = (y - r.ray.origin.y) / dirY
    if (t < 0) return null
    return out.copy(r.ray.origin).addScaledVector(r.ray.direction, t)
  }

  hits(camera: THREE.Camera, objects: THREE.Object3D[], ndc = this.ndc) {
    return this.ray(camera, ndc).intersectObjects(objects, true)
  }

  dispose() {
    this.el.removeEventListener('pointerdown', this.onDown)
    this.el.removeEventListener('pointermove', this.onMove)
    window.removeEventListener('pointerup', this.onUp)
    window.removeEventListener('pointercancel', this.onCancel)
  }
}
