import { test, expect, Page } from '@playwright/test'

// Deterministic end-to-end checks against the sim via window.__game hooks.
// E2E mode fixes dt to 1/60 so advance(seconds) is exact.

interface GameState {
  phase: string
  carX: number; carY: number; carZ: number
  hookY: number; carrierZ: number
  tension: number; slack: number
  airborne: boolean; springComp: number
  lightsOn: boolean; round: number
  pitch: number; roll: number
  moverX: number; towDist: number
}

declare global {
  interface Window {
    __game: {
      state(): GameState
      input(v: number, h: number): void
      advance(seconds: number): void
      advanceSim(seconds: number): void
      info(): { calls: number, triangles: number, geometries: number, textures: number }
    }
  }
}

async function load(page: Page, query = '?e2e=1&seed=1') {
  await page.goto('/' + query)
  await page.waitForFunction(() => window.__game !== undefined, undefined, { timeout: 20000 })
}

const st = (page: Page) => page.evaluate(() => window.__game.state())
const run = (page: Page, v: number, h: number, sec: number) =>
  page.evaluate(([a, b, c]) => { window.__game.input(a, b); window.__game.advance(c) }, [v, h, sec] as const)

test('full delivery cycle: slack -> tension -> liftoff -> traverse -> dock -> tow -> next round', async ({ page }) => {
  await load(page)
  let s = await st(page)
  expect(s.phase).toBe('LIFT')
  expect(s.airborne).toBe(false)
  expect(s.slack).toBeGreaterThan(0.05)     // slings visibly slack at reveal
  const restY = s.carY

  // tension builds before the car moves
  await run(page, 1, 0, 1.8)
  s = await st(page)
  expect(s.airborne).toBe(false)
  expect(s.carY).toBeCloseTo(restY, 3)      // car has not moved yet
  expect(s.slack).toBeLessThan(0.06)        // slings tightened first

  // keep raising: weight transfers, then liftoff
  await run(page, 1, 0, 4)
  s = await st(page)
  expect(s.airborne).toBe(true)
  expect(s.tension).toBe(1)
  expect(s.carY).toBeGreaterThan(restY + 0.1)

  // raise to clearance -> TRANSPORT
  await run(page, 1, 0, 12)
  s = await st(page)
  expect(s.phase).toBe('TRANSPORT')

  // traverse toward the beam
  await run(page, 0, 1, 14)
  await run(page, 0, 0, 2)
  s = await st(page)
  // carrier parks near the beam; residual sway may still be settling
  expect(Math.abs(s.carZ)).toBeLessThan(0.9)

  // descend; final segment is slow; contact compresses springs; tension falls
  await run(page, -1, 0, 16)
  await run(page, 0, 0, 1)
  s = await st(page)
  expect(['SEATED', 'UNHOOK', 'LIGHTS', 'DESCEND']).toContain(s.phase)
  if (s.phase === 'DESCEND') {
    await run(page, -1, 0, 8)
    s = await st(page)
  }
  expect(['SEATED', 'UNHOOK', 'LIGHTS']).toContain(s.phase)
  expect(s.springComp).toBeGreaterThan(0.9)
  expect(s.tension).toBeLessThan(0.1)
  expect(Math.abs(s.carZ)).toBeLessThan(0.05)   // guided onto the pins

  // auto sequence: unhook, lights, mover couples, tow to inspection, then reset
  await run(page, 0, 0, 12)
  s = await st(page)
  expect(s.lightsOn).toBe(true)
  await run(page, 0, 0, 30)
  s = await st(page)
  expect(s.round).toBe(1)                   // next body has arrived
  expect(s.phase).toBe('LIFT')
  expect(s.airborne).toBe(false)
})

