import * as THREE from 'three'
import { approach, clamp01, easeInOut, lerp, smoothstep } from '../core/math'
import { ZONES, type CircuitId } from '../world/layout'

export interface ShotContext {
  /** 0 in a wide landscape frame, 1 in a tall portrait frame. */
  tall: number
  time: number
  rider: THREE.Vector3
  riderSpeed: number
  zone: CircuitId | null
}

interface Frame {
  pos: THREE.Vector3
  target: THREE.Vector3
  fov: number
}

const frame = (): Frame => ({ pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 50 })

type ShotFn = (ctx: ShotContext, out: Frame) => void

/** Blends a wide-frame and a tall-frame version of the same shot. */
function pair(
  wide: [number, number, number, number, number, number, number],
  tall: [number, number, number, number, number, number, number],
): ShotFn {
  return (ctx, out) => {
    const t = ctx.tall
    out.pos.set(lerp(wide[0], tall[0], t), lerp(wide[1], tall[1], t), lerp(wide[2], tall[2], t))
    out.target.set(lerp(wide[3], tall[3], t), lerp(wide[4], tall[4], t), lerp(wide[5], tall[5], t))
    out.fov = lerp(wide[6], tall[6], t)
  }
}

const SHOTS: Record<string, ShotFn> = {
  /* Opening: the slide and the three unlit zones in one three-quarter view. */
  overview: (ctx, out) => {
    const drift = Math.sin(ctx.time * 0.1) * 0.5
    const t = ctx.tall
    out.pos.set(
      lerp(-10.6, -5.2, t) + drift,
      lerp(5.6, 6.4, t),
      lerp(-12.6, -16.4, t) - drift * 0.3,
    )
    out.target.set(lerp(0.6, 0.5, t), lerp(1.3, 0.9, t), lerp(4.2, 5.4, t))
    out.fov = lerp(52, 60, t)
  },

  /* Climbing: a side follow that keeps the safety lamps and the steps legible. */
  climb: (ctx, out) => {
    const t = ctx.tall
    const r = ctx.rider
    out.pos.set(
      r.x + lerp(-3.5, -2.4, t),
      r.y + lerp(1.15, 1.45, t),
      r.z + lerp(-0.8, -1.7, t),
    )
    out.target.set(r.x + 0.15, r.y + lerp(0.45, 0.4, t), r.z + lerp(0.6, 1.0, t))
    out.fov = lerp(50, 62, t)
  },

  /* Seated at the top, looking down the bed. */
  top: (ctx, out) => {
    const t = ctx.tall
    const r = ctx.rider
    out.pos.set(r.x + lerp(-1.6, -0.85, t), r.y + lerp(1.3, 1.5, t), r.z + lerp(-1.85, -2.15, t))
    out.target.set(0, lerp(2.4, 2.0, t), lerp(-7.4, -6.6, t))
    out.fov = lerp(54, 64, t)
  },

  /* The run: body, turning rollers and the path beyond, all in one low frame. */
  ride: (ctx, out) => {
    const t = ctx.tall
    const r = ctx.rider
    out.pos.set(
      lerp(-2.95, -1.9, t),
      r.y + lerp(0.72, 1.05, t),
      r.z + lerp(-1.5, -2.35, t),
    )
    out.target.set(lerp(0.3, 0.25, t), r.y + lerp(0.05, -0.05, t), r.z + lerp(2.4, 3.0, t))
    out.fov = lerp(56, 66, t)
  },

  /* Stopped at the run-out. The new lamps read, but the bed stays in shot. */
  firstLight: pair(
    [-3.3, 1.55, -0.7, 1.1, 0.75, 6.2, 54],
    [-1.5, 1.9, -2.2, 0.7, 0.6, 6.4, 64],
  ),

  /* Rollers, shaft, generator needle and one lamp in a single composition. */
  discovery: pair(
    [-2.1, 0.95, -2.6, -0.35, 0.45, 1.6, 42],
    [-0.2, 1.5, -2.6, 0.4, 0.35, 2.4, 60],
  ),

  /* Selectors in the foreground with the park behind. In a tall frame the shot
     orbits the box slowly so each zone passes through without losing the levers. */
  selector: (ctx, out) => {
    const t = ctx.tall
    const orbit = Math.sin(ctx.time * 0.38) * lerp(0.05, 0.26, t)
    const cx = -2.55
    const cz = 1.72
    const radius = lerp(2.4, 3.5, t)
    const base = lerp(-2.85, -2.72, t)
    const ang = base + orbit
    out.pos.set(cx + Math.sin(ang) * radius, lerp(1.35, 2.15, t), cz + Math.cos(ang) * radius)
    out.target.set(
      cx + Math.sin(ang + Math.PI) * lerp(3.6, 6.4, t) * 0.42,
      lerp(1.05, 0.95, t),
      cz + Math.cos(ang + Math.PI) * lerp(3.6, 6.4, t) * 0.42 + lerp(1.5, 2.6, t),
    )
    out.fov = lerp(60, 68, t)
  },

  /* Wide, human-height view of the park once it carries its own light. */
  finale: (ctx, out) => {
    const t = ctx.tall
    const drift = Math.sin(ctx.time * 0.08) * 0.4
    out.pos.set(lerp(-6.4, -3.2, t) + drift, lerp(2.55, 3.0, t), lerp(-6.2, -9.4, t))
    out.target.set(lerp(1.1, 0.7, t), lerp(1.0, 0.9, t), lerp(6.4, 6.2, t))
    out.fov = lerp(56, 64, t)
  },
}

