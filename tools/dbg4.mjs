import { chromium } from '@playwright/test'
const SP='/tmp/claude-0/-home-user-260820/2b376f03-078b-53b8-a84d-e9cc15d7d9a7/scratchpad'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
})
const page = await browser.newPage({ viewport: { width: 520, height: 520 }, deviceScaleFactor: 1 })
page.on('pageerror', e => console.log('PAGEERROR', e.message))
await page.goto('http://127.0.0.1:4173/?fast=1', { waitUntil: 'load' })
await page.waitForFunction(() => !!window.__chiffon)
const info = await page.evaluate(() => {
  const g = window.__chiffon
  g.goto('bake'); g.step(8.0)
  const w = window.__dbg
  w.look(-0.16, 0.34, 0.1, -0.4, 0.22, -0.28, 40)
  return { st: g.state(), cake: w.cakeInfo() }
})
console.log(JSON.stringify(info, null, 1))
await page.evaluate(() => window.__chiffon.render())
await page.screenshot({ path: SP + '/pan-cake.png' })
await browser.close()