test('no teleports: car motion stays within kinematic speed limits', async ({ page }) => {
  await load(page)
  const maxStep = await page.evaluate(() => {
    const g = window.__game
    let prev = g.state()
    let worst = 0
    const script: [number, number, number][] = [
      [1, 0, 8], [0, 1, 6], [1, 0, 4], [0, 1, 8], [-1, 0, 10], [0, 0, 4], [-1, 0, 8]
    ]
    for (const [v, h, sec] of script) {
      g.input(v, h)
      for (let i = 0; i < sec * 60; i++) {
        g.advanceSim(1 / 60)
        const s = g.state()
        const d = Math.hypot(s.carX - prev.carX, s.carY - prev.carY, s.carZ - prev.carZ)
        worst = Math.max(worst, d)
        prev = s
      }
    }
    return worst
  })
  // 1.2 m/s absolute ceiling -> 0.02 m per tick, margin for sway
  expect(maxStep).toBeLessThan(0.035)
})

test('child input: mashing, diagonals, mid-release, re-lift near contact', async ({ page }) => {
  await load(page)
  // random-ish mash
  await page.evaluate(() => {
    const g = window.__game
    const seq: [number, number, number][] = [
      [1, 0, 0.2], [-1, 0, 0.15], [1, 1, 0.3], [0, 0, 0.1], [1, -1, 0.4],
      [-1, 1, 0.2], [1, 0, 0.5], [0, 0, 0.05], [1, 0, 0.1], [-1, -1, 0.2]
    ]
    for (const [v, h, s] of seq) { g.input(v, h); g.advance(s) }
  })
  let s = await st(page)
  expect(s.tension).toBeGreaterThanOrEqual(0)
  expect(s.tension).toBeLessThanOrEqual(1)
  expect(s.carY).toBeGreaterThan(1.0)
  expect(Number.isFinite(s.carZ)).toBe(true)

  // lift high, then descend nearly to contact, then pull back up — no state wedge
  await run(page, 1, 0, 14)
  await run(page, 0, 1, 13)
  await run(page, -1, 0, 12)
  s = await st(page)
  if (s.phase === 'DESCEND' || s.phase === 'TRANSPORT') {
    await run(page, 1, 0, 2)        // re-lift just before touchdown
    await run(page, -1, 0, 14)      // and set it down for real
    await run(page, 0, 0, 1)
    s = await st(page)
  }
  expect(['SEATED', 'UNHOOK', 'LIGHTS', 'MOVER_IN', 'TOW']).toContain(s.phase)
})

test('orientation change preserves lift state', async ({ page }) => {
  await load(page)
  await run(page, 1, 0, 6)
  await run(page, 0, 0, 0.5)
  const before = await st(page)
  await page.setViewportSize({ width: 844, height: 390 })
  await page.evaluate(() => window.__game.advance(0.5))
  const after = await st(page)
  expect(after.carY).toBeCloseTo(before.carY, 1)
  expect(after.airborne).toBe(before.airborne)
  expect(after.phase).toBe(before.phase)
})

test('renderer stays healthy over repeated cycles (memory / draw calls)', async ({ page }) => {
  test.setTimeout(300_000)
  await load(page)
  const metrics = await page.evaluate(() => {
    const g = window.__game
    const cycle = () => {
      g.input(1, 0); g.advance(14)
      g.input(0, 1); g.advance(13)
      g.input(-1, 0); g.advance(16)
      g.input(0, 0); g.advance(46)
    }
    const infoBefore = g.info()
    const t0 = performance.now()
    for (let i = 0; i < 3; i++) cycle()
    const elapsed = performance.now() - t0
    const infoAfter = g.info()
    return { elapsed, infoBefore, infoAfter, round: g.state().round }
  })
  expect(metrics.round).toBeGreaterThanOrEqual(3)
  // geometry/texture counts must not grow across rounds (no leaks)
  expect(metrics.infoAfter.geometries).toBeLessThanOrEqual(metrics.infoBefore.geometries + 8)
  expect(metrics.infoAfter.textures).toBeLessThanOrEqual(metrics.infoBefore.textures + 4)
  console.log('perf:', JSON.stringify(metrics))
})
