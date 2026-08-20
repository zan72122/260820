/**
 * Pure game state. No Three.js, no DOM - so the whole causal chain
 * (bag -> sheet -> bounce -> ripening -> free placement) is unit-testable and
 * survives an orientation change by being plain data.
 */

export type Phase =
  | 'intro'
  | 'bagged'
  | 'unbagging'
  | 'observing'
  | 'sheetIdle'
  | 'unrolling'
  | 'firstLight'
  | 'ripening'
  | 'freeplay'
  | 'handoff'

export type Target = 'bag' | 'sheet' | 'sheetBody' | 'sun' | 'nextBag'

export interface LearnedSkills {
  bag: boolean
  sheet: boolean
  sun: boolean
}

export interface GameState {
  phase: Phase
  round: number
  /** 0..1 - how far the paper bag has been pulled off. */
  bagPull: number
  /** 0..1 - how much of the roll has been spread on the ground. */
  sheetDeploy: number
  /** -1..1 - sideways placement of the spread sheet. */
  sheetLateral: number
  /** 0..1 - how far the sheet reaches in under the branch. */
  sheetReach: number
  /** 0..1 - far end folded back on itself. */
  sheetFold: number
  /** 0..1 position of the sun along its arc (0 = morning, 1 = late afternoon). */
  sunT: number
  /** Accumulated ripening time in simulated "sun steps". */
  simTime: number
  /** 0..1, written back by the blush simulation. */
  blushCoverage: number
  phaseTimer: number
  idleTimer: number
  freeplayTimer: number
  hintLevel: 0 | 1 | 2
  learned: LearnedSkills
  /** Set once the sheet has ever been under the fruit while spread. */
  sawFirstLight: boolean
}

export const SHEET_DEPLOY_TRIGGER = 0.68
export const RIPEN_TO_PLAY_COVERAGE = 0.26
export const HANDOFF_COVERAGE = 0.62
export const HANDOFF_MIN_FREEPLAY = 22
export const HINT_DELAY_1 = 3.0
export const HINT_DELAY_2 = 9.0

export function createState(round = 0, learned?: LearnedSkills): GameState {
  return {
    phase: round === 0 ? 'intro' : 'bagged',
    round,
    bagPull: 0,
    sheetDeploy: 0,
    sheetLateral: 0,
    sheetReach: 0,
    sheetFold: 0,
    sunT: 0.34,
    simTime: 0,
    blushCoverage: 0,
    phaseTimer: 0,
    idleTimer: 0,
    freeplayTimer: 0,
    hintLevel: 0,
    learned: learned ? { ...learned } : { bag: false, sheet: false, sun: false },
    sawFirstLight: false,
  }
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x)

/** Which objects accept a finger right now. Hit areas stay generous. */
export function interactable(s: GameState): Set<Target> {
  const out = new Set<Target>()
  switch (s.phase) {
    case 'intro':
    case 'unbagging':
      break
    case 'bagged':
      out.add('bag')
      break
    case 'observing':
      out.add('sheet')
      break
    case 'sheetIdle':
    case 'unrolling':
      out.add('sheet')
      break
    case 'firstLight':
      out.add('sheet')
      out.add('sheetBody')
      break
    case 'ripening':
      out.add('sheet')
      out.add('sheetBody')
      out.add('sun')
      break
    case 'freeplay':
      out.add('sheet')
      out.add('sheetBody')
      out.add('sun')
      break
    case 'handoff':
      out.add('sheet')
      out.add('sheetBody')
      out.add('sun')
      out.add('nextBag')
      break
  }
  return out
}

/** The one thing a lost child could try next. Never a word, never an arrow. */
export function hintTarget(s: GameState): Target | null {
  if (s.hintLevel === 0) return null
  switch (s.phase) {
    case 'bagged':
      return s.learned.bag && s.hintLevel < 2 ? null : 'bag'
    case 'observing':
    case 'sheetIdle':
      return s.learned.sheet && s.hintLevel < 2 ? null : 'sheet'
    case 'ripening':
      return s.learned.sun && s.hintLevel < 2 ? null : 'sun'
    default:
      return null
  }
}

function enter(s: GameState, phase: Phase): void {
  s.phase = phase
  s.phaseTimer = 0
}

/** Any finger contact resets the hint clock. */
export function noteActivity(s: GameState): void {
  s.idleTimer = 0
  s.hintLevel = 0
}

