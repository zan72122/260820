export type UnitPt = { x: number; y: number }

/**
 * Unit space: origin at screen centre, 1 unit = half the *short* screen side,
 * y up. Guides authored once therefore read the same on 390x844 and 1180x820.
 */
export interface Viewport {
  w: number
  h: number
  cx: number
  cy: number
  scale: number
  portrait: boolean
}

export abstract class Gesture {
  progress = 0
  down = false
  speed = 0
  onProgress?: (p: number, g: Gesture) => void
  onComplete?: () => void
  /** Fired on pointerup / cancel before completion — stages decide the safe pose. */
  onRelease?: (p: number) => void
  completed = false
  abstract begin(p: UnitPt): void
  abstract move(p: UnitPt): void
  guide(): UnitPt[] {
    return []
  }
  protected emit(next: number) {
    const p = Math.max(this.progress, Math.min(1, next))
    if (p !== this.progress) {
      this.progress = p
      this.onProgress?.(p, this)
    }
    if (p >= 0.999 && !this.completed) {
      this.completed = true
      this.onComplete?.()
    }
  }
  release() {
    this.down = false
    this.speed = 0
    if (!this.completed) this.onRelease?.(this.progress)
  }
}

/** Follow a drawn stroke. Generous tolerance plus intent-based advance. */
export class PathGesture extends Gesture {
  private cum: number[] = []
  private total = 0
  private last: UnitPt | null = null
  constructor(
    private pts: UnitPt[],
    private tolerance = 0.42,
    private maxJump = 0.3,
  ) {
    super()
    this.cum = [0]
    for (let i = 1; i < pts.length; i++) {
      this.cum.push(this.cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
    }
    this.total = this.cum[this.cum.length - 1] || 1
  }
  guide() {
    return this.pts
  }
  begin(p: UnitPt) {
    this.down = true
    this.last = p
  }
  /** Nearest point on the polyline → normalised arc-length param + distance. */
  private nearest(p: UnitPt) {
    let bestD = Infinity
    let bestS = 0
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1]
      const b = this.pts[i]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const len2 = dx * dx + dy * dy || 1e-9
      let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
      t = t < 0 ? 0 : t > 1 ? 1 : t
      const qx = a.x + dx * t
      const qy = a.y + dy * t
      const d = Math.hypot(p.x - qx, p.y - qy)
      if (d < bestD) {
        bestD = d
        bestS = (this.cum[i - 1] + Math.hypot(dx, dy) * t) / this.total
      }
    }
    return { s: bestS, d: bestD }
  }
  private tangentAt(s: number): UnitPt {
    const d = s * this.total
    let i = 1
    while (i < this.cum.length - 1 && this.cum[i] < d) i++
    const a = this.pts[i - 1]
    const b = this.pts[i]
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1
    return { x: (b.x - a.x) / l, y: (b.y - a.y) / l }
  }
  move(p: UnitPt) {
    if (!this.down) return
    const prev = this.last ?? p
    const mv = { x: p.x - prev.x, y: p.y - prev.y }
    this.last = p
    this.speed = Math.hypot(mv.x, mv.y)
    const { s, d } = this.nearest(p)
    let next = this.progress
    if (d < this.tolerance && s > this.progress) {
      next = Math.min(s, this.progress + this.maxJump)
    }
    // Off the ribbon but clearly heading the right way: honour the intent.
    const tan = this.tangentAt(this.progress)
    const along = mv.x * tan.x + mv.y * tan.y
    if (along > 0) next = Math.max(next, this.progress + (along / this.total) * 0.9)
    this.emit(next)
  }
}

