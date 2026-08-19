import { chromium } from '@playwright/test'
import fs from 'node:fs'
const SP = process.argv[2]
const W = +(process.argv[3]), H = +(process.argv[4]), tag = process.argv[5]
fs.mkdirSync(SP, { recursive: true })
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
})
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
page.on('pageerror', e => console.log('PAGEERROR', e.message))
await page.goto('http://127.0.0.1:4173/?fast=1', { waitUntil: 'load' })
await page.waitForFunction(() => !!window.__chiffon)
const shots = JSON.parse(process.argv[6])
for (const [name, stage, warm, extra] of shots) {
  await page.evaluate(([stage, warm, extra]) => {
    const g = window.__chiffon
    g.goto('bake'); g.step(8.2)          // guarantees a poured + risen cake
    g.goto(stage); g.step(warm); g.step(0.001)
    if (extra !== null) { window.__dbg.pause(); window.__dbg.setFlip(extra) }
  }, [stage, warm, extra])
  await page.evaluate(() => window.__chiffon.render())
  await page.screenshot({ path: `${SP}/${tag}-${name}.png` })
  await page.evaluate(() => window.__dbg.resume())
}
await browser.close()
