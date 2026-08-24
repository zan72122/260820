import { L } from './layout'
import { clamp, lerp, smoothstep, moveToward, mulberry32 } from './util'

// Game simulation. Kinematic hoist control with a small damped-pendulum sway
// layered on top. Weight transfer between supports (trailer cribbing / bogie
// air springs) and the sling rig is modelled explicitly as a continuous
// elastic zone so tension, gaps and settling all read in the visuals.

export enum Phase {
  LIFT = 'LIFT',           // slack -> tension -> liftoff -> raise to clearance
  TRANSPORT = 'TRANSPORT', // traverse toward the beam (vertical still allowed)
  DESCEND = 'DESCEND',     // lower toward the bogies, final segment auto-slow
  SEATED = 'SEATED',       // weight fully on bogies, slings slack
  UNHOOK = 'UNHOOK',       // riggers detach slings, hooks rise clear
  LIGHTS = 'LIGHTS',       // car wakes up
  MOVER_IN = 'MOVER_IN',   // vehicle mover approaches and couples
  TOW = 'TOW',             // car + bogies roll toward the inspection hall
  RESET = 'RESET'          // next body arrives
}

export interface SimEvents {
  onContact(impact: number): void
  onLiftoff(): void
  onSeated(): void
  onDetach(): void
  onCouple(): void
  onPhase(p: Phase): void
}

const RIG_TOTAL = L.spreaderDrop + L.slingLen + 0.48  // hook Y -> car underframe Y when hanging
const STRETCH = 0.06                                   // elastic zone of the rig (visual weight transfer)
const G = 9.81

export interface RoundVariation {
  stripe1: string, stripe2: string
  sunAzim: number, sunElev: number, sunIntensity: number, ambient: number, skyTint: number
  startZOff: number
  startHookLift: number
}

const PALETTES: [string, string][] = [
  ['#2565a8', '#7fb5e0'],   // urban blue
  ['#2c8a5f', '#9fd4b8'],   // fresh green
  ['#c25a28', '#e8b48f'],   // sunset orange
  ['#5a5fa8', '#b7b9e0']    // twilight violet
]

export class Sim {
  phase: Phase = Phase.LIFT
  round = 0
  variation: RoundVariation

  // commanded rig state
  hookY = 0            // average commanded hook height
  carrierZ = 0         // commanded hook Z (both cranes move together)
  winchVel = 0
  carrierVel = 0
  winchCmd = 0         // -1..1 target from input
  carrierCmd = 0

  // per-crane synchronization error (small, decaying)
  syncErr = [0, 0]

  // derived car state
  carY = 0             // underframe bottom height
  carZ = 0
  carX = 0             // only changes during TOW
  tension = 0          // 0..1 load on rig
  slack = 0            // meters of slack in slings
  airborne = false
  springComp = 0       // 0..1 bogie air spring compression
  trailerUnload = 0    // 0..1 trailer springs extended

  // sway (pendulum along Z + tiny X), tilt from crane sync
  swayAngZ = 0; swayVelZ = 0
  swayAngX = 0; swayVelX = 0
  pitch = 0; roll = 0

  // phase sequencing
  timer = 0
  moverX = -34
  towDist = 0
  lightsOn = false
  rigAttached = true
  hookParkY = 0
  workersApproach = 0  // 0..1 riggers walk in to unhook

  private rng: () => number
  private startZ: number
  private prevCarrierVel = 0
  private everAirborne = false

  constructor(public events: SimEvents, public seed = 1) {
    this.rng = mulberry32(seed)
    this.variation = this.makeVariation(0)
    this.startZ = L.carStartZ + this.variation.startZOff
    this.resetCar()
  }

  private makeVariation(round: number): RoundVariation {
    const r = mulberry32(this.seed * 1000 + round * 17 + 3)
    const pal = PALETTES[round % PALETTES.length]
    // morning / midday / late-afternoon / bright-overcast rotation
    const kinds = [
      { azim: 0.9, elev: 0.9, int: 2.6, amb: 0.75, tint: 0 },
      { azim: -0.6, elev: 0.55, int: 2.2, amb: 0.7, tint: 1 },
      { azim: -1.9, elev: 0.32, int: 1.9, amb: 0.62, tint: 2 },
      { azim: 0.4, elev: 0.75, int: 1.35, amb: 0.95, tint: 3 }
    ]
    const k = kinds[round % kinds.length]
    return {
      stripe1: pal[0], stripe2: pal[1],
      sunAzim: k.azim + (r() - 0.5) * 0.3,
      sunElev: k.elev,
      sunIntensity: k.int,
      ambient: k.amb,
      skyTint: k.tint,
      startZOff: (r() - 0.5) * 0.7,
      startHookLift: 0.5 + r() * 0.5
    }
  }

