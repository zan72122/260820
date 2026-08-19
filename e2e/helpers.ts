import { expect, type Page } from '@playwright/test'

export type State = {
  stage: string
  poured: number
  inBowl: number
  spilled: number
  inCavity: number
  moving: number
  coat: number
  cut: number
  split: boolean
}

declare global {
  interface Window {
    __cake: {
      state: () => State
      project: (x: number, y: number, z: number) => { x: number; y: number }
      dump: () => Array<[number, number, number, number, number]>
      restart: () => void
    }
  }
}

export const state = (page: Page) => page.evaluate(() => window.__cake.state())

export const project = (page: Page, x: number, y: number, z: number) =>
  page.evaluate(([a, b, c]) => window.__cake.project(a, b, c), [x, y, z])

export async function boot(page: Page, query = '?fast=1&seed=7') {
  await page.goto('/' + query)
  await page.waitForFunction(() => !!window.__cake)
  await waitStage(page, 'placeBase')
}

export async function waitStage(page: Page, stage: string, timeout = 45_000) {
  await expect
    .poll(async () => (await state(page)).stage, { timeout, intervals: [120] })
    .toBe(stage)
}

/** Grab the pending layer, carry it over the board and let go. */
export async function dropLayer(page: Page, worldY: number) {
  const size = page.viewportSize()!
  const lift = size.height >= size.width ? 96 : 74
  const target = await project(page, 0, worldY + 2.6, 0)
  await page.mouse.move(size.width * 0.5, size.height * 0.7)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y + lift, { steps: 6 })
  await page.waitForTimeout(400)
  await page.mouse.move(target.x, target.y + lift, { steps: 2 })
  await page.mouse.up()
}

/** Broad spreading swipes until the buttercream beat hands over. */
export async function spreadCream(page: Page, next: string) {
  const size = page.viewportSize()!
  for (let i = 0; i < 10; i++) {
    const y = size.height * (0.45 + (i % 2) * 0.06)
    await page.mouse.move(size.width * 0.1, y)
    await page.mouse.down()
    await page.mouse.move(size.width * 0.9, y, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(120)
    if ((await state(page)).stage === next) break
  }
  await waitStage(page, next)
}

export function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(String(e)))
  return errors
}
