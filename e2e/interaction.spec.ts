import { expect, test, type Page } from '@playwright/test'

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await page.goto('/?e2e=1&q=low')
  await page.waitForFunction(() => window.__mango?.ready === true, undefined, { timeout: 60_000 })
  return errors
}

const state = (page: Page) => page.evaluate(() => window.__mango.state())
const step = (page: Page, s: number) => page.evaluate((x) => window.__mango.step(x), s)

/** Drag one cord end onto a hook with a single finger, the way a child would. */
async function dragEndToHook(page: Page, side: 'left' | 'right', hook: number): Promise<void> {
  const from = await page.evaluate((s) => window.__mango.handleScreen(s), side)
  const to = await page.evaluate((h) => window.__mango.hookScreen(h), hook)
  const offset = await page.evaluate(() => window.__mango.fingerOffset)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  const steps = 22
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    await page.mouse.move(
      from.x + (to.x - from.x) * t,
      from.y + (to.y + offset - from.y) * t,
    )
    await step(page, 1 / 30)
  }
  await page.mouse.up()
  await step(page, 0.4)
}

test('a single finger can hang both ends on the hooks', async ({ page }) => {
  const errors = await boot(page)
  await page.evaluate(() => window.__mango.pause(true))
  await step(page, 1)

  await dragEndToHook(page, 'left', 1)
  let s = await state(page)
  expect(s.attach.left).not.toBeNull()
  expect(s.stage).toBe('oneEnd')

  await dragEndToHook(page, 'right', 5)
  s = await state(page)
  expect(s.attach.right).not.toBeNull()
  expect(s.stage).toBe('hung')
  expect(errors).toEqual([])
})

test('letting go halfway never teleports the cord end', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__mango.pause(true))
  await step(page, 1)
  const from = await page.evaluate(() => window.__mango.handleScreen('left'))
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 30, from.y - 160)
  await step(page, 0.2)
  await page.mouse.move(from.x + 40, from.y - 220)
  await step(page, 0.2)
  const held = await page.evaluate(() => window.__mango.handleScreen('left'))
  await page.mouse.up()
  // One frame after release it must still be essentially where it was.
  await step(page, 1 / 60)
  const justAfter = await page.evaluate(() => window.__mango.handleScreen('left'))
  expect(Math.hypot(justAfter.x - held.x, justAfter.y - held.y)).toBeLessThan(24)
  // And it comes to rest somewhere sensible instead of vanishing.
  await step(page, 2.5)
  const settled = await page.evaluate(() => window.__mango.handleScreen('left'))
  expect(Number.isFinite(settled.x)).toBe(true)
  const s = await state(page)
  expect(s.stage).toBe('idle')
  expect(s.attach.left).toBeNull()
})

test('one weak hint appears, and it never hangs the net by itself', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__mango.pause(true))
  await step(page, 3)
  expect((await state(page)).hint).toBe('none')
  await step(page, 2)
  expect((await state(page)).hint).toBe('reachForHook')
  await step(page, 12)
  const s = await state(page)
  expect(s.attach.left).toBeNull()
  expect(s.attach.right).toBeNull()
  expect(s.stage).toBe('idle')
})

test('a second fruit starts the same process with no hint needed', async ({ page }) => {
  const errors = await boot(page)
  await page.evaluate(() => window.__mango.pause(true))
  await page.evaluate(() => window.__mango.attach(1, 5))
  let guard = 0
  while ((await state(page)).ripeness < 1 && guard++ < 60) {
    await page.evaluate(() => window.__mango.scrub(0.2))
  }
  await step(page, 8)
  let s = await state(page)
  expect(s.stage).toBe('play')

  // Take one end off: the fruit is harvested and the next one is on the branch.
  await dragEndToHook(page, 'left', 0)
  await step(page, 2)
  s = await state(page)
  expect(s.harvested).toBe(1)
  expect(s.round).toBe(1)
  expect(s.ripeness).toBe(0)
  expect(['hung', 'oneEnd']).toContain(s.stage)

  // And it runs again, with a different hook spacing.
  if (s.attach.left === null) await dragEndToHook(page, 'left', 3)
  if ((await state(page)).attach.right === null) await dragEndToHook(page, 'right', 7)
  s = await state(page)
  expect(s.stage).toBe('hung')
  guard = 0
  while ((await state(page)).ripeness < 1 && guard++ < 60) {
    await page.evaluate(() => window.__mango.scrub(0.2))
  }
  await step(page, 9)
  s = await state(page)
  expect(s.stage).toBe('play')
  expect(s.fruit.maxSink).toBeGreaterThan(0.02)
  expect(errors).toEqual([])
})

test('the net can be pushed from underneath, and the fruit answers heavily', async ({ page }) => {
  const errors = await boot(page)
  await page.evaluate(() => window.__mango.pause(true))
  await page.evaluate(() => window.__mango.attach(0, 7))
  let guard = 0
  while ((await state(page)).ripeness < 1 && guard++ < 60) {
    await page.evaluate(() => window.__mango.scrub(0.2))
  }
  await step(page, 9)
  let s = await state(page)
  expect(s.stage).toBe('play')
  const restY = s.fruit.y

  // Push the sheet up with one finger.
  const net = await page.evaluate(() => window.__mango.netScreen())
  await page.mouse.move(net.x, net.y + 10)
  await page.mouse.down()
  let peak = restY
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(net.x + i * 2, net.y + 10 - i * 7)
    await step(page, 1 / 60)
    peak = Math.max(peak, (await state(page)).fruit.y)
  }
  await page.mouse.up()
  expect(peak).toBeGreaterThan(restY + 0.004)

  // Everything comes back to rest, and the fruit is still cradled.
  await step(page, 5)
  s = await state(page)
  expect(s.stage).toBe('play')
  expect(s.fruit.phase).toBe('resting')
  expect(Math.abs(s.fruit.y - restY)).toBeLessThan(0.012)
  expect(errors).toEqual([])
})

test('recovers from a lost WebGL context', async ({ page }) => {
  await boot(page)
  const lost = await page.evaluate(() => {
    const canvas = document.getElementById('view') as HTMLCanvasElement
    const gl = canvas.getContext('webgl2')
    const ext = gl?.getExtension('WEBGL_lose_context')
    if (!ext) return false
    ext.loseContext()
    setTimeout(() => ext.restoreContext(), 200)
    return true
  })
  if (!lost) test.skip()
  await page.waitForFunction(
    () => !document.getElementById('lost')?.classList.contains('on'),
    undefined,
    { timeout: 20_000 },
  )
  await step(page, 1)
  const s = await state(page)
  expect(['idle', 'oneEnd']).toContain(s.stage)
})
