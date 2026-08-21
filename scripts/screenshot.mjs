/**
 * Dev helper: capture a screenshot of the running preview server.
 * Layout sanity only — SwiftShader output must never be used to judge
 * final visual quality (see CLAUDE.md).
 *
 * Usage: node scripts/screenshot.mjs <out.png> [urlQuery] [width] [height]
 *   e.g. node scripts/screenshot.mjs shot.png "?test=1&seed=42" 960 540
 */
import { chromium } from '@playwright/test'

const [out = 'screenshot.png', query = '?test=1&seed=42', w = '960', h = '540'] =
  process.argv.slice(2)

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ['--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({
  viewport: { width: Number(w), height: Number(h) },
})
await page.goto(`http://127.0.0.1:4173/${query}`, { waitUntil: 'load' })
await page.waitForFunction(() => window.__game?.isReady === true, undefined, {
  timeout: 60_000,
})
// A few frames so shadows/materials settle.
await page.waitForTimeout(700)
// SHOT_DRIVE="dx,dz,ticks" walks the player before the shot (mid-stride pose).
if (process.env.SHOT_DRIVE) {
  const [dx, dz, ticks] = process.env.SHOT_DRIVE.split(',').map(Number)
  await page.evaluate(
    ([mx, mz, n]) => {
      for (let i = 0; i < n; i++) {
        window.__game.dispatch({ type: 'move', dirX: mx, dirZ: mz })
        window.__game.step(1)
      }
    },
    [dx, dz, ticks],
  )
}
await page.screenshot({ path: out })
await browser.close()
console.log(`saved ${out}`)