/** Accumulated turn around a centre — used for tracing the pan wall. */
export class CircleGesture extends Gesture {
  private lastAngle = 0
  private startAngle = 0
  private accum = 0
  private dir = 0
  constructor(
    private center: UnitPt,
    private radius: number,
    private turns = 1,
  ) {
    super()
  }
  guide() {
    const pts: UnitPt[] = []
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2
      pts.push({ x: this.center.x + Math.cos(a) * this.radius, y: this.center.y + Math.sin(a) * this.radius })
    }
    return pts
  }
  begin(p: UnitPt) {
    this.down = true
    this.lastAngle = Math.atan2(p.y - this.center.y, p.x - this.center.x)
    if (this.accum === 0) this.startAngle = this.lastAngle
  }
  move(p: UnitPt) {
    if (!this.down) return
    const a = Math.atan2(p.y - this.center.y, p.x - this.center.x)
    let da = a - this.lastAngle
    while (da > Math.PI) da -= Math.PI * 2
    while (da < -Math.PI) da += Math.PI * 2
    this.lastAngle = a
    this.speed = Math.abs(da)
    if (this.dir === 0 && Math.abs(da) > 0.02) this.dir = Math.sign(da)
    if (this.dir !== 0) this.accum += da * this.dir
    this.emit(Math.max(0, this.accum) / (Math.PI * 2 * this.turns))
  }
  /** Screen angle the stroke has reached, so the world can mark the same spot. */
  get angle() {
    return this.lastAngle
  }
  /** +1 anticlockwise, -1 clockwise — whichever way the child chose to go. */
  get direction() {
    return this.dir
  }
  get start() {
    return this.startAngle
  }
}

export class TapGesture extends Gesture {
  private startPt: UnitPt = { x: 0, y: 0 }
  constructor(private maxDrift = 0.35) {
    super()
  }
  begin(p: UnitPt) {
    this.down = true
    this.startPt = p
  }
  move(p: UnitPt) {
    this.startPt = this.down ? this.startPt : p
  }
  release() {
    if (this.down && !this.completed) {
      this.down = false
      this.emit(1)
      return
    }
    super.release()
  }
  setUp(p: UnitPt) {
    if (Math.hypot(p.x - this.startPt.x, p.y - this.startPt.y) > this.maxDrift) {
      this.down = false
      this.onRelease?.(0)
      return
    }
    this.release()
  }
}

export class Input {
  vp: Viewport = { w: 1, h: 1, cx: 0.5, cy: 0.5, scale: 1, portrait: true }
  private gesture: Gesture | null = null
  pointerPos: UnitPt = { x: 0, y: 0 }
  hasPointer = false

  constructor(private el: HTMLElement) {
    el.style.touchAction = 'none'
    el.addEventListener('pointerdown', this.onDown, { passive: false })
    el.addEventListener('pointermove', this.onMove, { passive: false })
    el.addEventListener('pointerup', this.onUp)
    el.addEventListener('pointercancel', this.onCancel)
    el.addEventListener('lostpointercapture', this.onCancel)
    el.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  resize(w: number, h: number) {
    this.vp = { w, h, cx: w / 2, cy: h / 2, scale: Math.min(w, h) / 2, portrait: h >= w }
  }

  toUnit(clientX: number, clientY: number): UnitPt {
    const r = this.el.getBoundingClientRect()
    return {
      x: (clientX - r.left - this.vp.cx) / this.vp.scale,
      y: (this.vp.cy - (clientY - r.top)) / this.vp.scale,
    }
  }
  toPx(p: UnitPt) {
    return { x: this.vp.cx + p.x * this.vp.scale, y: this.vp.cy - p.y * this.vp.scale }
  }

  set(g: Gesture | null) {
    this.gesture = g
  }
  get active() {
    return this.gesture
  }

  private onDown = (e: PointerEvent) => {
    e.preventDefault()
    this.el.setPointerCapture?.(e.pointerId)
    this.hasPointer = true
    const p = this.toUnit(e.clientX, e.clientY)
    this.pointerPos = p
    this.gesture?.begin(p)
  }
  private onMove = (e: PointerEvent) => {
    const p = this.toUnit(e.clientX, e.clientY)
    this.pointerPos = p
    if (this.gesture?.down) e.preventDefault()
    this.gesture?.move(p)
  }
  private onUp = (e: PointerEvent) => {
    const p = this.toUnit(e.clientX, e.clientY)
    this.pointerPos = p
    this.hasPointer = false
    const g = this.gesture
    if (!g) return
    if (g instanceof TapGesture) g.setUp(p)
    else g.release()
  }
  private onCancel = () => {
    this.hasPointer = false
    this.gesture?.release()
  }
  /** Screen rotation / tab switch: treat as a cancel so nothing is left mid-swing. */
  abort() {
    this.onCancel()
  }
}
