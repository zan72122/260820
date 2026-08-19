import * as THREE from 'three'
import { chocChunk, dragee, heartShape, starShape } from '../world/geom'
import type { Mats } from '../world/materials'
import { mulberry32, norm, TAU } from '../core/rng'
import { FAST } from '../core/flags'

const G = 981 // cm/s^2 — the scene is authored in centimetres
const DT = 1 / 60
const MAX_STEPS = 3

export const MODE_BOWL = 0
export const MODE_SIM = 1
export const MODE_PARKED = 2

/** Collision environment. Everything is an analytic primitive: no broadphase mesh. */
export interface CavityConfig {
  cavityFloorY: number
  /** Infinity until the lid closes the secret */
  ceilY: number
  holeR: number
  cakeTopY: number
  cakeOuterR: number
  boardY: number
  boardR: number
  tableY: number
  /** true once the wedge has been pulled clear */
  open: boolean
  openA0: number
  openA1: number
  /** while the cake is still open at the top, candies are funnelled into the hole */
  funnel: boolean
  /**
   * 0..1 collapse bias towards the opening once the slice is gone. Ramps up and
   * then fades, which is what gives the spill its shape: a couple of pieces roll
   * out, a short stream follows, and a few stay behind in the cavity.
   */
  drain: number
  /** direction the collapse pushes towards; kept off the slice's exit lane */
  drainAngle: number
}

export interface CandyImpact {
  strength: number
  onCake: boolean
}

const PALETTE = [
  0xe98fa8, // strawberry pink
  0xf0c25c, // lemon
  0x8fc6e6, // sky
  0xb9a0d8, // violet
  0xf5efe2, // sugar white
  0xd98a5f, // caramel
]
const CHOC_COLORS = [0x6a4227, 0x513121, 0x7d5432]

interface ShapeGroup {
  mesh: THREE.InstancedMesh
  ghost: THREE.InstancedMesh
  used: number
}

/**
 * Lightweight candy dynamics: spheres against analytic walls, a uniform grid for
 * pair contacts, fixed timestep, sleeping bodies. Around 80 pieces, four
 * InstancedMeshes, no physics library — it stays smooth on a phone and, more
 * importantly, it never explodes when the slice comes out.
 */
export class CandySystem {
  readonly root = new THREE.Group()
  readonly ghostRoot = new THREE.Group()

  private groups: ShapeGroup[] = []
  private capacity: number
  count = 0

  // state (structure of arrays)
  private px!: Float32Array
  private py!: Float32Array
  private pz!: Float32Array
  private vx!: Float32Array
  private vy!: Float32Array
  private vz!: Float32Array
  private rad!: Float32Array
  private mode!: Uint8Array
  private shape!: Uint8Array
  private slot!: Uint16Array
  private asleep!: Uint8Array
  private sleepT!: Float32Array
  private quat!: Float32Array
  private spin!: Float32Array
  private bowlPos!: Float32Array

  private accumulator = 0
  private grid = new Map<number, number[]>()
  private mat4 = new THREE.Matrix4()
  private qTmp = new THREE.Quaternion()
  private qInc = new THREE.Quaternion()
  private vTmp = new THREE.Vector3()
  private scaleTmp = new THREE.Vector3()

  /** collected each step; the game turns them into ticks and rate-limits them */
  impacts: CandyImpact[] = []

  cfg: CavityConfig = {
    cavityFloorY: 2.4,
    ceilY: Infinity,
    holeR: 3.5,
    cakeTopY: 10.65,
    cakeOuterR: 9.45,
    boardY: 0,
    boardR: 11.6,
    tableY: -3.1,
    open: false,
    openA0: 0,
    openA1: 1,
    funnel: true,
    drain: 0,
    drainAngle: 1,
  }