  private resetCar() {
    const v = this.variation
    this.startZ = L.carStartZ + v.startZOff
    this.carY = L.startUndersideY
    this.carZ = this.startZ
    this.carX = 0
    this.carrierZ = this.startZ
    // hook parked with visible slack in the slings
    this.hookY = L.startUndersideY + RIG_TOTAL - 0.14 - v.startHookLift * 0.12
    this.winchVel = 0; this.carrierVel = 0
    this.tension = 0; this.slack = 0.14
    this.airborne = false
    this.everAirborne = false
    this.springComp = 0
    this.trailerUnload = 0
    this.swayAngZ = this.swayVelZ = this.swayAngX = this.swayVelX = 0
    this.pitch = this.roll = 0
    this.timer = 0
    this.moverX = -34
    this.towDist = 0
    this.syncErr = [0, 0]
    this.lightsOn = false
    this.rigAttached = true
    this.workersApproach = 0
    this.phase = Phase.LIFT
  }

  // Input: normalized commands in [-1, 1]. vertical: + = raise. horizontal: + = toward beam (world -Z).
  setInput(vertical: number, horizontal: number) {
    this.winchCmd = clamp(vertical, -1, 1)
    this.carrierCmd = clamp(horizontal, -1, 1)
  }

  private supportHeight(): { y: number, kind: 'trailer' | 'bogie' | 'none' } {
    if (Math.abs(this.carZ - this.startZ) < 0.9 && !this.everAirborneOnBeam()) {
      return { y: L.startUndersideY, kind: 'trailer' }
    }
    if (Math.abs(this.carZ) < 0.45) {
      // bogie air springs float at free height; compress as load transfers
      return { y: L.dockUndersideY + L.springTravel * (1 - this.springComp), kind: 'bogie' }
    }
    return { y: -10, kind: 'none' }
  }
  private everAirborneOnBeam() { return false } // trailer zone stays valid; re-seating on cribbing is allowed

  get inDockZone() { return Math.abs(this.carZ) < 0.45 }
  get nearDock() { return this.inDockZone && this.carY < L.clearHeight - 0.2 }
  get finalDescent() { return this.inDockZone && this.airborne && (this.carY - (L.dockUndersideY + L.springTravel)) < 0.42 }

  update(dt: number) {
    dt = Math.min(dt, 1 / 20)
    const interactive = this.phase === Phase.LIFT || this.phase === Phase.TRANSPORT || this.phase === Phase.DESCEND
    if (interactive) this.updateLift(dt)
    else this.updateSequence(dt)
    this.updateSway(dt)
  }

