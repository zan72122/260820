import { clamp, damp } from '../util/math'

export type Stage =
  | 'mystery' // wind swings the seat; the clock twitches; nothing is explained
  | 'hint' // the single non-verbal swipe gesture is shown, once
  | 'first' // the player's first pump has landed; cause -> effect plays out
  | 'confirm' // waiting for the child to repeat it on their own
  | 'play' // understood: amplitude now decides how far the night spreads
  | 'finale' // the whole town has woken; camera pulls back
  | 'night' // free swinging under a finished night sky

/** Which ring of the world a light belongs to. Amplitude picks the ring. */
export type Tier = 0 | 1 | 2 | 3

export interface LampGroup {
  id: string
  tier: Tier
  /** Number of individual fixtures in this group. */
  count: number
  /** How many of them are switched on. */
  lit: number
}

export interface TickResult {
  /** Teeth the ratchet advanced this cycle (1..3, driven by the size of the arc). */
  teeth: number
  tier: Tier
  amplitude: number
  /** Fixtures switched on by this tick. */
  turnedOn: { group: string; index: number; tier: Tier }[]
  nightBefore: number
  nightAfter: number
  /** True on the cycle where the moon slips out from behind the cloud. */
  revealedMoon: boolean
  /** True on the single cycle where the whole town breathes on together. */
  townBreath: boolean
}

/** Teeth of the ratchet required to carry the sky all the way from sunset to full night. */
const TEETH_FOR_NIGHT = 26

const GROUP_DEFS: { id: string; tier: Tier; count: number }[] = [
  // tier 0 — right at the child's feet
  { id: 'pathLights', tier: 0, count: 5 },
  // tier 1 — the middle ground they are sitting in
  { id: 'clockDial', tier: 1, count: 1 },
  { id: 'benchLamps', tier: 1, count: 3 },
  { id: 'nearHouses', tier: 1, count: 4 },
  // tier 2 — the far side of the valley
  { id: 'roads', tier: 2, count: 5 },
  { id: 'tower', tier: 2, count: 1 },
  { id: 'harbour', tier: 2, count: 3 },
  { id: 'hills', tier: 2, count: 3 },
]

export class GameState {
  stage: Stage = 'mystery'

  /** Total ratchet teeth advanced. The clock hand is a pure function of this. */
  teeth = 0
  /**
   * Teeth that count towards the sky. The wind-driven ticks of the opening move
   * the mechanism but do not start the evening — the child does that.
   */
  nightTeeth = 0
  /** Completed swing cycles that produced a tick. */
  cycles = 0

  /** 0 = the instant before sunset, 1 = full night. Never runs backwards. */
  night = 0
  /** Smoothed record of how big the arcs have been — drives how far away the world reads. */
  reach = 0

  /** 0..1 animation of the moon emerging from the cloud edge. */
  moonReveal = 0
  moonRevealed = false

  /** 0..1 one-shot swell when the town lights all come up together. */
  townBreath = 0
  townBreathDone = false

  /** Set once the child has produced two pumps of their own. */
  understood = false

  /** Cycles the player has driven (excludes the opening wind swing). */
  playerCycles = 0

  groups: Map<string, LampGroup> = new Map()

  /** Rolling window of recent amplitudes, for detecting a steady, confident rhythm. */
  private recentAmps: number[] = []

  constructor() {
    this.resetGroups()
  }

  private resetGroups(): void {
    this.groups.clear()
    for (const d of GROUP_DEFS) this.groups.set(d.id, { ...d, lit: 0 })
  }

  litOf(id: string): number {
    return this.groups.get(id)?.lit ?? 0
  }

  isLit(id: string, index: number): boolean {
    return index < this.litOf(id)
  }

  get totalFixtures(): number {
    let n = 0
    for (const g of this.groups.values()) n += g.count
    return n
  }

  get totalLit(): number {
    let n = 0
    for (const g of this.groups.values()) n += g.lit
    return n
  }

  get allLit(): boolean {
    return this.totalLit >= this.totalFixtures
  }

  static tierForAmplitude(a: number): Tier {
    if (a < 0.3) return 0
    if (a < 0.53) return 1
    if (a < 0.74) return 2
    return 3
  }

