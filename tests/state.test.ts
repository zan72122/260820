import { describe, expect, it } from 'vitest'
import { GameState, IDLE_HINT_DELAY, makeRoundProfile } from '../src/game/state'

function run(s: GameState, seconds: number, pointer = false, dt = 1 / 60): void {
  const steps = Math.round(seconds / dt)
  for (let i = 0; i < steps; i++) s.update(dt, pointer)
}

/** Play one complete round, exactly the way a child would. */
function playRound(s: GameState, leftHook = 1, rightHook = 5): void {
  s.attachEnd('left', leftHook)
  s.attachEnd('right', rightHook)
  while (s.ripeness < 1) s.scrubTime(0.05)
  run(s, s.profile.loosenDelay + 0.2)
  run(s, s.profile.loosenDuration + 0.2)
  s.noteContact()
  s.noteSettled()
}

describe('game flow', () => {
  it('starts loose, with nothing hooked and no fruit falling', () => {
    const s = new GameState()
    expect(s.stage).toBe('idle')
    expect(s.bothHooked).toBe(false)
    expect(s.canScrubTime).toBe(false)
  })

  it('walks idle -> oneEnd -> hung as the ends go on', () => {
    const s = new GameState()
    s.attachEnd('left', 1)
    expect(s.stage).toBe('oneEnd')
    s.attachEnd('right', 5)
    expect(s.stage).toBe('hung')
    expect(s.canScrubTime).toBe(true)
  })

  it('only ripens once both ends are hooked', () => {
    const s = new GameState()
    s.scrubTime(0.4)
    expect(s.ripeness).toBe(0)
    s.attachEnd('left', 1)
    s.scrubTime(0.4)
    expect(s.ripeness).toBe(0)
    s.attachEnd('right', 5)
    s.scrubTime(0.4)
    expect(s.ripeness).toBeGreaterThan(0)
  })

  it('ripens gradually, never in one jump, and never backwards', () => {
    const s = new GameState()
    s.attachEnd('left', 1)
    s.attachEnd('right', 5)
    const samples: number[] = []
    for (let i = 0; i < 12; i++) {
      s.scrubTime(0.08)
      samples.push(s.ripeness)
    }
    expect(samples[0]).toBeLessThan(0.25)
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1])
    }
    // Dragging the light backwards still moves the fruit forwards.
    const before = s.ripeness
    s.scrubTime(-0.1)
    expect(s.ripeness).toBeGreaterThan(before)
    expect(s.timeOfDay).toBeLessThan(1e9)
  })

  it('lets go by itself once ripe, after a beat, and reaches free play', () => {
    const s = new GameState()
    s.attachEnd('left', 1)
    s.attachEnd('right', 5)
    while (s.ripeness < 1) s.scrubTime(0.05)
    expect(s.stage).toBe('hung')
    run(s, s.profile.loosenDelay + 0.05)
    expect(s.stage).toBe('loosening')
    run(s, s.profile.loosenDuration + 0.05)
    expect(s.stage).toBe('falling')
    expect(s.canDragHandles).toBe(false)
    s.noteContact()
    expect(s.stage).toBe('cradling')
    s.noteSettled()
    expect(s.stage).toBe('play')
    expect(s.canPushNet).toBe(true)
    expect(s.canDragHandles).toBe(true)
  })

  it('ignores handle changes while the fruit is in the air', () => {
    const s = new GameState()
    s.attachEnd('left', 1)
    s.attachEnd('right', 5)
    while (s.ripeness < 1) s.scrubTime(0.05)
    run(s, s.profile.loosenDelay + s.profile.loosenDuration + 0.2)
    expect(s.stage).toBe('falling')
    s.detachEnd('left')
    expect(s.attach.left).toBe(1)
    s.attachEnd('right', 7)
    expect(s.attach.right).toBe(5)
  })

  it('harvests on the next round without any hint being needed', () => {
    const s = new GameState()
    playRound(s)
    expect(s.stage).toBe('play')
    const before = s.profile.seed
    const res = s.detachEnd('left')
    expect(res.harvested).toBe(true)
    expect(s.harvested).toBe(1)
    expect(s.round).toBe(1)
    expect(s.ripeness).toBe(0)
    expect(s.stage).toBe('oneEnd')
    expect(s.profile.seed).not.toBe(before)
    // Second round runs the identical process with a different hook spacing.
    s.attachEnd('left', 3)
    expect(s.stage).toBe('hung')
    while (s.ripeness < 1) s.scrubTime(0.05)
    run(s, s.profile.loosenDelay + s.profile.loosenDuration + 0.2)
    expect(s.stage).toBe('falling')
  })

  it('survives repeated taps, reversed drags and interrupted attaches', () => {
    const s = new GameState()
    for (let i = 0; i < 40; i++) {
      s.attachEnd('left', i % 4)
      s.detachEnd('left')
      s.attachEnd('right', 4 + (i % 4))
      s.detachEnd('right')
    }
    expect(s.stage).toBe('idle')
    expect(s.harvested).toBe(0)
    s.attachEnd('left', 1)
    s.attachEnd('right', 6)
    for (let i = 0; i < 200; i++) s.scrubTime(i % 2 === 0 ? 0.03 : -0.03)
    expect(s.ripeness).toBe(1)
    expect(Number.isFinite(s.timeOfDay)).toBe(true)
  })

  it('gives one weak reach-for-the-hook hint, and never attaches by itself', () => {
    const s = new GameState()
    run(s, IDLE_HINT_DELAY - 0.4)
    expect(s.hintKind).toBe('none')
    run(s, 0.6)
    expect(s.hintKind).toBe('reachForHook')
    expect(s.hintPhase).toBeGreaterThan(0)
    run(s, 2)
    expect(s.hintPhase).toBe(0)
    expect(s.attach.left).toBe(null)
    expect(s.stage).toBe('idle')
  })

  it('switches the hint to the light once the net is hung', () => {
    const s = new GameState()
    s.attachEnd('left', 1)
    s.attachEnd('right', 5)
    run(s, IDLE_HINT_DELAY + 0.3)
    expect(s.hintKind).toBe('nudgeTime')
    s.scrubTime(0.02)
    expect(s.hintKind).toBe('none')
    run(s, IDLE_HINT_DELAY + 0.3)
    expect(s.hintKind).toBe('none')
  })

  it('holds hints back while a finger is down', () => {
    const s = new GameState()
    run(s, 20, true)
    expect(s.hintKind).toBe('none')
  })

  it('varies every fruit but keeps the first one calm', () => {
    const a = makeRoundProfile(0, 12345)
    const b = makeRoundProfile(1, 12345)
    const c = makeRoundProfile(2, 12345)
    expect(a.seed).not.toBe(b.seed)
    expect(b.seed).not.toBe(c.seed)
    expect(Math.abs(a.sizeScale - 1)).toBeLessThan(Math.abs(b.sizeScale - 1) + 0.05)
    for (const p of [a, b, c]) {
      expect(p.sizeScale).toBeGreaterThan(0.85)
      expect(p.sizeScale).toBeLessThan(1.15)
      expect(p.loosenDuration).toBeGreaterThan(0.7)
      expect(p.wind).toBeGreaterThan(0.1)
    }
  })
})
