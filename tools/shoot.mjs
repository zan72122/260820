// Quick visual probe used while tuning. Not part of the test suite.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const OUT = process.env.OUT || 'shots'
mkdirSync(OUT, { recursive: true })

const VIEWPORTS = {
  'iphone-portrait': { width: 390, height: 844 },
  'iphone-landscape': { width: 844, height: 390 },
  'ipad-portrait': { width: 1024, height: 1366 },
  'ipad-landscape': { width: 1366, height: 1024 },
}

const STEPS = [
  ['01-bagged', async (p) => { await t(p, 'skip', 2) }],
  ['02-unbagged', async (p) => { await t(p, 'bag', 1); await t(p, 'skip', 4) }],
  ['03-sheet-mid', async (p) => { await t(p, 'skip', 3); await t(p, 'sheet', 0.42) }],
  ['04-first-light', async (p) => { await t(p, 'sheet', 0.45); await t(p, 'skip', 1.2) }],
  ['05-ripening', async (p) => { await t(p, 'skip', 3.2); await t(p, 'ripen', 12); await t(p, 'skip', 3) }],
  ['06-ripened', async (p) => { await t(p, 'ripen', 24); await t(p, 'skip', 6) }],
  ['07-freeplay', async (p) => { await t(p, 'skip', 8); await t(p, 'lateral', -0.8); await t(p, 'fold', 0.5); await t(p, 'ripen', 20); await t(p, 'skip', 2) }],
  ['08-handoff', async (p) => { await t(p, 'lateral', 0.3); await t(p, 'fold', 0); await t(p, 'ripen', 30); await t(p, 'skip', 26) }],
  ['09-second-fruit', async (p) => { await p.evaluate(() => window.momo.test.next()); await t(p, 'skip', 3) }],
]

const t = (page, fn, ...args) =>
  page.evaluate(([f, a]) => window.momo.test[f](...a), [fn, args])

const which = process.argv[2] ? process.argv[2].split(',') : Object.keys(VIEWPORTS)

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
for (const name of which) {
  const vp = VIEWPORTS[name]
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('[pageerror]', name, String(e)))
  page.on('console', (m) => m.type() === 'error' && console.error('[console]', name, m.text()))
  await page.goto('http://127.0.0.1:4173/?fast=1&tier=' + (process.env.TIER || 'balanced') + '')
  await page.waitForFunction(() => Boolean(window.momo), null, { timeout: 30000 })
  await page.waitForTimeout(1400)
  for (const [label, step] of STEPS) {
    await step(page)
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${OUT}/${name}-${label}.png` })
    console.log(name, label, JSON.stringify(await page.evaluate(() => window.momo.debug())))
  }
  await ctx.close()
}
await browser.close()