export function pullBag(s: GameState, delta: number): void {
  if (!interactable(s).has('bag')) return
  // Only downward pulls count; a reversed drag simply gives the bag back.
  s.bagPull = clamp01(s.bagPull + delta)
  noteActivity(s)
  if (s.bagPull >= 1) {
    s.learned.bag = true
    enter(s, 'unbagging')
  }
}

export function pullSheet(s: GameState, delta: number): void {
  const can = interactable(s)
  if (!can.has('sheet')) return
  if (s.phase === 'observing') {
    // A child who reaches for the sheet early is not made to wait.
    enter(s, 'sheetIdle')
  }
  s.sheetDeploy = clamp01(s.sheetDeploy + delta)
  noteActivity(s)
  if (s.phase === 'sheetIdle' && s.sheetDeploy > 0.02) enter(s, 'unrolling')
  if (s.phase === 'unrolling' && s.sheetDeploy >= SHEET_DEPLOY_TRIGGER) {
    s.learned.sheet = true
    s.sawFirstLight = true
    enter(s, 'firstLight')
  }
}

export interface SheetPlacement {
  lateral?: number
  reach?: number
  fold?: number
  deploy?: number
}

export function placeSheet(s: GameState, p: SheetPlacement): void {
  const can = interactable(s)
  if (!can.has('sheetBody') && !can.has('sheet')) return
  if (p.lateral !== undefined) s.sheetLateral = clamp(p.lateral, -1, 1)
  if (p.reach !== undefined) s.sheetReach = clamp01(p.reach)
  if (p.fold !== undefined) s.sheetFold = clamp01(p.fold)
  if (p.deploy !== undefined) s.sheetDeploy = clamp01(p.deploy)
  noteActivity(s)
}

export function moveSun(s: GameState, delta: number): void {
  if (!interactable(s).has('sun')) return
  const before = s.sunT
  s.sunT = clamp(s.sunT + delta, 0.06, 0.94)
  // Ripening is driven by how much sun has travelled, not by wall clock.
  s.simTime += Math.abs(s.sunT - before) * 12
  if (Math.abs(s.sunT - before) > 0.004) s.learned.sun = true
  noteActivity(s)
}

/** Written back by the blush simulation each frame. */
export function reportCoverage(s: GameState, coverage: number): void {
  s.blushCoverage = clamp01(coverage)
}

export function tick(s: GameState, dt: number): void {
  s.phaseTimer += dt
  s.idleTimer += dt

  if (s.hintLevel === 0 && s.idleTimer > HINT_DELAY_1) s.hintLevel = 1
  else if (s.hintLevel === 1 && s.idleTimer > HINT_DELAY_2) s.hintLevel = 2

  switch (s.phase) {
    case 'intro':
      if (s.phaseTimer > 1.1) enter(s, 'bagged')
      break
    case 'unbagging':
      if (s.phaseTimer > 1.7) enter(s, 'observing')
      break
    case 'observing':
      // A held beat so the fruit, the down, the branch join can be looked at.
      if (s.phaseTimer > 3.4) enter(s, 'sheetIdle')
      break
    case 'firstLight':
      // The local reaction reads before any pigment moves.
      if (s.phaseTimer > 2.8) enter(s, 'ripening')
      break
    case 'ripening':
      // Standing in the sun still ripens, only far slower than moving it.
      s.simTime += dt * 0.22
      if (s.blushCoverage >= RIPEN_TO_PLAY_COVERAGE) enter(s, 'freeplay')
      break
    case 'freeplay':
      s.simTime += dt * 0.22
      s.freeplayTimer += dt
      if (s.blushCoverage >= HANDOFF_COVERAGE && s.freeplayTimer >= HANDOFF_MIN_FREEPLAY) {
        enter(s, 'handoff')
      }
      break
    case 'handoff':
      s.simTime += dt * 0.22
      break
    default:
      break
  }
}

/** Next fruit: keep what the child learned, forget what they solved. */
export function nextRound(s: GameState): GameState {
  return createState(s.round + 1, s.learned)
}

export interface SavedState {
  v: 1
  s: GameState
}

export function serialize(s: GameState): string {
  return JSON.stringify({ v: 1, s } satisfies SavedState)
}

export function deserialize(raw: string | null): GameState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as SavedState
    if (!parsed || parsed.v !== 1 || !parsed.s) return null
    const base = createState(parsed.s.round ?? 0)
    return { ...base, ...parsed.s, learned: { ...base.learned, ...parsed.s.learned } }
  } catch {
    return null
  }
}
