import type { Page } from '@playwright/test'

import type { ChiffonState } from '../src/automation'
export type { ChiffonState }

export const boot = async (page: Page, query = '?fast=1') => {
  await page.goto('/' + query, { waitUntil: 'load' })
  await page.waitForFunction(() => !!window.__chiffon, null, { timeout: 30_000 })
}

export const state = (page: Page) => page.evaluate(() => window.__chiffon.state())
/** Advance logical game time without waiting on a software rasteriser. */
export const step = (page: Page, seconds: number) =>
  page.evaluate((s) => window.__chiffon.step(s), seconds)

/**
 * Trace the stage's own ghost trajectory with real pointer events on the canvas.
 * Dispatched in-page so a full stroke costs one round trip.
 */
export async function traceGuide(page: Page): Promise<boolean> {
  const pts = await page.evaluate(() => window.__chiffon.guidePx())
  if (!pts || pts.length < 2) return false
  const kind = await page.evaluate(() => window.__chiffon.gestureKind())
  await page.evaluate(
    ({ pts, kind }) => {
      const el = document.getElementById('stage')!
      const fire = (type: string, x: number, y: number) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 1,
            pointerType: 'touch',
            isPrimary: true,
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
          }),
        )
      if (kind === 'tap') {
        const m = pts[Math.floor(pts.length / 2)]
        fire('pointerdown', m.x, m.y)
        fire('pointerup', m.x, m.y)
        return
      }
      fire('pointerdown', pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]
        const b = pts[i]
        for (let s = 1; s <= 3; s++)
          fire('pointermove', a.x + (b.x - a.x) * (s / 3), a.y + (b.y - a.y) * (s / 3))
      }
      fire('pointerup', pts[pts.length - 1].x, pts[pts.length - 1].y)
    },
    { pts, kind },
  )
  return true
}

/** Play the whole cake through, recording the state at every stage change. */
export async function playThrough(page: Page, maxIterations = 400) {
  const seen: string[] = []
  const marks: Record<string, ChiffonState> = {}
  let last = ''
  for (let i = 0; i < maxIterations; i++) {
    const st = await state(page)
    if (st.stage !== last) {
      last = st.stage
      seen.push(st.stage)
    }
    marks[st.stage] = st
    if (st.stage === 'done' && st.finishVisible) break
    if (await traceGuide(page)) await step(page, 0.4)
    else await step(page, 0.5)
  }
  return { seen, marks, final: await state(page) }
}
