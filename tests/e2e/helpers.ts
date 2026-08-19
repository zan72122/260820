import type { Page } from '@playwright/test'

export interface DebugState {
  state: string
  standing: number
  total: number
  tank: number
  loads: number
  lane: number
  x: number
  z: number
  progress: number
  truckFill: number
  grains: number
}

export interface DebugCamera {
  shot: string
  x: number
  y: number
  z: number
  fov: number
}

export interface DebugStats {
  calls: number
  triangles: number
  pixelRatio: number
  shadows: boolean
}

/** The handle main.ts hangs on `window`; typed here rather than in a global. */
interface GameApi {
  debugState(): DebugState
  debugCamera(): DebugCamera
  debugStats(): DebugStats
  debugAdvance(seconds: number): void
  debugAction(k: 'lower' | 'auger' | 'unload' | 'again'): void
}
type WinWithGame = Window & { __game: GameApi }

/** Boots the game and waits until it is interactive. `fx=low` keeps software GL usable. */
export async function boot(page: Page, query = '?fx=low') {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await page.goto(`/${query}`, { waitUntil: 'load' })
  await page.waitForFunction(() => !!(window as unknown as WinWithGame).__game, null, {
    timeout: 90_000,
  })
  return errors
}

/** Advances the simulation without waiting on the software renderer. */
export const advance = (page: Page, seconds: number) =>
  page.evaluate((s) => (window as unknown as WinWithGame).__game.debugAdvance(s), seconds)

export const state = (page: Page): Promise<DebugState> =>
  page.evaluate(() => (window as unknown as WinWithGame).__game.debugState())

export const camera = (page: Page): Promise<DebugCamera> =>
  page.evaluate(() => (window as unknown as WinWithGame).__game.debugCamera())

export const stats = (page: Page): Promise<DebugStats> =>
  page.evaluate(() => (window as unknown as WinWithGame).__game.debugStats())

/** Presses whatever big button is on screen, the way a child would. */
export async function pressAction(page: Page): Promise<boolean> {
  const btn = page.locator('#actions .act')
  if ((await btn.count()) === 0) return false
  await btn.first().click({ force: true })
  return true
}

/** Steps the simulation until `pred` holds, without touching the controls. */
export async function stepUntil(
  page: Page,
  pred: (s: DebugState) => boolean,
  maxSimSeconds = 120,
): Promise<DebugState> {
  let s = await state(page)
  for (let t = 0; t < maxSimSeconds && !pred(s); t += 0.5) {
    await advance(page, 0.5)
    s = await state(page)
  }
  return s
}

/** Steps until `pred` holds, pressing the on-screen button whenever one appears. */
export async function playUntil(
  page: Page,
  pred: (s: DebugState) => boolean,
  maxSimSeconds = 300,
): Promise<DebugState> {
  let s = await state(page)
  for (let t = 0; t < maxSimSeconds && !pred(s); t += 0.5) {
    await advance(page, 0.5)
    await pressAction(page)
    s = await state(page)
  }
  return s
}

/** Presses and holds one finger at a fraction of the canvas width. */
export async function holdFinger(page: Page, fracX: number, fracY = 0.6) {
  await page.evaluate(
    ([fx, fy]) => {
      const c = document.getElementById('scene') as HTMLCanvasElement
      const r = c.getBoundingClientRect()
      const x = r.left + r.width * fx
      const y = r.top + r.height * fy
      const opts = { pointerId: 1, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: true }
      c.dispatchEvent(new PointerEvent('pointerdown', opts))
      c.dispatchEvent(new PointerEvent('pointermove', opts))
    },
    [fracX, fracY],
  )
}

export async function releaseFinger(page: Page) {
  await page.evaluate(() => {
    document
      .getElementById('scene')!
      .dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }))
  })
}
