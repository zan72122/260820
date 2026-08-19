import { test, expect } from '@playwright/test'
import {
  boot,
  collectErrors,
  dropLayer,
  project,
  spreadCream,
  state,
  waitStage,
} from './helpers'

const PHONE = ['iphone-portrait', 'iphone-landscape']

test('one complete cake: stack, fill, close, coat, cut, spill, replay', async ({
  page,
}, info) => {
  test.skip(!PHONE.includes(info.project.name), 'full loop runs on phone surfaces')
  const errors = collectErrors(page)
  await boot(page)
  const size = page.viewportSize()!

  /* 1 - the base sponge goes on the board */
  await dropLayer(page, 0)
  await waitStage(page, 'cream1')

  /* 2 - buttercream, then the two ring layers that form the cavity */
  await spreadCream(page, 'placeRing1')
  await dropLayer(page, 2.9)
  await waitStage(page, 'cream2')
  await spreadCream(page, 'placeRing2')
  await dropLayer(page, 5.8)
  await waitStage(page, 'pour')

  /* 3 - pour candy into the cavity */
  const hole = await project(page, 0, 8, 0)
  const holdY = Math.min(size.height - 10, hole.y + (size.height > size.width ? 130 : 90))
  await page.mouse.move(hole.x, holdY)
  await page.mouse.down()
  for (let i = 0; i < 40; i++) {
    await page.mouse.move(hole.x + Math.sin(i / 3) * 16, holdY + Math.cos(i / 4) * 10)
    await page.waitForTimeout(110)
    if ((await state(page)).inBowl === 0) break
  }
  await page.mouse.up()
  const filled = await state(page)
  expect(filled.poured, 'candy actually left the bowl').toBeGreaterThan(10)
  expect(filled.inCavity, 'candy landed in the cavity').toBeGreaterThan(8)
  await waitStage(page, 'cream3')

  /* 4 - close the secret with the solid top layer */
  await spreadCream(page, 'placeLid')
  await dropLayer(page, 8.7)
  await waitStage(page, 'coat')

  /* 5 - spin the turntable until the coat hides everything */
  for (let i = 0; i < 14; i++) {
    await page.mouse.move(size.width * 0.08, size.height * 0.55)
    await page.mouse.down()
    await page.mouse.move(size.width * 0.94, size.height * 0.55, { steps: 14 })
    await page.mouse.up()
    await page.waitForTimeout(240)
    if ((await state(page)).stage !== 'coat') break
  }
  await waitStage(page, 'cut')
  expect((await state(page)).coat).toBeGreaterThan(0.99)

  /* 6 - one downward swipe cuts the cake */
  for (let i = 0; i < 8; i++) {
    await page.mouse.move(size.width * 0.5, size.height * 0.18)
    await page.mouse.down()
    await page.mouse.move(size.width * 0.5, size.height * 0.88, { steps: 16 })
    await page.mouse.up()
    await page.waitForTimeout(220)
    if ((await state(page)).stage !== 'cut') break
  }

  /* 7 - the slice comes out and the secret spills */
  await waitStage(page, 'reveal')
  await waitStage(page, 'done', 60_000)
  const end = await state(page)
  expect(end.split, 'the cake swapped to its pre-split meshes').toBe(true)
  expect(end.spilled, 'candy left the cavity when the slice did').toBeGreaterThan(4)
  expect(end.spilled).toBeLessThan(end.poured)

  /* 8 - immediately playable again */
  await page.locator('#replay').click()
  await waitStage(page, 'placeBase')
  const again = await state(page)
  expect(again.poured).toBe(0)
  expect(again.split).toBe(false)
  expect(again.coat).toBe(0)

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([])
})

test('boots, frames the bench and takes the first layer', async ({ page }) => {
  const errors = collectErrors(page)
  await boot(page, '?fast=1&seed=11')

  // the whole working set must be inside the frame on this surface
  const size = page.viewportSize()!
  for (const [name, p] of [
    ['cake centre', await project(page, 0, 4, 0)],
    ['board front', await project(page, 0, 0, 11.6)],
    ['board left', await project(page, -11.6, 0, 0)],
    ['board right', await project(page, 11.6, 0, 0)],
  ] as const) {
    expect(p.x, `${name} x on screen`).toBeGreaterThan(-4)
    expect(p.x, `${name} x on screen`).toBeLessThan(size.width + 4)
    expect(p.y, `${name} y on screen`).toBeGreaterThan(-4)
    expect(p.y, `${name} y on screen`).toBeLessThan(size.height + 4)
  }

  await dropLayer(page, 0)
  await waitStage(page, 'cream1')
  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([])
})

test('an orientation flip keeps the stack, the candy and the stage', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'iphone-portrait', 'one flip check is enough')
  await boot(page, '?fast=1&seed=11')
  await dropLayer(page, 0)
  await waitStage(page, 'cream1')
  await spreadCream(page, 'placeRing1')
  await dropLayer(page, 2.9)
  await waitStage(page, 'cream2')

  const before = await state(page)
  await page.setViewportSize({ width: 844, height: 390 })
  await page.waitForTimeout(700)
  const after = await state(page)
  expect(after.stage).toBe(before.stage)
  expect(after.inBowl).toBe(before.inBowl)

  // and it is still playable from there
  await spreadCream(page, 'placeRing2')
  await dropLayer(page, 5.8)
  await waitStage(page, 'pour')
})

test('a backgrounded tab does not blow the physics up', async ({ page }, info) => {
  test.skip(info.project.name !== 'iphone-portrait', 'one pause check is enough')
  await boot(page, '?fast=1&seed=5')
  await dropLayer(page, 0)
  await waitStage(page, 'cream1')
  await spreadCream(page, 'placeRing1')
  await dropLayer(page, 2.9)
  await waitStage(page, 'cream2')
  await spreadCream(page, 'placeRing2')
  await waitStage(page, 'placeRing2')
  await dropLayer(page, 5.8)
  await waitStage(page, 'pour')

  const size = page.viewportSize()!
  const hole = await project(page, 0, 8, 0)
  await page.mouse.move(hole.x, Math.min(size.height - 10, hole.y + 130))
  await page.mouse.down()
  await page.waitForTimeout(1400)
  await page.mouse.up()
  const before = await state(page)
  expect(before.poured).toBeGreaterThan(3)

  // pretend the child locked the screen for a while
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(2500)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(900)

  const dump = await page.evaluate(() => window.__cake.dump())
  const live = dump.filter((d) => d[3] === 1)
  expect(live.length).toBeGreaterThan(0)
  for (const [x, y, z] of live) {
    expect(Math.abs(x), 'candy stayed near the cake').toBeLessThan(20)
    expect(Math.abs(z), 'candy stayed near the cake').toBeLessThan(20)
    expect(y, 'candy did not fall through the world').toBeGreaterThan(-6)
    expect(y, 'candy was not launched').toBeLessThan(24)
  }
})