  private updateLift(dt: number) {
    const sup = this.supportHeight()

    // ---- winch (vertical) ----
    // Speed caps: deliberate while tension builds, slow in the final 40 cm.
    let maxUp = 0.55, maxDown = 0.5
    if (!this.airborne) {
      maxUp = 0.16                                         // weight-transfer zone reads clearly
    } else if (sup.kind !== 'none' && this.carY - sup.y < 0.7) {
      maxUp = 0.2                                          // first tens of cm: a deliberate trial lift
    }
    if (this.finalDescent) maxDown = 0.11                  // last 40 cm: creep speed
    else if (this.nearDock) maxDown = 0.3
    const targetVel = this.winchCmd >= 0 ? this.winchCmd * maxUp : this.winchCmd * maxDown
    this.winchVel = moveToward(this.winchVel, targetVel, 0.9 * dt)
    this.hookY += this.winchVel * dt

    // winch limits
    const zoneMinCar = sup.kind === 'none' ? L.beamTopY + L.bolsterTopAboveBeam + 0.55 : sup.y
    const minHook = (sup.kind === 'none' ? zoneMinCar + RIG_TOTAL : sup.y + RIG_TOTAL - 0.30)
    const maxHook = L.maxLiftY + RIG_TOTAL
    this.hookY = clamp(this.hookY, minHook, maxHook)

    // ---- rig elasticity & weight transfer ----
    const hookRel = this.hookY - (sup.y + RIG_TOTAL)
    const wasAirborne = this.airborne
    const prevTension = this.tension
    if (sup.kind === 'none') {
      this.airborne = true
      this.tension = 1
      this.slack = 0
      this.carY = this.hookY - RIG_TOTAL - STRETCH
    } else if (hookRel <= 0) {
      this.airborne = false
      this.tension = 0
      this.slack = -hookRel + 0.02
      this.carY = sup.y
    } else if (hookRel < STRETCH) {
      this.airborne = false
      this.tension = hookRel / STRETCH
      this.slack = 0
      this.carY = sup.y
    } else {
      this.airborne = true
      this.tension = 1
      this.slack = 0
      this.carY = this.hookY - RIG_TOTAL - STRETCH
    }

    // support-specific responses to load transfer
    if (sup.kind === 'trailer') {
      this.trailerUnload = this.airborne ? 1 : this.tension
    }
    if (sup.kind === 'bogie') {
      // springs compress as tension drops (weight moving onto the bogies)
      this.springComp = clamp(1 - this.tension, 0, 1)
      if (wasAirborne && !this.airborne) this.events.onContact(Math.max(0.25, Math.abs(this.winchVel) * 3))
      if (!this.airborne && this.slack > 0.1) {
        this.phase = Phase.SEATED
        this.timer = 0
        this.winchCmd = this.carrierCmd = 0
        this.hookParkY = this.hookY
        this.events.onSeated()
        this.events.onPhase(this.phase)
        return
      }
    } else {
      this.springComp = 0
    }
    if (!wasAirborne && this.airborne) this.events.onLiftoff()

    // ---- phase bookkeeping for camera/hints ----
    if (this.phase === Phase.LIFT && this.airborne && this.carY >= L.clearHeight) {
      this.phase = Phase.TRANSPORT
      this.events.onPhase(this.phase)
    }
    if (this.phase === Phase.TRANSPORT && this.inDockZone && this.carY < L.clearHeight - 0.25 && this.winchCmd < -0.05) {
      this.phase = Phase.DESCEND
      this.events.onPhase(this.phase)
    }
    if (this.phase === Phase.DESCEND && (!this.inDockZone || this.carY > L.clearHeight + 0.3)) {
      this.phase = Phase.TRANSPORT
      this.events.onPhase(this.phase)
    }

    // ---- carrier (horizontal traverse) ----
    const canTraverse = this.airborne && this.carY >= L.clearHeight - 0.35
    const travCmd = canTraverse ? this.carrierCmd : 0
    this.prevCarrierVel = this.carrierVel
    const maxTrav = 0.85
    this.carrierVel = moveToward(this.carrierVel, -travCmd * maxTrav, 0.55 * dt)
    this.carrierZ += this.carrierVel * dt
    this.carrierZ = clamp(this.carrierZ, -0.45, this.startZ + 1.2)

    // alignment funnel: guide structures center the car during the final descent
    if (this.airborne && this.inDockZoneApproach()) {
      const h = this.carY - (L.dockUndersideY + L.springTravel)
      const maxOff = lerp(0.02, 0.75, smoothstep(0.0, 1.4, h))
      if (Math.abs(this.carrierZ) > maxOff) {
        this.carrierZ = moveToward(this.carrierZ, Math.sign(this.carrierZ) * maxOff, 0.35 * dt)
      }
      // near the pin, ease truly to center
      if (h < 0.35) this.carrierZ = moveToward(this.carrierZ, 0, 0.06 * dt * smoothstep(0.35, 0.05, h))
    }
  }

  private inDockZoneApproach() { return Math.abs(this.carrierZ) < 1.0 && this.carY < L.clearHeight }

