import {
  CIRCUIT_IDS,
  FIXTURES,
  type CircuitId,
  type FixtureDef,
} from '../world/layout'
import { approach, clamp01, smoothstep } from '../core/math'

/** Charge at which each fixture of a circuit begins to draw. */
const THRESHOLDS: Record<CircuitId, number[]> = {
  path: [0.05, 0.2, 0.35, 0.52, 0.68, 0.84],
  pavilion: [0.06, 0.2, 0.36],
  tree: [0.05, 0.16, 0.29, 0.42],
}

/** Width of the charge band over which a single fixture comes fully up. */
const BAND = 0.085

/** How much instantaneous generator output can push a fixture past its threshold. */
const LIVE_BOOST = 0.35

/** Charge gained per second at full generator output. */
const CHARGE_RATE = 0.147

/** Time constant of the live-output follower: the residual glow after stopping. */
const LIVE_TAU = 0.62

/** Slow self-discharge of the storage bank, down to the committed floor. */
const LEAK = 0.006

/** Filament warm-up and cool-down lag, in seconds. */
const WARM_TAU = 0.36
const COOL_TAU = 0.9

export interface LampState {
  def: FixtureDef
  /** Target level from the circuit model, 0..1. */
  target: number
  /** Displayed level after the warm-up filter, 0..1. */
  level: number
  /** True once the stored charge alone holds this fixture on. */
  latched: boolean
}

export interface CircuitState {
  id: CircuitId
  charge: number
  live: number
  /** Charge the circuit will not discharge below, once fixtures have latched. */
  floor: number
  lamps: LampState[]
}

export interface IgnitionEvent {
  fixtureId: string
  circuit: CircuitId
  /** Index of the fixture within its circuit. */
  order: number
}

export class CircuitModel {
  readonly circuits: Record<CircuitId, CircuitState>
  readonly safety: LampState[]
  readonly all = new Map<string, LampState>()

  /** Circuit currently armed by the selector. */
  active: CircuitId = 'path'

  /** Hard ceiling applied while the discovery step is running. */
  chargeCeiling = 1

  /** Fixtures that crossed their ignition point during the last update. */
  readonly ignitions: IgnitionEvent[] = []

  constructor() {
    const mk = (id: CircuitId): CircuitState => {
      const lamps = FIXTURES.filter((f) => f.circuit === id)
        .sort((a, b) => a.order - b.order)
        .map<LampState>((def) => ({ def, target: 0, level: 0, latched: false }))
      return { id, charge: 0, live: 0, floor: 0, lamps }
    }
    this.circuits = {
      path: mk('path'),
      pavilion: mk('pavilion'),
      tree: mk('tree'),
    }
    this.safety = FIXTURES.filter((f) => f.circuit === 'safety').map<LampState>((def) => ({
      def,
      target: 1,
      level: 0,
      latched: true,
    }))
    for (const id of CIRCUIT_IDS) for (const l of this.circuits[id].lamps) this.all.set(l.def.id, l)
    for (const l of this.safety) this.all.set(l.def.id, l)
  }

  /**
   * @param power Normalised generator output, 0..1.
   */
  update(dt: number, power: number): void {
    this.ignitions.length = 0
    const p = clamp01(power)

    for (const id of CIRCUIT_IDS) {
      const c = this.circuits[id]
      const driven = id === this.active

      // Live output follows the shaft immediately on the way up and coasts on
      // the way down: the storage bank keeps the lamp alive for a moment.
      c.live = approach(c.live, driven ? p : 0, driven && p > c.live ? 0.06 : LIVE_TAU, dt)

      if (driven && p > 0) {
        // Non-linear so a lazy hand-crank never charges like a full run.
        c.charge = Math.min(this.chargeCeiling, c.charge + Math.pow(p, 1.5) * CHARGE_RATE * dt)
      }
      c.charge = Math.max(c.floor, c.charge - LEAK * dt)

      const thresholds = THRESHOLDS[id]
      const effective = c.charge + c.live * LIVE_BOOST

      for (let i = 0; i < c.lamps.length; i++) {
        const lamp = c.lamps[i]
        const t = thresholds[Math.min(i, thresholds.length - 1)]
        lamp.target = smoothstep(t, t + BAND, effective)

        const held = c.charge >= t + BAND * 0.62
        if (held && !lamp.latched) {
          lamp.latched = true
          c.floor = Math.max(c.floor, t + BAND * 0.62)
        }

        const wasOff = lamp.level < 0.16
        const tau = lamp.target > lamp.level ? WARM_TAU : COOL_TAU
        lamp.level = approach(lamp.level, lamp.target, tau, dt)
        if (wasOff && lamp.level >= 0.16) {
          this.ignitions.push({ fixtureId: lamp.def.id, circuit: id, order: i })
        }
      }
    }

    for (const l of this.safety) l.level = approach(l.level, l.target, 1.4, dt)
  }

  /** Number of fixtures on a circuit that are currently carrying light. */
  litCount(id: CircuitId): number {
    return this.circuits[id].lamps.reduce((n, l) => n + (l.level > 0.35 ? 1 : 0), 0)
  }

  /** Fixtures held on by stored charge alone. */
  latchedCount(id: CircuitId): number {
    return this.circuits[id].lamps.reduce((n, l) => n + (l.latched ? 1 : 0), 0)
  }

  /** True once every circuit is holding at least one fixture on its own. */
  allZonesLit(): boolean {
    return CIRCUIT_IDS.every((id) => this.latchedCount(id) > 0)
  }

  /** Whole-park lit fraction, used to ease the sky and ambient down as the park wakes. */
  overallLight(): number {
    let sum = 0
    let n = 0
    for (const id of CIRCUIT_IDS) {
      for (const l of this.circuits[id].lamps) {
        sum += l.level
        n++
      }
    }
    return n > 0 ? sum / n : 0
  }

  /** Instantly bring the park to a lit state; used only by the debug overlay. */
  debugFill(v: number): void {
    for (const id of CIRCUIT_IDS) {
      const c = this.circuits[id]
      c.charge = v
      c.floor = Math.max(0, v - 0.02)
      for (let i = 0; i < c.lamps.length; i++) {
        const t = THRESHOLDS[id][Math.min(i, THRESHOLDS[id].length - 1)]
        c.lamps[i].latched = v >= t + BAND * 0.62
      }
    }
  }
}
