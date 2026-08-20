import { Rng } from '../core/rng'
import { clamp, clamp01 } from '../core/math'

/**
 * The whole game as a small, pure state machine. No three.js, no DOM: this is
 * the piece that has to survive rotation, double taps, backwards drags and a
 * finger lifted halfway, so it is the piece that gets unit tested.
 */
export type Stage =
  | 'idle' // net lying on the bench, neither end hooked
  | 'oneEnd' // one cord end on a hook
  | 'hung' // both ends hooked; the child controls time
  | 'loosening' // the stem is letting go
  | 'falling'
  | 'cradling' // touch, sink, one return
  | 'play' // fruit resting in the net, free to push

export type Side = 'left' | 'right'

export type HintKind = 'none' | 'reachForHook' | 'nudgeTime'

export interface RoundProfile {
  seed: number
  /** Fruit size relative to the base radius. */
  sizeScale: number
  /** How far the blush pushes into red at full ripeness. */
  blush: number
  /** Density of the dark lenticel speckle. */
  speckle: number
  /** Extra beat between "fully ripe" and "lets go". */
  loosenDelay: number
  /** Duration of the abscission beat itself. */
  loosenDuration: number
  /** Breeze gain for this round, so the net never sways the same way twice. */
  wind: number
  /** Small sideways offset of the stem, so the fruit never hangs identically. */
  stemOffset: number
  /** Ripening speed multiplier. */
  ripenRate: number
}

export function makeRoundProfile(round: number, baseSeed: number): RoundProfile {
  const rng = new Rng((baseSeed ^ (round * 0x9e3779b1)) >>> 0)
  // The first fruit is the calm, legible one; later fruit vary more.
  const spread = round === 0 ? 0.35 : 1
  return {
    seed: (baseSeed ^ (round * 0x85ebca6b)) >>> 0,
    sizeScale: 1 + rng.jitter(0.085) * spread,
    blush: clamp(0.86 + rng.jitter(0.22) * spread, 0.5, 1),
    speckle: clamp(0.45 + rng.jitter(0.4) * spread, 0.08, 1),
    loosenDelay: 0.25 + rng.range(0, 1.1) * spread,
    loosenDuration: 1.15 + rng.jitter(0.3) * spread,
    wind: 0.55 + rng.jitter(0.35) * spread,
    stemOffset: rng.jitter(0.022) * spread,
    ripenRate: 1 + rng.jitter(0.16) * spread,
  }
}

export const IDLE_HINT_DELAY = 4.2
export const IDLE_HINT_PERIOD = 6.0
export const HINT_PULSE = 1.35

export interface AttachState {
  left: number | null
  right: number | null
}

export class GameState {
  stage: Stage = 'idle'
  round = 0
  profile: RoundProfile
  readonly attach: AttachState = { left: null, right: null }

  /** 0 = hard green, 1 = ready to let go. Never runs backwards. */
  ripeness = 0
  /** Continuous clock the light follows; the child scrubs it either way. */
  timeOfDay = 0.28
  /** Harvested fruit resting on the bench. */
  harvested = 0

  /** Seconds since the child last touched anything meaningful. */
  idleTime = 0
  hintKind: HintKind = 'none'
  /** 0..1 while a hint plays, otherwise 0. */
  hintPhase = 0
  private hintTimer = 0
  private hintActive = false

  private stageTime = 0
  private loosenWait = 0
  /** True once the child has scrubbed time at least once this round. */
  timeTouched = false
  /** True once the child has pushed the net at least once. */
  netTouched = false

  private readonly baseSeed: number

  constructor(baseSeed = 0x1a2b3c4d) {
    this.baseSeed = baseSeed >>> 0
    this.profile = makeRoundProfile(0, this.baseSeed)
  }

  get bothHooked(): boolean {
    return this.attach.left !== null && this.attach.right !== null
  }

  get inCatchWindow(): boolean {
    return this.stage === 'loosening' || this.stage === 'falling' || this.stage === 'cradling'
  }

  get canDragHandles(): boolean {
    return !this.inCatchWindow
  }

  get canScrubTime(): boolean {
    return this.stage === 'hung'
  }

  get canPushNet(): boolean {
    return this.stage === 'play'
  }

  get stageElapsed(): number {
    return this.stageTime
  }