const REVEALS: Record<CircuitId, ShotFn> = {
  path: pair(
    [-1.9, 2.15, 3.0, 1.9, 0.75, 9.6, 52],
    [-1.2, 2.5, 1.4, 1.6, 0.7, 9.8, 62],
  ),
  pavilion: pair(
    [-2.4, 2.05, 2.6, -7.2, 1.35, 7.1, 52],
    [-2.0, 2.4, 1.2, -7.3, 1.3, 7.1, 62],
  ),
  tree: pair(
    [1.9, 2.35, 3.2, 7.5, 1.9, 8.8, 52],
    [1.6, 2.7, 1.6, 7.5, 1.9, 8.8, 62],
  ),
}

/**
 * Owns the camera outright: gameplay names a shot, and the director eases the
 * lens there. Nothing else is allowed to move the camera, so the chain of shots
 * always reads as one continuous piece of coverage.
 */
export class CameraDirector {
  readonly camera: THREE.PerspectiveCamera

  private readonly from = frame()
  private readonly to = frame()
  private readonly now = frame()
  private shot: ShotFn = SHOTS.overview
  private blend = 1
  private duration = 1
  private elapsed = 0
  private time = 0
  private shake = 0
  private readonly ctx: ShotContext = {
    tall: 0,
    time: 0,
    rider: new THREE.Vector3(),
    riderSpeed: 0,
    zone: null,
  }

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(52, aspect, 0.1, 320)
    this.camera.position.set(-10, 6, -13)
  }

  setViewport(aspect: number, portrait: boolean): void {
    this.camera.aspect = aspect
    // A phone held upright and an iPad in landscape need genuinely different
    // framing, so the blend is driven by the actual aspect, not a boolean.
    this.ctx.tall = portrait ? smoothstep(1.5, 0.72, aspect) : smoothstep(1.5, 0.95, aspect)
    this.camera.updateProjectionMatrix()
  }

  setRider(pos: THREE.Vector3, speed: number): void {
    this.ctx.rider.copy(pos)
    this.ctx.riderSpeed = speed
  }

  /** Starts a transition to a named shot. `duration` of 0 cuts. */
  play(name: keyof typeof SHOTS | string, duration = 1.6): void {
    const next = SHOTS[name]
    if (!next) return
    this.begin(next, duration)
  }

  /** Slow pan to the zone a slide has just charged. */
  reveal(zone: CircuitId, duration = 3.2): void {
    this.ctx.zone = zone
    this.begin(REVEALS[zone], duration)
  }

  private begin(fn: ShotFn, duration: number): void {
    this.from.pos.copy(this.now.pos)
    this.from.target.copy(this.now.target)
    this.from.fov = this.now.fov
    this.shot = fn
    this.duration = Math.max(0.001, duration)
    this.elapsed = 0
    this.blend = duration <= 0 ? 1 : 0
  }

  /** A short, gentle jolt: only ever used when the child lands at the run-out. */
  bump(strength = 1): void {
    this.shake = Math.min(1, this.shake + strength)
  }

  update(dt: number): void {
    this.time += dt
    this.ctx.time = this.time
    this.shot(this.ctx, this.to)

    this.elapsed += dt
    this.blend = clamp01(this.elapsed / this.duration)
    const k = easeInOut(this.blend)

    this.now.pos.lerpVectors(this.from.pos, this.to.pos, k)
    this.now.target.lerpVectors(this.from.target, this.to.target, k)
    this.now.fov = lerp(this.from.fov, this.to.fov, k)

    // A light smoothing pass on top of the blend keeps follow shots from
    // inheriting any jitter in the rider's motion.
    this.camera.position.set(
      approach(this.camera.position.x, this.now.pos.x, 0.045, dt),
      approach(this.camera.position.y, this.now.pos.y, 0.045, dt),
      approach(this.camera.position.z, this.now.pos.z, 0.045, dt),
    )

    if (this.shake > 0.001) {
      this.shake = approach(this.shake, 0, 0.02, dt)
      const s = this.shake * 0.035
      this.camera.position.x += Math.sin(this.time * 41) * s
      this.camera.position.y += Math.sin(this.time * 57) * s
    }

    this.camera.fov = approach(this.camera.fov, this.now.fov, 0.05, dt)
    this.camera.updateProjectionMatrix()
    this.camera.lookAt(this.now.target)
  }

  /** True once the current transition has finished. */
  get settled(): boolean {
    return this.blend >= 1
  }

  get lookTarget(): THREE.Vector3 {
    return this.now.target
  }

  /** Screen-space position of a world point, in 0..1 with the origin top-left. */
  project(point: THREE.Vector3, out: THREE.Vector2): boolean {
    const p = point.clone().project(this.camera)
    out.set((p.x + 1) / 2, (-p.y + 1) / 2)
    return p.z < 1 && Math.abs(p.x) < 1.6 && Math.abs(p.y) < 1.6
  }

  static zoneAnchor(id: CircuitId): THREE.Vector3 {
    return ZONES.find((z) => z.id === id)!.anchor
  }
}
