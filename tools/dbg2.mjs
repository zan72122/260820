import { chromium } from '@playwright/test'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true })
page.on('pageerror', e => console.log('PAGEERROR', e.message))
await page.goto('http://127.0.0.1:4173/?fast=1', { waitUntil: 'load' })
await page.waitForFunction(() => !!window.__chiffon)
const step = (s) => page.evaluate((v) => window.__chiffon.step(v), s)
for (let it = 0; it < 30; it++) {
  const st = await page.evaluate(() => window.__chiffon.state())
  const pts = await page.evaluate(() => window.__chiffon.guidePx())
  console.log(it, st.stage, 'guide=' + (pts ? pts.length : 'null'), 'fill=' + st.fill.toFixed(2), 'prog=' + await page.evaluate(() => window.__chiffon.progress()))
  if (pts && pts.length > 2) {
    await page.mouse.move(pts[0].x, pts[0].y)
    await page.mouse.down()
    for (let i = 1; i < pts.length; i++) await page.mouse.move(pts[i].x, pts[i].y)
    await page.mouse.up()
    await step(0.4)
  } else {
    await step(0.6)
  }
}
await browser.close()
