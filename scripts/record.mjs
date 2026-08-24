// Record a full playthrough (portrait + landscape) as webm in real-time mode.
// Inputs go through the __game.input hook; phase progress is polled so the
// pacing adapts to the headless frame rate.
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
  await page.goto('http://127.0.0.1:5173/?seed=1', { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__game !== undefined, { timeout: 15000 })

  const input = (v, hh) => page.evaluate(([a, b]) => window.__game.input(a, b), [v, hh])
  const state = () => page.evaluate(() => window.__game.state())
  const untilState = async (pred, cap) => {
    const t0 = Date.now()
    for (;;) {
      const s = await state()
      if (pred(s) || Date.now() - t0 > cap) return s
      await page.waitForTimeout(400)
    }
  }

  await page.waitForTimeout(5200)                        // intro beat on the bogies, pull-back, hint
  await input(1, 0)                                      // raise: slack -> tension -> liftoff
  await untilState(s => s.airborne, 15000)
  await input(0, 0)
  await page.waitForTimeout(1600)                        // hold: trial lift, settle
  await input(1, 0)
  await untilState(s => s.phase === 'TRANSPORT', 25000)
  await input(0, 1)                                      // traverse toward the beam
  await untilState(s => Math.abs(s.carZ) < 0.45, 30000)
  await input(0, 0)
  await page.waitForTimeout(1800)                        // sway settles
  await input(-1, 0)                                     // descend, final segment creeps
  await untilState(s => s.phase === 'SEATED' || s.phase === 'UNHOOK', 45000)
  await input(0, 0)
  await untilState(s => s.phase === 'TOW', 45000)        // unhook, lights, mover couples
  await page.waitForTimeout(12000)                       // tow rolls toward the hall
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