  private updateSequence(dt: number) {
    this.timer += dt
    switch (this.phase) {
      case Phase.SEATED: {
        // crane pays out a little more line; slack grows, then riggers walk in
        this.hookY = Math.max(this.hookParkY - 0.22, this.hookY - 0.1 * dt)
        this.slack = Math.min(0.3, this.slack + 0.1 * dt)
        this.springComp = 1
        this.carY = L.dockUndersideY
        if (this.timer > 0.8) this.workersApproach = clamp(this.workersApproach + dt / 4.5, 0, 1)
        if (this.timer > 6.5) {
          this.phase = Phase.UNHOOK
          this.timer = 0
          this.rigAttached = false
          this.events.onDetach()
          this.events.onPhase(this.phase)
        }
        break
      }
      case Phase.UNHOOK: {
        // hooks + spreaders rise clear of the roof
        this.hookY = Math.min(this.hookY + 0.75 * dt, L.maxLiftY + RIG_TOTAL + 2.4)
        this.workersApproach = clamp(this.workersApproach - dt / 1.5, 0, 1)
        if (this.timer > 2.6) {
          this.phase = Phase.LIGHTS
          this.timer = 0
          this.events.onPhase(this.phase)
        }
        break
      }
      case Phase.LIGHTS: {
        this.hookY = Math.min(this.hookY + 0.75 * dt, L.maxLiftY + RIG_TOTAL + 2.4)
        if (this.timer > 0.7 && !this.lightsOn) this.lightsOn = true
        if (this.timer > 2.2) {
          this.phase = Phase.MOVER_IN
          this.timer = 0
          this.events.onPhase(this.phase)
        }
        break
      }
      case Phase.MOVER_IN: {
        this.hookY = Math.min(this.hookY + 0.75 * dt, L.maxLiftY + RIG_TOTAL + 2.4)
        const targetX = this.carX - L.carLength / 2 - 2.35
        this.moverX = moveToward(this.moverX, targetX, 1.6 * dt)
        if (this.moverX >= targetX - 0.001) {
          this.events.onCouple()
          this.phase = Phase.TOW
          this.timer = 0
          this.events.onPhase(this.phase)
        }
        break
      }
      case Phase.TOW: {
        const speed = Math.min(2.2, 0.3 + this.timer * 0.3)
        this.carX -= speed * dt
        this.moverX -= speed * dt
        this.towDist += speed * dt
        if (this.towDist > 31) {
          this.phase = Phase.RESET
          this.timer = 0
          this.events.onPhase(this.phase)
        }
        break
      }
      case Phase.RESET: {
        // next round: new body arrives while the finished car recedes in the background
        this.round++
        this.variation = this.makeVariation(this.round)
        this.resetCar()
        this.events.onPhase(this.phase)
        this.phase = Phase.LIFT
        this.events.onPhase(this.phase)
        break
      }
    }
  }

  private updateSway(dt: number) {
    // pendulum length: hook to hanging car center of mass
    const ell = RIG_TOTAL + 1.1
    const accel = (this.carrierVel - this.prevCarrierVel) / Math.max(dt, 1e-4)
    this.prevCarrierVel = this.carrierVel
    const drive = this.airborne ? accel : 0
    const damping = this.airborne ? 0.55 : 6.0
    this.swayVelZ += (-(G / ell) * this.swayAngZ - damping * this.swayVelZ - drive / ell) * dt
    this.swayAngZ += this.swayVelZ * dt
    this.swayAngZ = clamp(this.swayAngZ, -0.05, 0.05)
    // faint X sway excited by winch starts
    const wDrive = this.airborne ? (this.winchVel - 0) * 0.02 : 0
    this.swayVelX += (-(G / ell) * this.swayAngX - 0.8 * this.swayVelX) * dt
    this.swayAngX += (this.swayVelX + wDrive * 0) * dt

    // two-crane sync error -> small pitch, decays when idle
    const moving = Math.abs(this.winchVel) > 0.02
    for (let i = 0; i < 2; i++) {
      if (moving && this.airborne) {
        this.syncErr[i] += (this.rng() - 0.5) * 0.012
        this.syncErr[i] = clamp(this.syncErr[i], -0.035, 0.035)
      } else {
        this.syncErr[i] = moveToward(this.syncErr[i], 0, 0.02 * dt)
      }
    }
    const targetPitch = this.airborne ? (this.syncErr[1] - this.syncErr[0]) / L.bogieSpacing : 0
    this.pitch = lerp(this.pitch, targetPitch, 1 - Math.exp(-2.5 * dt))
    const targetRoll = this.airborne ? this.swayAngZ * 0.4 : 0
    this.roll = lerp(this.roll, targetRoll, 1 - Math.exp(-3 * dt))

    // sway moves the car relative to the commanded carrier position
    if (this.airborne) {
      this.carZ = this.carrierZ + Math.sin(this.swayAngZ) * ell
    } else {
      this.carZ = lerp(this.carZ, this.carrierZ, 1 - Math.exp(-8 * dt))
    }
  }

  // Per-crane hook world positions (x fixed over the lift points)
  hookPos(i: number): { x: number, y: number, z: number } {
    return {
      x: L.liftPointX[i],
      y: this.hookY + this.syncErr[i],
      z: this.carrierZ
    }
  }
}
