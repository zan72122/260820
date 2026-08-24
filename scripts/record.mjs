// Record a deterministic full playthrough (portrait + landscape) as webm,
// then extract keyframes for independent review.
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const outDir = process.argv[2] || 'recordings'
fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })

async function record(name, w, h) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
    recordVideo: { dir: outDir, size: { width: w, height: h } }
  })
  const page = await ctx.newPage()
  await page.goto('http://127.0.0.1:5173/?e2e=1&seed=1', { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__game !== undefined, { timeout: 15000 })

  // real-time playthrough driven through the same input hook the touch layer feeds
  const stepReal = async (v, hh, sec) => {
    await page.evaluate(([a, b]) => window.__game.input(a, b), [v, hh])
    await page.waitForTimeout(sec * 1000)
  }
  await stepReal(0, 0, 2.5)     // reveal beat
  await stepReal(1, 0, 4.5)     // slack -> tension -> liftoff
  await stepReal(0, 0, 1.5)     // hold: settle
  await stepReal(1, 0, 8)       // rise to clearance
  await stepReal(0, 1, 10)      // traverse
  await stepReal(0, 0, 2)
  await stepReal(-1, 0, 13)     // descend
  await stepReal(0, 0, 3)       // (final creep + contact happen in here)
  await stepReal(-1, 0, 4)
  await stepReal(0, 0, 26)      // seated -> unhook -> lights -> mover -> tow
  const video = page.video()
  await ctx.close()
  const path = await video.path()
  fs.renameSync(path, `${outDir}/${name}.webm`)
  console.log('saved', `${outDir}/${name}.webm`)
}

await record('play-portrait', 390, 844)
await record('play-landscape', 844, 390)
await browser.close()
console.log('done')