  private setStage(next: Stage): void {
    if (this.stage === next) return
    this.stage = next
    this.stageTime = 0
    this.clearHint()
  }

  private syncHangStage(): void {
    if (this.inCatchWindow || this.stage === 'play') return
    const n = (this.attach.left !== null ? 1 : 0) + (this.attach.right !== null ? 1 : 0)
    this.setStage(n === 2 ? 'hung' : n === 1 ? 'oneEnd' : 'idle')
  }

  attachEnd(side: Side, hookId: number): void {
    if (!this.canDragHandles) return
    this.attach[side] = hookId
    this.idleTime = 0
    this.clearHint()
    this.syncHangStage()
  }

  /**
   * Take a cord end off its hook. During free play this is also how the child
   * harvests: the resting fruit rolls gently out onto the bench.
   */
  detachEnd(side: Side): { harvested: boolean } {
    if (!this.canDragHandles) return { harvested: false }
    const wasPlaying = this.stage === 'play'
    this.attach[side] = null
    this.idleTime = 0
    if (wasPlaying) {
      this.harvested++
      this.startNextRound()
      return { harvested: true }
    }
    this.syncHangStage()
    return { harvested: false }
  }

  private startNextRound(): void {
    this.round++
    this.profile = makeRoundProfile(this.round, this.baseSeed)
    this.ripeness = 0
    this.timeTouched = false
    this.netTouched = false
    this.loosenWait = 0
    this.setStage(this.bothHooked ? 'hung' : this.attach.left !== null || this.attach.right !== null ? 'oneEnd' : 'idle')
  }

  /**
   * The child moved the light. Time can go either way; ripening only ever
   * advances, so scrubbing back and forth is still progress, never a setback.
   */
  scrubTime(delta: number): void {
    if (!this.canScrubTime) return
    this.timeOfDay += delta
    this.timeTouched = true
    this.idleTime = 0
    this.clearHint()
    this.ripeness = clamp01(this.ripeness + Math.abs(delta) * 0.30 * this.profile.ripenRate)
  }

  notePush(): void {
    this.netTouched = true
    this.idleTime = 0
    this.clearHint()
  }

  noteTouch(): void {
    this.idleTime = 0
    this.clearHint()
  }

  /** Called by the presentation layer when the fruit meets the net. */
  noteContact(): void {
    if (this.stage === 'falling') this.setStage('cradling')
  }

  noteSettled(): void {
    if (this.stage === 'cradling') this.setStage('play')
  }

  update(dt: number, pointerActive: boolean): void {
    this.stageTime += dt

    if (this.stage === 'hung' && this.ripeness >= 1) {
      this.loosenWait += dt
      if (this.loosenWait >= this.profile.loosenDelay) {
        this.setStage('loosening')
      }
    }

    if (this.stage === 'loosening' && this.stageTime >= this.profile.loosenDuration) {
      this.setStage('falling')
    }

    this.updateHint(dt, pointerActive)
  }

  private clearHint(): void {
    this.hintActive = false
    this.hintPhase = 0
    this.hintTimer = 0
    this.hintKind = 'none'
  }

  /**
   * One weak, wordless nudge. It never completes the action for the child: the
   * cord end reaches a little towards the hook and comes back.
   */
  private updateHint(dt: number, pointerActive: boolean): void {
    const kind: HintKind =
      this.stage === 'idle' || this.stage === 'oneEnd'
        ? 'reachForHook'
        : this.stage === 'hung' && !this.timeTouched
          ? 'nudgeTime'
          : 'none'

    if (kind === 'none' || pointerActive) {
      if (!this.hintActive) this.clearHint()
      if (pointerActive) this.idleTime = 0
      if (kind === 'none') return
    }

    if (!pointerActive) this.idleTime += dt

    if (this.hintActive) {
      this.hintTimer += dt
      this.hintPhase = clamp01(this.hintTimer / HINT_PULSE)
      if (this.hintTimer >= HINT_PULSE) {
        this.hintActive = false
        this.hintPhase = 0
        this.hintTimer = 0
        this.idleTime = 0
      }
      return
    }

    const delay = this.round === 0 ? IDLE_HINT_DELAY : IDLE_HINT_DELAY + 2.5
    if (this.idleTime >= delay) {
      this.hintKind = kind
      this.hintActive = true
      this.hintTimer = 0
      this.idleTime = -IDLE_HINT_PERIOD + delay
    }
  }
}
