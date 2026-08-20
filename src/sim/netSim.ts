/**
 * Verlet rope-net solver for the hammock.
 *
 * The net is a real grid of knots joined by real cords:
 *   - a rectangular mesh panel (cols x rows knots),
 *   - the two end columns gathered onto a ring,
 *   - a suspension cord from each ring up to a hook-end (the draggable handle).
 *
 * Everything runs on a fixed timestep with a fixed iteration count, so the
 * behaviour is identical on a slow phone and a fast desktop. No three.js here,
 * which keeps the solver unit-testable in plain node.
 */

export interface NetConfig {
  cols: number
  rows: number
  panelLength: number
  panelWidth: number
  cordSegments: number
  cordLength: number
  /** Border cords are slightly shorter, so the long edges lift into a cradle. */
  edgeShrink: number
  iterations: number
}

export const DEFAULT_NET: NetConfig = {
  cols: 15,
  rows: 9,
  panelLength: 0.46,
  panelWidth: 0.28,
  cordSegments: 7,
  cordLength: 0.42,
  edgeShrink: 0.09,
  iterations: 8,
}

export interface Sphere {
  x: number
  y: number
  z: number
  r: number
}

/** Flat surfaces the net can come to rest on: the bench, and the floor. */
export interface Support {
  floorY: number
  benchTop: number
  x0: number
  x1: number
  z0: number
  z1: number
}

export interface StepContext {
  gravity: number
  /** Breeze strength; drives a slow, low amplitude lateral force field. */
  wind: number
  windPhase: number
  /** Optional collider that the net can never penetrate. */
  collider?: Sphere | null
  /** Where a dropped cord end lands instead of falling out of the world. */
  support?: Support | null
}

const SUBSTEP = 1 / 240

export class NetSim {
  readonly cfg: NetConfig
  readonly nodeCount: number
  readonly pos: Float32Array
  readonly prev: Float32Array
  readonly pinned: Uint8Array
  /** The sheet's shape with nothing resting in it. */
  private readonly restPos: Float32Array
  /** Structural cords that get real tube geometry. */
  readonly ropeEdges: Int32Array
  readonly ringLeft: number
  readonly ringRight: number
  readonly handleLeft: number
  readonly handleRight: number
  readonly cordLeft: Int32Array
  readonly cordRight: Int32Array

  private readonly cA: Int32Array
  private readonly cB: Int32Array
  private readonly cRest: Float32Array
  private readonly cStiff: Float32Array
  private readonly constraintCount: number

  /** Nodes currently held against the fruit surface (scripted contact patch). */
  private gripIdx: Int32Array = new Int32Array(0)
  private gripLocal: Float32Array = new Float32Array(0)
  private gripWeight: Float32Array = new Float32Array(0)
  private gripAmount = 0
  /**
   * Optional exact surface of the collider, in world-space unit directions.
   * The fruit is not a ball, so the net asks the fruit where its skin actually
   * is. Without this the contact patch would float on the flatter cheeks.
   */
  private radiusFn: ((dx: number, dy: number, dz: number) => number) | null = null

  private accumulator = 0
  private timeAcc = 0

