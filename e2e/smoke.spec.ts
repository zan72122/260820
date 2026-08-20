import { expect, test, type Page } from '@playwright/test'
import type { DebugState } from './mango'

async function boot(page: Page, query = ''): Promise<void> {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await page.goto(`/?e2e=1&q=low${query}`)
  await page.waitForFunction(() => window.__mango?.ready === true, undefined, { timeout: 60_000 })
  ;(page as unknown as { __errors: string[] }).__errors = errors
}

function errorsOf(page: Page): string[] {
  return (page as unknown as { __errors: string[] }).__errors ?? []
}

const state = (page: Page): Promise<DebugState> => page.evaluate(() => window.__mango.state())
const step = (page: Page, s: number): Promise<void> =>
  page.evaluate((sec) => window.__mango.step(sec), s)

test('boots, hangs the net, ripens, catches the fruit and reaches free play', async ({ page }) => {
  await boot(page)
  let s = await state(page)
  expect(s.stage).toBe('idle')
  expect(s.attach.left).toBeNull()

  await page.evaluate(() => window.__mango.attach(1, 5))
  s = await state(page)
  expect(s.stage).toBe('hung')

  // The net now hangs below the fruit with a gap to fall through.
  expect(s.netLow.y).toBeLessThan(s.fruit.y - 0.1)

  // Ripening spreads gradually rather than switching.
  const seen: number[] = []
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.__mango.scrub(0.16))
    seen.push((await state(page)).ripeness)
  }
  for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1])
  expect(seen[0]).toBeLessThan(0.35)

  while ((await state(page)).ripeness < 1) {
    await page.evaluate(() => window.__mango.scrub(0.2))
  }

  await step(page, 4)
  s = await state(page)
  expect(['cradling', 'play']).toContain(s.stage)
  expect(s.gripCount).toBeGreaterThan(5)

  await step(page, 4)
  s = await state(page)
  expect(s.stage).toBe('play')
  expect(s.fruit.phase).toBe('resting')
  // The fruit is held in the net, not sitting on the bench or hovering.
  expect(s.fruit.y).toBeGreaterThan(0.35)
  expect(s.fruit.maxSink).toBeGreaterThan(0.03)

  // Free play: the net can be pushed and everything settles again.
  await page.evaluate(() => window.__mango.poke())
  await step(page, 3)
  s = await state(page)
  expect(s.stage).toBe('play')

  expect(errorsOf(page)).toEqual([])
})

test('survives rotation, repeated taps and reversed drags', async ({ page }) => {
  await boot(page)
  const canvas = page.locator('#view')
  for (let i = 0; i < 6; i++) {
    await canvas.click({ position: { x: 60 + i * 20, y: 500 }, force: true })
  }
  await page.setViewportSize({ width: 844, height: 390 })
  await step(page, 0.5)
  await page.setViewportSize({ width: 1024, height: 1366 })
  await step(page, 0.5)
  await page.setViewportSize({ width: 1366, height: 1024 })
  await step(page, 0.5)
  await page.setViewportSize({ width: 390, height: 844 })
  await step(page, 0.5)
  const s = await state(page)
  expect(['idle', 'oneEnd', 'hung']).toContain(s.stage)
  expect(errorsOf(page)).toEqual([])
})

test('keeps the causal trio framed at every target size', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__mango.attach(0, 7))
  for (const size of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 1024, height: 1366 },
    { width: 1366, height: 1024 },
  ]) {
    await page.setViewportSize(size)
    await step(page, 0.6)
    const s = await state(page)
    // Camera is far enough that the framing box fits, and stays a real lens.
    expect(s.camera.dist).toBeGreaterThan(0.4)
    expect(s.camera.dist).toBeLessThan(6)
    expect(s.camera.focal).toBeGreaterThanOrEqual(48)
    expect(s.camera.focal).toBeLessThanOrEqual(100)
  }
  expect(errorsOf(page)).toEqual([])
})
