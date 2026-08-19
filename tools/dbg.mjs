import { chromium } from '@playwright/test'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true })
page.on('pageerror', e => console.log('PAGEERROR', e.message))
await page.goto('http://127.0.0.1:4173/?fast=1', { waitUntil: 'load' })
await page.waitForFunction(() => !!window.__chiffon)
await page.evaluate(() => window.__chiffon.goto('pour'))
await page.evaluate(() => window.__chiffon.step(1.5))
const pts = await page.evaluate(() => window.__chiffon.guidePx())
console.log('guide pts', pts.length, pts[0], pts[pts.length-1])
await page.mouse.move(pts[0].x, pts[0].y)
await page.mouse.down()
for (let i = 1; i < pts.length; i++) await page.mouse.move(pts[i].x, pts[i].y)
console.log('progress after trace', await page.evaluate(() => window.__chiffon.progress()))
await page.mouse.up()
console.log('state', await page.evaluate(() => window.__chiffon.state()))
await browser.close()