  constructor(mats: Mats, maxCount = FAST ? 46 : 84) {
    this.capacity = maxCount
    const r = 0.62
    const geos = [dragee(r), starShape(r * 1.15), heartShape(r * 1.05), chocChunk(r * 0.95)]
    const matsFor = [mats.sugarShell, mats.sugarSoft, mats.sugarSoft, mats.chocolate]

    for (let s = 0; s < geos.length; s++) {
      const mesh = new THREE.InstancedMesh(geos[s], matsFor[s], maxCount)
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.castShadow = !FAST
      mesh.receiveShadow = !FAST
      mesh.frustumCulled = false
      mesh.count = maxCount
      const colors = new Float32Array(maxCount * 3)
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3)
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage)

      const ghostMat = mats.ghost.clone()
      ghostMat.vertexColors = false
      const ghost = new THREE.InstancedMesh(geos[s], ghostMat, maxCount)
      ghost.instanceMatrix = mesh.instanceMatrix
      ghost.instanceColor = mesh.instanceColor
      ghost.frustumCulled = false
      ghost.renderOrder = 12
      ghost.count = maxCount

      this.groups.push({ mesh, ghost, used: 0 })
      this.root.add(mesh)
      this.ghostRoot.add(ghost)
    }
    this.ghostRoot.visible = false
    this.allocate()
  }

  private allocate() {
    const n = this.capacity
    this.px = new Float32Array(n)
    this.py = new Float32Array(n)
    this.pz = new Float32Array(n)
    this.vx = new Float32Array(n)
    this.vy = new Float32Array(n)
    this.vz = new Float32Array(n)
    this.rad = new Float32Array(n)
    this.mode = new Uint8Array(n)
    this.shape = new Uint8Array(n)
    this.slot = new Uint16Array(n)
    this.asleep = new Uint8Array(n)
    this.sleepT = new Float32Array(n)
    this.quat = new Float32Array(n * 4)
    this.spin = new Float32Array(n * 4) // axis xyz + speed
    this.bowlPos = new Float32Array(n * 3)
  }

  /**
   * Fresh batch of candy for a new play: colour mix, shape mix and amount all
   * shift a little, so the second cake is not the first one again.
   */
  reset(seed: number) {
    const rng = mulberry32(seed >>> 0 || 1)
    const n = Math.min(
      this.capacity,
      FAST ? this.capacity : 62 + Math.floor(rng() * (this.capacity - 62)),
    )
    this.count = n
    this.accumulator = 0
    this.impacts.length = 0
    for (const g of this.groups) g.used = 0

    // rotate the palette a little each play
    const shift = Math.floor(rng() * PALETTE.length)
    const shapeWeights = [0.44, 0.16 + rng() * 0.1, 0.14 + rng() * 0.1, 0.18]
    const total = shapeWeights.reduce((a, b) => a + b, 0)

    // a shallow dome of candy sitting inside the bowl
    let placed = 0
    let ring = 0
    const colorObj = new THREE.Color()

    for (let i = 0; i < n; i++) {
      let pick = rng() * total
      let s = 0
      while (s < 3 && pick > shapeWeights[s]) {
        pick -= shapeWeights[s]
        s++
      }
      this.shape[i] = s
      const g = this.groups[s]
      this.slot[i] = g.used++

      const r = (s === 3 ? 0.56 : 0.6) + rng() * 0.16
      this.rad[i] = r

      const color =
        s === 3
          ? CHOC_COLORS[Math.floor(rng() * CHOC_COLORS.length)]
          : PALETTE[(Math.floor(rng() * PALETTE.length) + shift) % PALETTE.length]
      colorObj.set(color)
      colorObj.convertSRGBToLinear()
      const ci = this.slot[i] * 3
      g.mesh.instanceColor!.array[ci] = colorObj.r
      g.mesh.instanceColor!.array[ci + 1] = colorObj.g
      g.mesh.instanceColor!.array[ci + 2] = colorObj.b

      // bowl pile position: rings that follow the bowl's inner wall, so no piece
      // ever floats outside the ceramic
      const perRing = 6 + ring * 5
      const a = (placed / perRing) * TAU + ring * 0.7
      const rr = Math.min(4.15, ring * 1.02 + rng() * 0.22)
      const innerY = rr < 2.9 ? 0.52 + rr * 0.08 : 0.75 + (rr - 2.9) * 0.85
      this.bowlPos[i * 3] = Math.cos(a) * rr
      this.bowlPos[i * 3 + 1] = Math.max(innerY + 0.62, 1.45 + ring * 0.06) + rng() * 0.1
      this.bowlPos[i * 3 + 2] = Math.sin(a) * rr
      placed++
      if (placed >= perRing) {
        placed = 0
        ring++
      }

      this.mode[i] = MODE_BOWL
      this.asleep[i] = 0
      this.sleepT[i] = 0
      this.vx[i] = this.vy[i] = this.vz[i] = 0
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(rng() * TAU, rng() * TAU, rng() * TAU),
      )
      this.quat[i * 4] = q.x
      this.quat[i * 4 + 1] = q.y
      this.quat[i * 4 + 2] = q.z
      this.quat[i * 4 + 3] = q.w
      const ax = rng() * 2 - 1
      const ay = rng() * 2 - 1
      const az = rng() * 2 - 1
      const len = Math.hypot(ax, ay, az) || 1
      this.spin[i * 4] = ax / len
      this.spin[i * 4 + 1] = ay / len
      this.spin[i * 4 + 2] = az / len
      this.spin[i * 4 + 3] = 0
    }

    for (const g of this.groups) {
      g.mesh.count = g.used
      g.ghost.count = g.used
      g.mesh.instanceColor!.needsUpdate = true
      // park unused instances out of sight
      for (let k = g.used; k < this.capacity; k++) {
        this.mat4.makeScale(0, 0, 0)
        g.mesh.setMatrixAt(k, this.mat4)
      }
      g.mesh.instanceMatrix.needsUpdate = true
    }
    this.cfg.open = false
    this.cfg.ceilY = Infinity
    this.cfg.funnel = true
    this.cfg.drain = 0
  }

  /* ---------------------------------------------------------------- */

  get inBowl() {
    let c = 0
    for (let i = 0; i < this.count; i++) if (this.mode[i] === MODE_BOWL) c++
    return c
  }

  get poured() {
    let c = 0
    for (let i = 0; i < this.count; i++) if (this.mode[i] !== MODE_BOWL) c++
    return c
  }

  /** Candies that have left the cake footprint — the payoff of the reveal. */
  get spilled() {
    let c = 0
    for (let i = 0; i < this.count; i++) {
      if (this.mode[i] !== MODE_SIM) continue
      const r = Math.hypot(this.px[i], this.pz[i])
      // out of the cavity means below its floor, or clear of the cake entirely
      if (this.py[i] < this.cfg.cavityFloorY - 0.5 || r > this.cfg.cakeOuterR + 0.3) c++
    }
    return c
  }

  /** Non-sleeping pieces — used to know when the spill has finished. */
  get moving() {
    let c = 0
    for (let i = 0; i < this.count; i++)
      if (this.mode[i] === MODE_SIM && !this.asleep[i]) c++
    return c
  }

  get inCavity() {
    let c = 0
    for (let i = 0; i < this.count; i++) {
      if (this.mode[i] !== MODE_SIM) continue
      const r = Math.hypot(this.px[i], this.pz[i])
      if (r < this.cfg.holeR + 0.2 && this.py[i] > this.cfg.cavityFloorY - 0.3) c++
    }
    return c
  }

  /** Move one piece from the bowl into the world at `p` with velocity `v`. */
  pourOne(p: THREE.Vector3, v: THREE.Vector3, jitter = 1): boolean {
    let best = -1
    let bestY = -Infinity
    for (let i = 0; i < this.count; i++) {
      if (this.mode[i] !== MODE_BOWL) continue
      const y = this.bowlPos[i * 3 + 1] - Math.hypot(this.bowlPos[i * 3], this.bowlPos[i * 3 + 2]) * 0.12
      if (y > bestY) {
        bestY = y
        best = i
      }
    }
    if (best < 0) return false
    const i = best
    this.mode[i] = MODE_SIM
    this.asleep[i] = 0
    this.sleepT[i] = 0
    this.px[i] = p.x + (Math.random() - 0.5) * 0.9 * jitter
    this.py[i] = p.y
    this.pz[i] = p.z + (Math.random() - 0.5) * 0.9 * jitter
    this.vx[i] = v.x + (Math.random() - 0.5) * 6
    this.vy[i] = v.y
    this.vz[i] = v.z + (Math.random() - 0.5) * 6
    this.spin[i * 4 + 3] = 6 + Math.random() * 8
    return true
  }

  /** Called when the lid goes on: nothing may be left standing on the rim. */
  tuckStrays() {
    for (let i = 0; i < this.count; i++) {
      if (this.mode[i] !== MODE_SIM) continue
      const r = Math.hypot(this.px[i], this.pz[i])
      if (r < this.cfg.holeR - this.rad[i]) continue
      const a = Math.atan2(this.pz[i], this.px[i])
      const nr = (this.cfg.holeR - this.rad[i]) * 0.7
      this.px[i] = Math.cos(a) * nr
      this.pz[i] = Math.sin(a) * nr
      this.py[i] = Math.max(this.py[i], this.cfg.cavityFloorY + this.rad[i] + 1.4)
      this.vx[i] = this.vz[i] = 0
      this.vy[i] = -4
      this.asleep[i] = 0
    }
  }

  wakeAll() {
    for (let i = 0; i < this.count; i++) {
      if (this.mode[i] !== MODE_SIM) continue
      this.asleep[i] = 0
      this.sleepT[i] = 0
    }
  }

  /* ---------------------------------------------------------------- */

  update(dt: number, bowlMatrix: THREE.Matrix4, bowlShake: number) {
    this.impacts.length = 0
    this.accumulator = Math.min(this.accumulator + dt, DT * MAX_STEPS)
    let steps = 0
    while (this.accumulator >= DT && steps < MAX_STEPS) {
      this.step(DT)
      this.accumulator -= DT
      steps++
    }
    this.writeMatrices(bowlMatrix, bowlShake, dt)
  }

  private step(dt: number) {
    const c = this.cfg
    for (let i = 0; i < this.count; i++) {
      if (this.mode[i] !== MODE_SIM || this.asleep[i]) continue
      this.vy[i] -= G * dt
      // a whisper of air drag; keeps a crowded pile from buzzing forever
      this.vx[i] *= 0.995
      this.vz[i] *= 0.995
      this.px[i] += this.vx[i] * dt
      this.py[i] += this.vy[i] * dt
      this.pz[i] += this.vz[i] * dt
      this.resolveWorld(i, c)
    }
    this.collidePairs()
    // sleep bookkeeping
    for (let i = 0; i < this.count; i++) {
      if (this.mode[i] !== MODE_SIM || this.asleep[i]) continue
      const sp = this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i] + this.vz[i] * this.vz[i]
      if (c.drain > 0.05 && Math.hypot(this.px[i], this.pz[i]) < c.holeR + 1) {
        this.sleepT[i] = 0
        continue
      }
      if (sp < 55) {
        this.sleepT[i] += dt
        if (this.sleepT[i] > 0.3) {
          this.asleep[i] = 1
          this.vx[i] = this.vy[i] = this.vz[i] = 0
          this.spin[i * 4 + 3] = 0
        }
      } else {
        this.sleepT[i] = 0
      }
      if (this.py[i] < c.tableY - 25) {
        this.mode[i] = MODE_PARKED
      }
    }
  }

  private inOpening(a: number) {
    const c = this.cfg
    const s = norm(a - c.openA0)
    const span = norm(c.openA1 - c.openA0)
    return s <= span
  }

  private resolveWorld(i: number, c: CavityConfig) {
    const rad = this.rad[i]
    let x = this.px[i]
    let y = this.py[i]
    let z = this.pz[i]
    const rr = Math.hypot(x, z) || 1e-5
    const ang = Math.atan2(z, x)
    let floorY: number
    let onCake = false

    // Note: no height test here. A piece hovering above the hole still belongs to
    // the cavity branch, and a piece squeezed *into* the sponge by its neighbours
    // has to be pushed back into the cavity rather than lifted onto the cake.
    const withinCake = rr < c.cakeOuterR + rad

    if (withinCake) {
      const open = c.open && this.inOpening(ang)
      if (open) {
        // the wedge void: bounded only by the two radial cut faces
        if (rr > 1.7) {
          const half = norm(c.openA1 - c.openA0) / 2
          const mid = c.openA0 + half
          let d = ang - mid
          while (d > Math.PI) d -= TAU
          while (d < -Math.PI) d += TAU
          const limit = half - Math.asin(Math.min(0.95, rad / rr))
          if (limit > 0 && Math.abs(d) > limit) {
            const na = mid + Math.sign(d) * limit
            x = Math.cos(na) * rr
            z = Math.sin(na) * rr
            // kill the tangential component so candy slides along the cut face
            const tx = -Math.sin(na)
            const tz = Math.cos(na)
            const vt = this.vx[i] * tx + this.vz[i] * tz
            this.vx[i] = tx * vt * 0.72
            this.vz[i] = tz * vt * 0.72
          }
        } else {
          // right at the apex: nudge outwards so the pile drains rather than jams
          this.vx[i] += Math.cos((c.openA0 + c.openA1) / 2) * 34 * DT
          this.vz[i] += Math.sin((c.openA0 + c.openA1) / 2) * 34 * DT
        }
        floorY = c.boardY
        onCake = true
      } else if (rr < c.holeR) {
        const maxR = c.holeR - rad
        if (rr > maxR) {
          const nx = x / rr
          const nz = z / rr
          x = nx * maxR
          z = nz * maxR
          const vn = this.vx[i] * nx + this.vz[i] * nz
          if (vn > 0) {
            this.vx[i] -= nx * vn * 1.35
            this.vz[i] -= nz * vn * 1.35
            if (vn > 40) this.impacts.push({ strength: vn / 260, onCake: true })
          }
        }
        floorY = c.cavityFloorY
        onCake = true
        if (c.drain > 0.02) {
          // the pile leans towards the opening instead of standing in a column
          this.vx[i] += Math.cos(c.drainAngle) * 58 * c.drain * DT
          this.vz[i] += Math.sin(c.drainAngle) * 58 * c.drain * DT
        }
        if (c.ceilY < Infinity && y + rad > c.ceilY) {
          y = c.ceilY - rad
          if (this.vy[i] > 0) this.vy[i] *= -0.2
        }
      } else if (y + rad > c.cakeTopY - 0.7) {
        // resting on (or falling towards) the cake surface
        floorY = c.cakeTopY
        onCake = true
        if (c.funnel && rr < c.holeR + 2.6) {
          // generous, invisible funnel: aiming is forgiving for small hands
          const pull = 46 * DT * (1 - (rr - c.holeR) / 2.6)
          this.vx[i] -= (x / rr) * pull
          this.vz[i] -= (z / rr) * pull
        }
      } else {
        // inside the sponge: a neighbour pushed it through the cavity wall, so
        // slide it back in rather than letting it climb out on top of the cake
        const maxR = Math.max(0.1, c.holeR - rad)
        x = (x / rr) * maxR
        z = (z / rr) * maxR
        this.vx[i] *= 0.3
        this.vz[i] *= 0.3
        floorY = c.cavityFloorY
        onCake = true
      }
    } else {
      const boardR = c.boardR
      floorY = rr < boardR ? c.boardY : c.tableY
      if (rr > boardR - rad && rr < boardR + rad && y - rad < c.boardY) {
        // roll off the rim of the board instead of clipping through it
        floorY = c.boardY
      }
    }

    if (y - rad < floorY) {
      const impact = -this.vy[i]
      y = floorY + rad
      if (this.vy[i] < 0) {
        this.vy[i] *= -0.24
        if (Math.abs(this.vy[i]) < 12) this.vy[i] = 0
        const fr = 0.72
        this.vx[i] *= fr
        this.vz[i] *= fr
        if (Math.hypot(this.vx[i], this.vz[i]) < 4) {
          this.vx[i] = 0
          this.vz[i] = 0
        }
        if (impact > 45) this.impacts.push({ strength: Math.min(1, impact / 320), onCake })
      }
    }

    this.px[i] = x
    this.py[i] = y
    this.pz[i] = z
  }

  private cellKey(x: number, z: number) {
    const cx = Math.floor(x / 1.9) + 512
    const cz = Math.floor(z / 1.9) + 512
    return cx * 1024 + cz
  }

  private collidePairs() {
    const grid = this.grid
    grid.clear()
    for (let i = 0; i < this.count; i++) {
      if (this.mode[i] !== MODE_SIM) continue
      const k = this.cellKey(this.px[i], this.pz[i])
      let list = grid.get(k)
      if (!list) grid.set(k, (list = []))
      list.push(i)
    }
    const neighbours: number[] = []
    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < this.count; i++) {
        if (this.mode[i] !== MODE_SIM) continue
        neighbours.length = 0
        const cx = Math.floor(this.px[i] / 1.9) + 512
        const cz = Math.floor(this.pz[i] / 1.9) + 512
        for (let a = -1; a <= 1; a++)
          for (let b = -1; b <= 1; b++) {
            const list = grid.get((cx + a) * 1024 + (cz + b))
            if (list) for (const j of list) if (j > i) neighbours.push(j)
          }
        for (const j of neighbours) {
          let dx = this.px[j] - this.px[i]
          let dy = this.py[j] - this.py[i]
          let dz = this.pz[j] - this.pz[i]
          const minD = this.rad[i] + this.rad[j]
          const d2 = dx * dx + dy * dy + dz * dz
          if (d2 >= minD * minD || d2 < 1e-8) continue
          const d = Math.sqrt(d2)
          const nx = dx / d
          const ny = dy / d
          const nz = dz / d
          const pen = (minD - d) * 0.5
          const iAsleep = this.asleep[i] === 1
          const jAsleep = this.asleep[j] === 1
          const wi = iAsleep && !jAsleep ? 0 : jAsleep && !iAsleep ? 1 : 0.5
          const wj = 1 - wi
          this.px[i] -= nx * pen * 2 * wi
          this.py[i] -= ny * pen * 2 * wi
          this.pz[i] -= nz * pen * 2 * wi
          this.px[j] += nx * pen * 2 * wj
          this.py[j] += ny * pen * 2 * wj
          this.pz[j] += nz * pen * 2 * wj

          const rvx = this.vx[j] - this.vx[i]
          const rvy = this.vy[j] - this.vy[i]
          const rvz = this.vz[j] - this.vz[i]
          const vn = rvx * nx + rvy * ny + rvz * nz
          if (vn < 0) {
            const imp = -vn * 0.34
            this.vx[i] -= nx * imp * wi * 2
            this.vy[i] -= ny * imp * wi * 2
            this.vz[i] -= nz * imp * wi * 2
            this.vx[j] += nx * imp * wj * 2
            this.vy[j] += ny * imp * wj * 2
            this.vz[j] += nz * imp * wj * 2
            if (-vn > 90 && iter === 0)
              this.impacts.push({ strength: Math.min(1, -vn / 400), onCake: false })
          }
          // a moving piece wakes what it lands on
          if (iAsleep && !jAsleep) {
            this.asleep[i] = 0
            this.sleepT[i] = 0
          }
          if (jAsleep && !iAsleep) {
            this.asleep[j] = 0
            this.sleepT[j] = 0
          }
        }
      }
    }
  }

  /* ---------------------------------------------------------------- */

  private writeMatrices(bowlMatrix: THREE.Matrix4, bowlShake: number, dt: number) {
    for (const g of this.groups) g.mesh.instanceMatrix.needsUpdate = true
    const BASE_R = 0.62

    for (let i = 0; i < this.count; i++) {
      const g = this.groups[this.shape[i]]
      const slot = this.slot[i]
      const m = this.mode[i]
      if (m === MODE_PARKED) {
        this.mat4.makeScale(0, 0, 0)
        g.mesh.setMatrixAt(slot, this.mat4)
        continue
      }
      this.qTmp.set(
        this.quat[i * 4],
        this.quat[i * 4 + 1],
        this.quat[i * 4 + 2],
        this.quat[i * 4 + 3],
      )
      if (m === MODE_BOWL) {
        const j = bowlShake * 0.16
        this.vTmp.set(
          this.bowlPos[i * 3] + (Math.random() - 0.5) * j,
          this.bowlPos[i * 3 + 1],
          this.bowlPos[i * 3 + 2] + (Math.random() - 0.5) * j,
        )
        this.vTmp.applyMatrix4(bowlMatrix)
      } else {
        this.vTmp.set(this.px[i], this.py[i], this.pz[i])
        // rolling: spin about the axis perpendicular to travel
        const speed = Math.hypot(this.vx[i], this.vz[i])
        if (speed > 2 && !this.asleep[i]) {
          const ax = -this.vz[i] / speed
          const az = this.vx[i] / speed
          this.qInc.setFromAxisAngle(
            this.vTmp.set(ax, 0, az).normalize(),
            (speed / Math.max(0.3, this.rad[i])) * dt * 0.55,
          )
          this.qTmp.premultiply(this.qInc)
          this.qTmp.normalize()
          this.quat[i * 4] = this.qTmp.x
          this.quat[i * 4 + 1] = this.qTmp.y
          this.quat[i * 4 + 2] = this.qTmp.z
          this.quat[i * 4 + 3] = this.qTmp.w
          this.vTmp.set(this.px[i], this.py[i], this.pz[i])
        } else if (this.spin[i * 4 + 3] > 0.01 && !this.asleep[i]) {
          const s = this.spin
          this.qInc.setFromAxisAngle(
            this.vTmp.set(s[i * 4], s[i * 4 + 1], s[i * 4 + 2]).normalize(),
            s[i * 4 + 3] * dt,
          )
          this.qTmp.premultiply(this.qInc)
          this.qTmp.normalize()
          this.quat[i * 4] = this.qTmp.x
          this.quat[i * 4 + 1] = this.qTmp.y
          this.quat[i * 4 + 2] = this.qTmp.z
          this.quat[i * 4 + 3] = this.qTmp.w
          s[i * 4 + 3] *= 0.985
          this.vTmp.set(this.px[i], this.py[i], this.pz[i])
        }
      }
      const k = this.rad[i] / BASE_R
      this.mat4.compose(this.vTmp, this.qTmp, this.scaleTmp.set(k, k, k))
      g.mesh.setMatrixAt(slot, this.mat4)
    }
  }

  /** Flat snapshot for headless diagnostics. */
  dump() {
    const out: Array<[number, number, number, number, number]> = []
    for (let i = 0; i < this.count; i++)
      out.push([
        Math.round(this.px[i] * 10) / 10,
        Math.round(this.py[i] * 10) / 10,
        Math.round(this.pz[i] * 10) / 10,
        this.mode[i],
        this.asleep[i],
      ])
    return out
  }

  setGhostVisible(v: boolean) {
    this.ghostRoot.visible = v
  }
}
