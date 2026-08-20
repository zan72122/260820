import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
await mkdir('shots', { recursive: true })
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 420, height: 420 } })
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)))
await page.goto('http://127.0.0.1:4173/?e2e=1&q=high&seed=305419896')
await page.waitForFunction(() => window.__mango?.ready === true, undefined, { timeout: 90000 })
await page.evaluate(() => { window.__mango.pause(true); window.__mango.closeup(true) })
await page.evaluate(() => window.__mango.attach(1, 5))
await page.evaluate(() => window.__mango.step(1.5, 1 / 120))
for (const target of [0, 0.25, 0.5, 0.75, 1]) {
  let guard = 0
  while ((await page.evaluate(() => window.__mango.state().ripeness)) < target - 1e-6 && guard++ < 80) {
    await page.evaluate(() => window.__mango.scrub(0.05))
  }
  await page.evaluate(() => window.__mango.step(0.5, 1 / 120))
  await page.evaluate(() => window.__mango.render())
  await page.screenshot({ path: `shots/ripe-${String(target).replace('.', '')}.png` })
}
await browser.close()
console.log('ripe strip done')
