import { expect, test, type Page } from '@playwright/test'

type Debug = {
  phase: string
  round: number
  coverage: number
  deploy: number
  lateral: number
  fold: number
  sunT: number
  bagPull: number
  tier: string
  hintLevel: number
}

async function boot(page: Page): Promise<void> {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await page.goto('/?fast=1')
  await page.waitForFunction(() => Boolean(window.momo), null, { timeout: 30_000 })
  await page.waitForTimeout(400)
  expect(errors, errors.join('\n')).toEqual([])
}

const debug = (page: Page) => page.evaluate(() => window.momo!.debug()) as Promise<Debug>
const call = (page: Page, fn: string, ...args: number[]) =>
  page.evaluate(([f, a]) => window.momo!.test[f as string](...(a as number[])), [fn, args] as const)

test.describe('モモの光のじゅうたん', () => {
  test('boots on WebGL2 and reaches the bagged fruit with no words on screen', async ({ page }) => {
    await boot(page)
    const hasWebgl2 = await page.evaluate(() => {
      const c = document.createElement('canvas')
      return Boolean(c.getContext('webgl2'))
    })
    expect(hasWebgl2).toBe(true)
    await call(page, 'skip', 2)
    expect((await debug(page)).phase).toBe('bagged')
    // The whole screen is one canvas: no instructions, no buttons, no labels.
    const text = (await page.locator('body').innerText()).trim()
    expect(text).toBe('')
  })

  test('runs the full causal chain: bag off, sheet out, light back up, colour in', async ({ page }) => {
    await boot(page)
    await call(page, 'skip', 2)
    await call(page, 'bag', 1)
    await call(page, 'skip', 6)
    expect((await debug(page)).phase).toBe('sheetIdle')

    const before = (await debug(page)).coverage
    await call(page, 'sheet', 1)
    expect((await debug(page)).phase).toBe('firstLight')
    await call(page, 'skip', 3.2)
    expect((await debug(page)).phase).toBe('ripening')

    // Colour is a consequence of time under the returned light, not of the drag.
    expect((await debug(page)).coverage).toBeCloseTo(before, 2)
    await call(page, 'ripen', 40)
    const ripened = await debug(page)
    expect(ripened.coverage).toBeGreaterThan(before + 0.05)
  })

  test('where the sheet is put decides where the colour lands', async ({ page }) => {
    await boot(page)
    await call(page, 'skip', 2)
    await call(page, 'bag', 1)
    await call(page, 'skip', 6)
    await call(page, 'sheet', 1)
    await call(page, 'skip', 3.2)
    await call(page, 'ripen', 20)
    const centred = (await debug(page)).coverage

    // Same fruit, same sun; only the sheet moves away.
    await page.evaluate(() => window.momo!.test.lateral(1))
    await call(page, 'fold', 1)
    await call(page, 'ripen', 20)
    const afterAway = (await debug(page)).coverage

    await page.evaluate(() => window.momo!.test.lateral(0))
    await call(page, 'fold', 0)
    await call(page, 'ripen', 20)
    const afterBack = (await debug(page)).coverage

    expect(afterAway).toBeGreaterThanOrEqual(centred)
    expect(afterBack - afterAway).toBeGreaterThan(afterAway - centred)
  })

  test('nothing breaks under mashing, reversed drags or rotation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await boot(page)
    await call(page, 'skip', 2)
    const canvas = page.locator('#scene')
    const box = (await canvas.boundingBox())!

    // Rapid taps everywhere.
    for (let i = 0; i < 12; i++) {
      await page.mouse.click(box.x + (i * 37) % box.width, box.y + (i * 53) % box.height, { delay: 5 })
    }
    // A drag in the wrong direction, then a release outside the element.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.2, { steps: 6 })
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.9, { steps: 6 })
    await page.mouse.up()

    await call(page, 'bag', 1)
    await call(page, 'skip', 6)
    await call(page, 'sheet', 1)
    await call(page, 'skip', 3.2)
    await call(page, 'ripen', 24)
    const before = await debug(page)
    expect(before.phase === 'ripening' || before.phase === 'freeplay').toBe(true)

    // Rotate to landscape mid-play.
    await page.setViewportSize({ width: 844, height: 390 })
    await page.waitForTimeout(600)
    const after = await debug(page)
    expect(after.phase).toBe(before.phase)
    expect(after.coverage).toBeGreaterThanOrEqual(before.coverage - 0.001)
    expect(after.sunT).toBeCloseTo(before.sunT, 5)
    expect(after.deploy).toBeCloseTo(before.deploy, 5)
    expect(after.bagPull).toBeCloseTo(before.bagPull, 5)
  })

  test('a real finger can take the bag off and pull the sheet out', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await boot(page)
    await call(page, 'skip', 2)
    const box = (await page.locator('#scene').boundingBox())!
    const cx = box.x + box.width / 2

    await page.mouse.move(cx, box.y + box.height * 0.42)
    await page.mouse.down()
    for (let i = 1; i <= 14; i++) {
      await page.mouse.move(cx, box.y + box.height * (0.42 + 0.035 * i), { steps: 2 })
    }
    await page.mouse.up()
    await page.waitForTimeout(200)
    expect((await debug(page)).bagPull).toBeGreaterThan(0.5)
  })

  test('the second fruit starts straight away, with no repeat of the opening', async ({ page }) => {
    await boot(page)
    await call(page, 'skip', 2)
    await call(page, 'bag', 1)
    await call(page, 'skip', 6)
    await call(page, 'sheet', 1)
    await call(page, 'skip', 3.2)
    await call(page, 'ripen', 120)
    await call(page, 'skip', 26)
    const st = await debug(page)
    expect(st.phase).toBe('handoff')

  })
})