  /**
   * Advance the world by one completed swing cycle.
   * Called exactly once per cycle by the clock mechanism — never per frame.
   */
  tick(
    amplitude: number,
    opts: { playerDriven: boolean; countTowardsNight: boolean; nightBoost?: number },
  ): TickResult {
    const tier = GameState.tierForAmplitude(amplitude)
    // A longer lever throw catches a tooth further round the ratchet wheel.
    const teeth = tier >= 3 ? 3 : tier >= 2 ? 2 : 1

    const nightBefore = this.night
    this.teeth += teeth
    this.cycles += 1
    if (opts.playerDriven) this.playerCycles += 1
    if (opts.countTowardsNight) this.nightTeeth += teeth + (opts.nightBoost ?? 0)
    this.night = clamp(this.nightTeeth / TEETH_FOR_NIGHT)

    this.recentAmps.push(amplitude)
    if (this.recentAmps.length > 4) this.recentAmps.shift()

    const turnedOn = opts.countTowardsNight ? this.switchOn(tier, tier >= 2 ? 2 : 1) : []

    let revealedMoon = false
    if (!this.moonRevealed && tier >= 3 && opts.countTowardsNight) {
      this.moonRevealed = true
      revealedMoon = true
    }

    let townBreath = false
    if (!this.townBreathDone && opts.countTowardsNight && this.steadyRhythm() && this.night > 0.62) {
      this.townBreathDone = true
      this.townBreath = 1
      townBreath = true
      // The breath finishes anything still dark out in the valley.
      for (const g of this.groups.values()) if (g.tier >= 1) g.lit = g.count
    }

    return {
      teeth,
      tier,
      amplitude,
      turnedOn,
      nightBefore,
      nightAfter: this.night,
      revealedMoon,
      townBreath,
    }
  }

  /** Four cycles in a row, all big, all within a narrow band = a confident steady rhythm. */
  private steadyRhythm(): boolean {
    if (this.recentAmps.length < 4) return false
    const min = Math.min(...this.recentAmps)
    const max = Math.max(...this.recentAmps)
    return min > 0.58 && max - min < 0.2
  }

  /**
   * Light the next fixture(s) in the requested ring. If that ring is already
   * finished the light spills to the nearest unfinished ring, so *every* swing
   * always turns something on somewhere.
   */
  private switchOn(tier: Tier, howMany: number): TickResult['turnedOn'] {
    const out: TickResult['turnedOn'] = []
    for (let n = 0; n < howMany; n++) {
      const g = this.pickGroup(tier)
      if (!g) break
      out.push({ group: g.id, index: g.lit, tier: g.tier })
      g.lit += 1
    }
    return out
  }

  private pickGroup(tier: Tier): LampGroup | null {
    const order: Tier[] = [tier, ...([0, 1, 2, 3] as Tier[]).filter((t) => t !== tier)]
    // Prefer the requested ring, then walk outward/inward to whatever is still dark.
    order.sort((a, b) => Math.abs(a - tier) - Math.abs(b - tier))
    for (const t of order) {
      const candidates = [...this.groups.values()].filter((g) => g.tier === t && g.lit < g.count)
      if (candidates.length) {
        // Inside a ring, fill the least-lit group first so the spread feels even.
        candidates.sort((a, b) => a.lit / a.count - b.lit / b.count)
        return candidates[0]
      }
    }
    return null
  }

  /** Per-frame smoothing of derived values. Pure state, no rendering. */
  update(dt: number, currentAmplitude: number): void {
    this.reach = damp(this.reach, Math.max(this.reach * 0.995, currentAmplitude), 1.2, dt)
    if (this.moonRevealed) this.moonReveal = damp(this.moonReveal, 1, 0.55, dt)
    if (this.townBreath > 0) this.townBreath = damp(this.townBreath, 0, 0.42, dt)

    if (!this.understood && this.playerCycles >= 2) this.understood = true

    if (this.stage === 'play' && this.allLit && this.night >= 0.999) this.stage = 'finale'

  }

  reset(): void {
    this.stage = 'mystery'
    this.teeth = 0
    this.nightTeeth = 0
    this.cycles = 0
    this.night = 0
    this.reach = 0
    this.moonReveal = 0
    this.moonRevealed = false
    this.townBreath = 0
    this.townBreathDone = false
    this.understood = false
    this.playerCycles = 0
    this.recentAmps = []
    this.resetGroups()
  }

  /** Snapshot used to survive an orientation change / context loss without rewinding time. */
  serialise(): string {
    return JSON.stringify({
      stage: this.stage,
      teeth: this.teeth,
      nightTeeth: this.nightTeeth,
      cycles: this.cycles,
      night: this.night,
      reach: this.reach,
      moonRevealed: this.moonRevealed,
      moonReveal: this.moonReveal,
      townBreathDone: this.townBreathDone,
      understood: this.understood,
      playerCycles: this.playerCycles,
      groups: [...this.groups.values()].map((g) => [g.id, g.lit] as const),
    })
  }

  restore(json: string): boolean {
    try {
      const d = JSON.parse(json)
      if (typeof d?.teeth !== 'number') return false
      this.stage = d.stage ?? 'play'
      this.teeth = d.teeth
      this.nightTeeth = d.nightTeeth ?? d.teeth
      this.cycles = d.cycles ?? 0
      this.night = clamp(d.night ?? 0)
      this.reach = clamp(d.reach ?? 0)
      this.moonRevealed = !!d.moonRevealed
      this.moonReveal = d.moonRevealed ? 1 : 0
      this.townBreathDone = !!d.townBreathDone
      this.understood = !!d.understood
      this.playerCycles = d.playerCycles ?? 0
      for (const [id, lit] of d.groups ?? []) {
        const g = this.groups.get(id)
        if (g) g.lit = Math.min(g.count, lit)
      }
      return true
    } catch {
      return false
    }
  }
}
