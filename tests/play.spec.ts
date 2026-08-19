import { test, expect, type ConsoleMessage } from '@playwright/test'
import { boot, playThrough, state, step, traceGuide } from './helpers'

const SIZES = [
  { name: 'iPhone portrait', width: 390, height: 844 },
  { name: 'iPhone landscape', width: 844, height: 390 },
  { name: 'iPad portrait', width: 820, height: 1180 },
  { name: 'iPad landscape', width: 1180, height: 820 },
]

for (const size of SIZES) {
  test(`plays a whole cake at ${size.name} (${size.width}x${size.height})`, async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m: ConsoleMessage) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
    await page.setViewportSize(size)
    await boot(page)

    const { seen, marks, final } = await playThrough(page)

    // every beat of the chiffon chain happened, in order
    expect(seen).toEqual([
      'intro',
      'mix',
      'pour',
      'toOven',
      'bake',
      'takeout',
      'flip',
      'mount',
      'cool',
      'release',
      'lift',
      'press',
      'done',
    ])

    // the batter went in, rose, turned over, hung upside-down and came out
    expect(marks.takeout.fill).toBeCloseTo(1, 1)
    expect(marks.takeout.rise).toBeCloseTo(1, 1)
    expect(marks.mount.flipDeg).toBeGreaterThan(175)
    expect(marks.cool.mountedOnBottle).toBe(true)
    expect(marks.release.flipDeg).toBeLessThan(5)
    expect(marks.lift.cakeDetached).toBe(true)
    expect(final.finishVisible).toBe(true)
    expect(errors).toEqual([])
  })
}

test('an interrupted flip settles safely instead of dropping the pan', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => {
    window.__chiffon.goto('bake')
    window.__chiffon.step(8.5)
    window.__chiffon.goto('flip')
    window.__chiffon.step(1.4)
  })
  const pts = (await page.evaluate(() => window.__chiffon.guidePx()))!
  expect(pts.length).toBeGreaterThan(10)

  // let go a fifth of the way in, then walk away
  await page.evaluate((pts) => {
    const el = document.getElementById('stage')!
    const fire = (type: string, x: number, y: number) =>
      el.dispatchEvent(
        new PointerEvent(type, { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true }),
      )
    fire('pointerdown', pts[0].x, pts[0].y)
    const stop = Math.floor(pts.length * 0.2)
    for (let i = 1; i <= stop; i++) fire('pointermove', pts[i].x, pts[i].y)
    fire('pointercancel', pts[stop].x, pts[stop].y)
  }, pts)
  await step(page, 3)

  const st = await state(page)
  expect(st.stage).toBe('flip')
  // back to a safe upright pose — never mid-air, never dropped
  expect(Math.abs(st.flipDeg)).toBeLessThan(6)
  expect(st.panY).toBeGreaterThan(0.25)
})

test('rotating the screen keeps the stage and re-lays the guide', async ({ page }) => {
  await boot(page)
  await step(page, 2)
  await traceGuide(page)
  await step(page, 0.5)
  const before = await state(page)

  await page.setViewportSize({ width: 844, height: 390 })
  await page.waitForTimeout(400)
  await step(page, 0.4)

  const after = await state(page)
  expect(after.stage).toBe(before.stage)
  const guide = await page.evaluate(() => window.__chiffon.guidePx())
  expect(guide).not.toBeNull()
  // the guide is re-projected into the new viewport, not left off-screen
  for (const p of guide!) {
    expect(p.x).toBeGreaterThan(-40)
    expect(p.x).toBeLessThan(884)
    expect(p.y).toBeGreaterThan(-40)
    expect(p.y).toBeLessThan(430)
  }
})

test('a hidden tab freezes the bake instead of racing ahead', async ({ page }) => {
  await boot(page)
  // get the rise under way, then let real frames drive it
  await page.evaluate(() => {
    window.__chiffon.goto('bake')
    window.__chiffon.step(1.6)
  })
  expect(await page.evaluate(() => window.__chiffon.running())).toBe(true)

  const before = (await state(page)).rise
  expect(before).toBeGreaterThan(0)
  await page.waitForTimeout(2000)
  const visible = (await state(page)).rise
  expect(visible).toBeGreaterThan(before)

  const hidden = await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
    return window.__chiffon.running()
  })
  expect(hidden).toBe(false)

  const paused = (await state(page)).rise
  await page.waitForTimeout(2000)
  expect((await state(page)).rise).toBeCloseTo(paused, 6)

  const resumed = await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    document.dispatchEvent(new Event('visibilitychange'))
    return window.__chiffon.running()
  })
  expect(resumed).toBe(true)
  await page.waitForTimeout(2000)
  expect((await state(page)).rise).toBeGreaterThan(paused)
})
