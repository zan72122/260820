import { describe, expect, it } from 'vitest'
import { FruitSim, DEFAULT_TUNING } from '../src/sim/fruitSim'

/** Run a full drop and report what the catch actually did. */
function drop(tautness: number, dropHeight: number, tuning = {}) {
  const sim = new FruitSim(tuning)
  const restY = 0.62
  sim.setPosition(0, restY + DEFAULT_TUNING.radius + dropHeight, 0)
  sim.release(restY, 0, 0)
  let t = 0
  let touchAt = -1
  let deepestAt = -1
  let deepest = 0
  let firstReturn = 0
  let secondDip = 0
  let settledAt = -1
  let stage = 0
  let lastVy = 0
  const dt = 1 / 240
  while (t < 6) {
    sim.update(dt, tautness)
    t += dt
    const s = sim.state
    if (s.justTouched && touchAt < 0) touchAt = t
    if (s.phase === 'cradling' || s.phase === 'resting') {
      if (s.sink > deepest) { deepest = s.sink; deepestAt = t }
      if (deepestAt > 0 && t > deepestAt) {
        if (stage === 0) {
          firstReturn = Math.max(firstReturn, deepest - s.sink)
          if (lastVy > 0 && s.vy <= 0) stage = 1
        } else {
          secondDip = Math.max(secondDip, s.sink - (deepest - firstReturn))
        }
      }
      lastVy = s.vy
    }
    if (s.phase === 'resting' && settledAt < 0) settledAt = t
  }
  return {
    sim, touchAt, deepest, deepestAt, firstReturn, secondDip, settledAt,
    dipTime: deepestAt - touchAt,
  }
}

describe('fruit catch', () => {
  it('lands close to the authored sink depth on a slack net', () => {
    const r = drop(0, 0.2)
    expect(r.deepest).toBeGreaterThan(0.095)
    expect(r.deepest).toBeLessThan(0.125)
  })

  it('is independent of how far the fruit fell', () => {
    const near = drop(0, 0.13)
    const far = drop(0, 0.28)
    expect(Math.abs(near.deepest - far.deepest)).toBeLessThan(0.006)
  })

  it('sinks less and returns sooner on a taut net', () => {
    const slack = drop(0, 0.2)
    const taut = drop(1, 0.2)
    expect(taut.deepest).toBeLessThan(slack.deepest * 0.75)
    expect(taut.dipTime).toBeLessThan(slack.dipTime)
  })

  it('returns exactly once and then stops', () => {
    const r = drop(0.3, 0.2)
    expect(r.firstReturn).toBeGreaterThan(0.02)
    expect(r.secondDip).toBeLessThan(r.firstReturn * 0.08)
    expect(r.settledAt).toBeGreaterThan(0)
  })

  it('keeps the whole fall-to-rest beat inside a readable window', () => {
    for (const taut of [0, 0.5, 1]) {
      const r = drop(taut, 0.2)
      expect(r.settledAt).toBeGreaterThan(0.4)
      expect(r.settledAt).toBeLessThan(2.0)
    }
  })

  it('never lets the fruit pass through the net', () => {
    const sim = new FruitSim()
    const restY = 0.62
    sim.setPosition(0, restY + DEFAULT_TUNING.radius + 0.35, 0)
    sim.release(restY, 0, 0)
    let lowest = Infinity
    for (let i = 0; i < 1400; i++) {
      sim.update(1 / 240, 0)
      lowest = Math.min(lowest, sim.state.y - DEFAULT_TUNING.radius)
    }
    expect(lowest).toBeGreaterThan(restY - 0.2)
  })

  it('settles back to the same rest height after a nudge', () => {
    const r = drop(0.4, 0.2)
    const before = r.sim.state.y
    r.sim.addImpulse(0.1, 0.55, 0)
    expect(r.sim.state.phase).toBe('cradling')
    for (let i = 0; i < 1400; i++) r.sim.update(1 / 240, 0.4)
    expect(Math.abs(r.sim.state.y - before)).toBeLessThan(0.004)
    expect(r.sim.state.phase).toBe('resting')
  })
})