  constructor(cfg: Partial<NetConfig> = {}) {
    this.cfg = { ...DEFAULT_NET, ...cfg }
    const { cols, rows, cordSegments } = this.cfg

    const panelNodes = cols * rows
    this.ringLeft = panelNodes
    this.ringRight = panelNodes + 1
    const cordBase = panelNodes + 2
    this.nodeCount = cordBase + cordSegments * 2

    this.pos = new Float32Array(this.nodeCount * 3)
    this.prev = new Float32Array(this.nodeCount * 3)
    this.restPos = new Float32Array(this.nodeCount * 3)
    this.pinned = new Uint8Array(this.nodeCount)

    this.cordLeft = new Int32Array(cordSegments)
    this.cordRight = new Int32Array(cordSegments)
    for (let i = 0; i < cordSegments; i++) {
      this.cordLeft[i] = cordBase + i
      this.cordRight[i] = cordBase + cordSegments + i
    }
    this.handleLeft = this.cordLeft[cordSegments - 1]
    this.handleRight = this.cordRight[cordSegments - 1]

    const a: number[] = []
    const b: number[] = []
    const rest: number[] = []
    const stiff: number[] = []
    const rope: number[] = []

    const dx = this.cfg.panelLength / (cols - 1)
    const dz = this.cfg.panelWidth / (rows - 1)

    const rowScale = (r: number): number => {
      const edge = Math.min(r, rows - 1 - r)
      // Only the outermost two rows are shortened, giving a soft lip.
      const k = edge === 0 ? 1 : edge === 1 ? 0.4 : 0
      return 1 - this.cfg.edgeShrink * k
    }

    const push = (i: number, j: number, len: number, s: number, isRope: boolean): void => {
      a.push(i); b.push(j); rest.push(len); stiff.push(s)
      if (isRope) { rope.push(i, j) }
    }

    // Warp (along X) and weft (along Z) cords.
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const i = this.panel(c, r)
        if (c + 1 < cols) push(i, this.panel(c + 1, r), dx * rowScale(r), 1, true)
        if (r + 1 < rows) push(i, this.panel(c, r + 1), dz, 1, true)
        // Shear bracing keeps the sheet from collapsing without adding cords.
        if (c + 1 < cols && r + 1 < rows) {
          const d = Math.hypot(dx * rowScale(r), dz)
          push(i, this.panel(c + 1, r + 1), d, 0.28, false)
          push(this.panel(c + 1, r), this.panel(c, r + 1), d, 0.28, false)
        }
      }
    }

    // Gather each end column onto its ring, fan-wise.
    const gatherBase = this.cfg.panelWidth * 0.42
    for (let r = 0; r < rows; r++) {
      const t = (r / (rows - 1)) * 2 - 1
      const len = gatherBase * (0.42 + 0.58 * Math.abs(t)) + 0.035
      push(this.panel(0, r), this.ringLeft, len, 1, true)
      push(this.panel(cols - 1, r), this.ringRight, len, 1, true)
    }

    // Suspension cords: ring -> ... -> handle.
    const segLen = this.cfg.cordLength / cordSegments
    for (const [ring, cord] of [
      [this.ringLeft, this.cordLeft],
      [this.ringRight, this.cordRight],
    ] as const) {
      push(ring, cord[0], segLen, 1, true)
      for (let i = 0; i + 1 < cordSegments; i++) push(cord[i], cord[i + 1], segLen, 1, true)
    }

    this.cA = Int32Array.from(a)
    this.cB = Int32Array.from(b)
    this.cRest = Float32Array.from(rest)
    this.cStiff = Float32Array.from(stiff)
    this.constraintCount = a.length
    this.ropeEdges = Int32Array.from(rope)

    this.layFlat(0, 0.3, 0)
    this.snapshotRest()
  }

  panel(c: number, r: number): number {
    return c * this.cfg.rows + r
  }

  get ropeEdgeCount(): number {
    return this.ropeEdges.length / 2
  }

  getX(i: number): number { return this.pos[i * 3] }
  getY(i: number): number { return this.pos[i * 3 + 1] }
  getZ(i: number): number { return this.pos[i * 3 + 2] }

  setNode(i: number, x: number, y: number, z: number, keepVelocity = false): void {
    const o = i * 3
    if (!keepVelocity) {
      this.prev[o] = x; this.prev[o + 1] = y; this.prev[o + 2] = z
    }
    this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z
  }

  /** Move a node and let the motion carry momentum into the cord. */
  driveNode(i: number, x: number, y: number, z: number): void {
    const o = i * 3
    this.prev[o] = this.pos[o]
    this.prev[o + 1] = this.pos[o + 1]
    this.prev[o + 2] = this.pos[o + 2]
    this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z
  }

  setPinned(i: number, on: boolean): void {
    this.pinned[i] = on ? 1 : 0
  }

  /** Initial pose: the net lies draped over a low support. */
  layFlat(cx: number, y: number, cz: number): void {
    const { cols, rows, panelLength, panelWidth, cordSegments, cordLength } = this.cfg
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = cx + (c / (cols - 1) - 0.5) * panelLength
        const z = cz + (r / (rows - 1) - 0.5) * panelWidth
        // A shallow natural slump so it never starts as a perfect plane.
        const slump = Math.sin((c / (cols - 1)) * Math.PI) * 0.006
        this.setNode(this.panel(c, r), x, y - slump, z)
      }
    }
    this.setNode(this.ringLeft, cx - panelLength * 0.5 - 0.05, y - 0.01, cz)
    this.setNode(this.ringRight, cx + panelLength * 0.5 + 0.05, y - 0.01, cz)
    const seg = cordLength / cordSegments
    for (let i = 0; i < cordSegments; i++) {
      const t = (i + 1) / cordSegments
      const drop = Math.min(1, t * 1.35)
      this.setNode(
        this.cordLeft[i],
        cx - panelLength * 0.5 - 0.05 - seg * (i + 1) * 0.55,
        y - 0.01 - cordLength * drop * 0.62,
        cz + 0.02 * t,
      )
      this.setNode(
        this.cordRight[i],
        cx + panelLength * 0.5 + 0.05 + seg * (i + 1) * 0.55,
        y - 0.01 - cordLength * drop * 0.62,
        cz - 0.02 * t,
      )
    }
  }

  // ---------------------------------------------------------------- contact

  /**
   * Capture the contact patch. Nodes near the fruit's underside are recorded in
   * body-local space and afterwards follow the fruit exactly, so the visual
   * contact point can never float, sink in, or stop short.
   */
  beginGrip(s: Sphere, reach = 0.62): void {
    const idx: number[] = []
    const local: number[] = []
    const weight: number[] = []
    const { cols, rows } = this.cfg
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const i = this.panel(c, r)
        const o = i * 3
        let dx = this.pos[o] - s.x
        let dy = this.pos[o + 1] - s.y
        let dz = this.pos[o + 2] - s.z
        const d = Math.hypot(dx, dy, dz) || 1e-6
        // Only the lower cap of the fruit is cradled.
        const downness = -dy / d
        if (downness < 1 - reach) continue
        const horiz = Math.hypot(dx, dz)
        if (horiz > s.r * 1.5) continue
        dx /= d; dy /= d; dz /= d
        idx.push(i)
        local.push(dx, dy, dz)
        const w = Math.min(1, (downness - (1 - reach)) / (reach * 0.55))
        weight.push(w * w * (3 - 2 * w))
      }
    }
    this.gripIdx = Int32Array.from(idx)
    this.gripLocal = Float32Array.from(local)
    this.gripWeight = Float32Array.from(weight)
    this.gripAmount = 0
  }

  setSurfaceRadiusFn(fn: ((dx: number, dy: number, dz: number) => number) | null): void {
    this.radiusFn = fn
  }

  private radiusFor(dx: number, dy: number, dz: number, fallback: number): number {
    return this.radiusFn ? this.radiusFn(dx, dy, dz) : fallback
  }

  setGripAmount(v: number): void {
    this.gripAmount = v < 0 ? 0 : v > 1 ? 1 : v
  }

  releaseGrip(): void {
    this.gripIdx = new Int32Array(0)
    this.gripLocal = new Float32Array(0)
    this.gripWeight = new Float32Array(0)
    this.gripAmount = 0
  }

  get gripCount(): number {
    return this.gripIdx.length
  }

  // ------------------------------------------------------------------ query

  /** Height of the net sheet under a world position (nearest-knot average). */
  surfaceHeightAt(x: number, z: number, radius = 0.05): number {
    return this.sampleHeight(this.pos, x, z, radius)
  }

  private sampleHeight(src: Float32Array, x: number, z: number, radius: number): number {
    const { cols, rows } = this.cfg
    let sum = 0
    let wsum = 0
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const o = this.panel(c, r) * 3
        const d = Math.hypot(src[o] - x, src[o + 2] - z)
        if (d > radius) continue
        const w = 1 - d / radius
        sum += src[o + 1] * w
        wsum += w
      }
    }
    if (wsum > 0) return sum / wsum
    // Fall back to the lowest knot so the query is always defined.
    let lowest = Infinity
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const y = src[this.panel(c, r) * 3 + 1]
        if (y < lowest) lowest = y
      }
    }
    return lowest
  }

  private lowestOf(src: Float32Array, out: { x: number; y: number; z: number }): void {
    const { cols, rows } = this.cfg
    let best = Infinity
    let bx = 0, bz = 0
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const o = this.panel(c, r) * 3
        if (src[o + 1] < best) {
          best = src[o + 1]
          bx = src[o]
          bz = src[o + 2]
        }
      }
    }
    out.x = bx; out.y = best; out.z = bz
  }

  // -------------------------------------------------------- unloaded shape

  /**
   * The catch needs to know where the net sits when *nothing* is in it. Once
   * the fruit lands, the sheet is deformed by the fruit itself, so the
   * unloaded shape is kept as a slowly updated snapshot instead of measured
   * live. This is what makes a narrow, slack hanging genuinely sink deeper
   * than a wide, taut one.
   */
  snapshotRest(): void {
    this.restPos.set(this.pos)
  }

  updateRestSnapshot(alpha: number): void {
    const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha
    for (let i = 0; i < this.restPos.length; i++) {
      this.restPos[i] += (this.pos[i] - this.restPos[i]) * a
    }
  }

  restHeightAt(x: number, z: number, radius = 0.05): number {
    return this.sampleHeight(this.restPos, x, z, radius)
  }

  lowestRestPoint(out: { x: number; y: number; z: number }): void {
    this.lowestOf(this.restPos, out)
  }

  /** Deepest point of the sheet, used for framing and for the catch target. */
  lowestPanelPoint(out: { x: number; y: number; z: number }): void {
    this.lowestOf(this.pos, out)
  }

  /** Centre of the sheet (average of the middle band). */
  centre(out: { x: number; y: number; z: number }): void {
    const { cols, rows } = this.cfg
    const c0 = Math.floor((cols - 1) / 2)
    const c1 = Math.ceil((cols - 1) / 2)
    let x = 0, y = 0, z = 0, n = 0
    for (const c of [c0, c1]) {
      for (let r = 0; r < rows; r++) {
        const o = this.panel(c, r) * 3
        x += this.pos[o]; y += this.pos[o + 1]; z += this.pos[o + 2]; n++
      }
    }
    out.x = x / n; out.y = y / n; out.z = z / n
  }

  /** Push the net locally, e.g. a fingertip nudging it from underneath. */
  addImpulse(
    x: number, y: number, z: number,
    radius: number,
    ix: number, iy: number, iz: number,
  ): void {
    for (let i = 0; i < this.nodeCount; i++) {
      if (this.pinned[i]) continue
      const o = i * 3
      const d = Math.hypot(this.pos[o] - x, this.pos[o + 1] - y, this.pos[o + 2] - z)
      if (d > radius) continue
      const w = 1 - d / radius
      this.prev[o] -= ix * w
      this.prev[o + 1] -= iy * w
      this.prev[o + 2] -= iz * w
    }
  }

  // ------------------------------------------------------------------- step

  /** Advance by real time using an internal fixed timestep. */
  step(dt: number, ctx: StepContext): void {
    this.accumulator += Math.min(dt, 0.1)
    let guard = 0
    while (this.accumulator >= SUBSTEP && guard < 32) {
      this.substep(SUBSTEP, ctx)
      this.accumulator -= SUBSTEP
      guard++
    }
    if (guard >= 32) this.accumulator = 0
  }

  /** Run the solver forward without needing a render loop (used at load). */
  settle(seconds: number, ctx: StepContext): void {
    const steps = Math.round(seconds / SUBSTEP)
    for (let i = 0; i < steps; i++) this.substep(SUBSTEP, ctx)
    this.accumulator = 0
  }

  private substep(dt: number, ctx: StepContext): void {
    this.timeAcc += dt
    const drag = 0.992
    const g = ctx.gravity * dt * dt
    const t = ctx.windPhase + this.timeAcc

    for (let i = 0; i < this.nodeCount; i++) {
      if (this.pinned[i]) continue
      const o = i * 3
      const px = this.pos[o], py = this.pos[o + 1], pz = this.pos[o + 2]
      let vx = (px - this.prev[o]) * drag
      let vy = (py - this.prev[o + 1]) * drag
      let vz = (pz - this.prev[o + 2]) * drag

      // Greenhouse breeze: slow, spatially varying, always gentle.
      if (ctx.wind > 0) {
        const w = ctx.wind * dt * dt
        vx += w * Math.sin(t * 1.19 + px * 5.3 + pz * 2.1)
        vz += w * 0.7 * Math.sin(t * 0.83 + pz * 4.1 + py * 3.0)
        vy += w * 0.35 * Math.sin(t * 1.61 + px * 3.7)
      }

      this.prev[o] = px; this.prev[o + 1] = py; this.prev[o + 2] = pz
      this.pos[o] = px + vx
      this.pos[o + 1] = py + vy - g
      this.pos[o + 2] = pz + vz
    }

    const iters = this.cfg.iterations
    for (let k = 0; k < iters; k++) {
      this.solveConstraints()
      this.applyGrip()
      if (ctx.collider) this.collide(ctx.collider)
      if (ctx.support) this.rest(ctx.support)
    }
  }

  /**
   * Nothing in this game falls out of the world. A cord end let go halfway
   * simply settles onto the bench or the floor and stays where it landed.
   */
  private rest(s: Support): void {
    const { pos, prev } = this
    for (let i = 0; i < this.nodeCount; i++) {
      if (this.pinned[i]) continue
      const o = i * 3
      const x = pos[o]
      const z = pos[o + 2]
      const onBench = x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1
      const floor = onBench ? s.benchTop : s.floorY
      if (pos[o + 1] >= floor) continue
      pos[o + 1] = floor
      // Friction, so a landed cord does not skate across the bench.
      prev[o] += (pos[o] - prev[o]) * 0.45
      prev[o + 2] += (pos[o + 2] - prev[o + 2]) * 0.45
      if (prev[o + 1] > floor) prev[o + 1] = floor
    }
  }

  private solveConstraints(): void {
    const { pos, cA, cB, cRest, cStiff, pinned } = this
    for (let i = 0; i < this.constraintCount; i++) {
      const ia = cA[i] * 3
      const ib = cB[i] * 3
      let dx = pos[ib] - pos[ia]
      let dy = pos[ib + 1] - pos[ia + 1]
      let dz = pos[ib + 2] - pos[ia + 2]
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (d < 1e-7) continue
      const diff = (d - cRest[i]) / d * cStiff[i]
      const pa = pinned[cA[i]]
      const pb = pinned[cB[i]]
      if (pa && pb) continue
      let wa = 0.5, wb = 0.5
      if (pa) { wa = 0; wb = 1 }
      else if (pb) { wa = 1; wb = 0 }
      dx *= diff; dy *= diff; dz *= diff
      pos[ia] += dx * wa; pos[ia + 1] += dy * wa; pos[ia + 2] += dz * wa
      pos[ib] -= dx * wb; pos[ib + 1] -= dy * wb; pos[ib + 2] -= dz * wb
    }
  }

  private gripSphere: Sphere = { x: 0, y: 0, z: 0, r: 0 }

  setGripSphere(s: Sphere): void {
    this.gripSphere.x = s.x; this.gripSphere.y = s.y
    this.gripSphere.z = s.z; this.gripSphere.r = s.r
  }

  private applyGrip(): void {
    if (this.gripAmount <= 0 || this.gripIdx.length === 0) return
    const s = this.gripSphere
    for (let k = 0; k < this.gripIdx.length; k++) {
      const i = this.gripIdx[k]
      if (this.pinned[i]) continue
      const o = i * 3
      const lo = k * 3
      const lx = this.gripLocal[lo]
      const ly = this.gripLocal[lo + 1]
      const lz = this.gripLocal[lo + 2]
      const rr = this.radiusFor(lx, ly, lz, s.r)
      const tx = s.x + lx * rr
      const ty = s.y + ly * rr
      const tz = s.z + lz * rr
      const w = this.gripWeight[k] * this.gripAmount
      this.pos[o] += (tx - this.pos[o]) * w
      this.pos[o + 1] += (ty - this.pos[o + 1]) * w
      this.pos[o + 2] += (tz - this.pos[o + 2]) * w
    }
  }

  private collide(s: Sphere): void {
    const { pos } = this
    // Broad phase against the largest radius the surface can reach.
    const rMax = this.radiusFn ? s.r * 1.35 : s.r
    const r2 = rMax * rMax
    for (let i = 0; i < this.nodeCount; i++) {
      if (this.pinned[i]) continue
      const o = i * 3
      const dx = pos[o] - s.x
      const dy = pos[o + 1] - s.y
      const dz = pos[o + 2] - s.z
      const d2 = dx * dx + dy * dy + dz * dz
      if (d2 >= r2 || d2 < 1e-12) continue
      const d = Math.sqrt(d2)
      const surface = this.radiusFor(dx / d, dy / d, dz / d, s.r)
      if (d >= surface) continue
      const k = surface / d
      pos[o] = s.x + dx * k
      pos[o + 1] = s.y + dy * k
      pos[o + 2] = s.z + dz * k
    }
  }

  /** Total cord path length from hook to hook, used to derive tautness. */
  get spanLength(): number {
    return this.cfg.panelLength + this.cfg.cordLength * 2 + this.cfg.panelWidth * 0.42
  }
}
